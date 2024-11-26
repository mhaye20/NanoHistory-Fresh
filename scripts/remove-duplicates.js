const { createClient } = require('@supabase/supabase-js');
const stringSimilarity = require('string-similarity');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

// Constants for location matching
const TITLE_SIMILARITY_THRESHOLD = 0.9; // Very high threshold for title similarity
const PAGE_SIZE = 1000; // Supabase's max page size
const DRY_RUN = false; // Set to false to perform actual deletions

async function fetchAllLocations() {
  let allLocations = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const start = page * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    console.log(`Fetching locations ${start} to ${end}...`);

    const { data: locations, error } = await supabase
      .from('locations')
      .select('*')
      .range(start, end)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (locations.length < PAGE_SIZE) {
      hasMore = false;
    }

    allLocations = allLocations.concat(locations);
    page++;

    console.log(`Retrieved ${locations.length} locations`);
  }

  return allLocations;
}

async function deleteLocationAndRelatedRecords(locationId) {
  try {
    // First delete related AI stories
    const { error: aiStoryError } = await supabase
      .from('ai_generated_stories')
      .delete()
      .eq('location_id', locationId);

    if (aiStoryError) {
      console.error(`Error deleting AI stories for location ${locationId}:`, aiStoryError);
      return false;
    }

    // Then delete related user stories
    const { error: storyError } = await supabase
      .from('stories')
      .delete()
      .eq('location_id', locationId);

    if (storyError) {
      console.error(`Error deleting stories for location ${locationId}:`, storyError);
      return false;
    }

    // Then delete related user actions
    const { error: actionError } = await supabase
      .from('user_actions')
      .delete()
      .eq('location_id', locationId);

    if (actionError) {
      console.error(`Error deleting user actions for location ${locationId}:`, actionError);
      return false;
    }

    // Finally delete the location
    const { error: locationError } = await supabase
      .from('locations')
      .delete()
      .eq('id', locationId);

    if (locationError) {
      console.error(`Error deleting location ${locationId}:`, locationError);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error in deleteLocationAndRelatedRecords for ${locationId}:`, error);
    return false;
  }
}

async function removeDuplicates() {
  try {
    console.log('Fetching all locations...');
    
    // Fetch all locations with pagination
    const locations = await fetchAllLocations();
    console.log(`Found ${locations.length} total locations`);

    // First, group locations by exact coordinates
    const coordGroups = new Map();
    
    locations.forEach(loc => {
      // Use exact coordinates as key
      const coordKey = `${loc.latitude},${loc.longitude}`;
      if (!coordGroups.has(coordKey)) {
        coordGroups.set(coordKey, []);
      }
      coordGroups.get(coordKey).push(loc);
    });

    // Find duplicates within coordinate groups
    const duplicateGroups = [];

    for (const [coordKey, coordLocations] of coordGroups) {
      if (coordLocations.length > 1) {
        console.log(`\nChecking locations at ${coordKey}:`);
        coordLocations.forEach(loc => {
          console.log(`- ${loc.title} (${loc.id})`);
        });

        // Compare titles within this coordinate group
        for (let i = 0; i < coordLocations.length; i++) {
          const loc1 = coordLocations[i];
          const group = [loc1];

          for (let j = i + 1; j < coordLocations.length; j++) {
            const loc2 = coordLocations[j];
            
            // Compare titles
            const similarity = stringSimilarity.compareTwoStrings(
              loc1.title.toLowerCase(),
              loc2.title.toLowerCase()
            );

            console.log(`\nComparing locations with same coordinates:
              Location 1: ${loc1.title} (${loc1.id})
              Location 2: ${loc2.title} (${loc2.id})
              Title Similarity: ${similarity.toFixed(3)}`);

            if (similarity > TITLE_SIMILARITY_THRESHOLD || loc1.title === loc2.title) {
              console.log('Found duplicate!');
              group.push(loc2);
            }
          }

          if (group.length > 1) {
            duplicateGroups.push(group);
            // Remove these locations from further comparisons
            coordLocations.splice(i + 1, group.length - 1);
          }
        }
      }
    }

    console.log(`\nFound ${duplicateGroups.length} groups of duplicates`);

    // Process each group of duplicates
    for (const group of duplicateGroups) {
      // Sort by created_at timestamp, newest first
      const sorted = group.sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return dateB - dateA;
      });

      const keeper = sorted[0];
      const duplicates = sorted.slice(1);
      
      console.log(`\nDuplicate group found:`);
      console.log(`Keeping most recent: ${keeper.title} (${keeper.id})`);
      console.log(`Created: ${keeper.created_at}`);
      console.log(`Location: ${keeper.latitude}, ${keeper.longitude}`);
      console.log('Older duplicates to remove:');
      duplicates.forEach(d => {
        console.log(`- ${d.title} (${d.id})`);
        console.log(`  Created: ${d.created_at}`);
        console.log(`  Location: ${d.latitude}, ${d.longitude}`);
      });

      if (!DRY_RUN) {
        console.log('\nDeleting duplicates...');
        for (const duplicate of duplicates) {
          const success = await deleteLocationAndRelatedRecords(duplicate.id);
          if (success) {
            console.log(`Successfully deleted: ${duplicate.title} (${duplicate.id})`);
          } else {
            console.log(`Failed to delete: ${duplicate.title} (${duplicate.id})`);
          }
        }
      } else {
        console.log('\nDRY RUN - No deletions performed');
      }
    }

    console.log('\nDuplicate removal complete!');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
removeDuplicates();
