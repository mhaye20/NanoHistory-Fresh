const { createClient } = require('@supabase/supabase-js');
const stringSimilarity = require('string-similarity');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

const SIMILARITY_THRESHOLD = 0.6; // 60% similarity threshold

// Common word variations to normalize
const WORD_VARIATIONS = {
  'hospital': ['medical center', 'medical', 'healthcare center', 'health center'],
  'theater': ['theatre'],
  'museum': ['gallery', 'exhibition'],
  'church': ['cathedral', 'chapel', 'parish'],
  'park': ['gardens', 'garden', 'recreational area'],
  'building': ['tower', 'complex', 'center', 'centre'],
  'house': ['home', 'mansion', 'residence'],
  'library': ['public library', 'reading room'],
  'school': ['academy', 'institute', 'education center'],
  'historic': ['historical', 'heritage'],
  'centre': ['center']
};

function normalizeTitle(title) {
  let normalized = title.toLowerCase();
  
  // Replace variations with standard terms
  for (const [standard, variations] of Object.entries(WORD_VARIATIONS)) {
    for (const variation of variations) {
      normalized = normalized.replace(new RegExp(variation, 'gi'), standard);
    }
  }
  
  // Remove common prefixes/suffixes
  normalized = normalized.replace(/^(the|old|new) /, '');
  
  // Remove common punctuation and extra spaces
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

function areSimilarTitles(title1, title2) {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);
  
  // Direct match after normalization
  if (norm1 === norm2) return true;
  
  // Check string similarity
  const similarity = stringSimilarity.compareTwoStrings(norm1, norm2);
  if (similarity > SIMILARITY_THRESHOLD) return true;
  
  // Check if one is contained within the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  
  return false;
}

async function removeDuplicates() {
  try {
    console.log('Fetching all locations and stories...');
    
    // Fetch all locations with their AI stories and related tables
    const { data: locations, error: locError } = await supabase
      .from('locations')
      .select(`
        *,
        ai_generated_stories (
          id,
          content
        ),
        stories (
          id
        ),
        user_actions (
          id
        )
      `);

    if (locError) throw locError;

    console.log(`Found ${locations.length} locations`);

    // Group similar locations
    const duplicateGroups = [];
    const processed = new Set();

    for (let i = 0; i < locations.length; i++) {
      if (processed.has(locations[i].id)) continue;
      
      const group = [locations[i]];
      processed.add(locations[i].id);

      for (let j = i + 1; j < locations.length; j++) {
        if (processed.has(locations[j].id)) continue;

        const titleSimilar = areSimilarTitles(locations[i].title, locations[j].title);
        const coordSimilar = Math.abs(locations[i].latitude - locations[j].latitude) < 0.0001 &&
                            Math.abs(locations[i].longitude - locations[j].longitude) < 0.0001;

        if (titleSimilar || coordSimilar) {
          group.push(locations[j]);
          processed.add(locations[j].id);
        }
      }

      if (group.length > 1) {
        duplicateGroups.push(group);
      }
    }

    console.log(`Found ${duplicateGroups.length} groups of similar locations`);

    // Process each group of duplicates
    for (const group of duplicateGroups) {
      // Sort by completeness and visit count to find the best entry
      const sorted = group.sort((a, b) => {
        const scoreA = calculateCompleteness(a) + (a.visit_count || 0);
        const scoreB = calculateCompleteness(b) + (b.visit_count || 0);
        return scoreB - scoreA;
      });

      const keeper = sorted[0];
      const duplicates = sorted.slice(1);
      
      console.log(`\nProcessing group: ${keeper.title}`);
      console.log(`Keeper ID: ${keeper.id}`);
      console.log(`Duplicate IDs: ${duplicates.map(d => d.id).join(', ')}`);

      // Process each duplicate one at a time
      for (const duplicate of duplicates) {
        try {
          // 1. Get all AI stories
          const { data: keeperStory } = await supabase
            .from('ai_generated_stories')
            .select('content')
            .eq('location_id', keeper.id)
            .single();

          const { data: duplicateStory } = await supabase
            .from('ai_generated_stories')
            .select('content')
            .eq('location_id', duplicate.id)
            .single();

          // 2. Combine AI stories
          if (keeperStory && duplicateStory) {
            const combinedContent = `${keeperStory.content}\n\nAdditional History:\n${duplicateStory.content}`;
            
            // Update keeper's AI story
            const { error: updateError } = await supabase
              .from('ai_generated_stories')
              .update({ content: combinedContent })
              .eq('location_id', keeper.id);

            if (updateError) {
              console.error('Error updating AI story:', updateError);
              continue;
            }

            // Delete duplicate's AI story
            const { error: deleteAiError } = await supabase
              .from('ai_generated_stories')
              .delete()
              .eq('location_id', duplicate.id);

            if (deleteAiError) {
              console.error('Error deleting AI story:', deleteAiError);
              continue;
            }
          }

          // 3. Move user stories to keeper
          if (duplicate.stories?.length > 0) {
            const { error: updateStoriesError } = await supabase
              .from('stories')
              .update({ location_id: keeper.id })
              .eq('location_id', duplicate.id);

            if (updateStoriesError) {
              console.error('Error updating stories:', updateStoriesError);
              continue;
            }
          }

          // 4. Move user actions to keeper
          if (duplicate.user_actions?.length > 0) {
            const { error: updateActionsError } = await supabase
              .from('user_actions')
              .update({ location_id: keeper.id })
              .eq('location_id', duplicate.id);

            if (updateActionsError) {
              console.error('Error updating user actions:', updateActionsError);
              continue;
            }
          }

          // 5. Delete the duplicate location
          const { error: deleteError } = await supabase
            .from('locations')
            .delete()
            .eq('id', duplicate.id);

          if (deleteError) {
            console.error('Error deleting location:', deleteError);
            continue;
          }

          console.log(`Successfully processed duplicate: ${duplicate.title} (${duplicate.id})`);

        } catch (error) {
          console.error(`Error processing duplicate ${duplicate.id}:`, error);
        }
      }
    }

    console.log('\nDuplicate removal complete!');

  } catch (error) {
    console.error('Error removing duplicates:', error);
  }
}

function calculateCompleteness(location) {
  let score = 0;
  if (location.title) score++;
  if (location.description) score++;
  if (location.image_url) score++;
  if (location.historical_period) score++;
  if (location.category) score++;
  if (location.ai_generated_stories?.length > 0) score += 2;
  if (location.visit_count > 0) score += location.visit_count;
  return score;
}

// Run the script
removeDuplicates();
