const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

// Available story types
const VALID_TYPES = [
    'music',          // Stories about musical history, musicians, venues, or musical traditions
    'visualArt',      // Stories about paintings, sculptures, galleries, or visual artists
    'performingArt',  // Stories about theater, dance, performance venues, or performing artists
    'architecture',   // Stories about building design, architectural styles, or construction methods
    'fashion',        // Stories about clothing, style trends, fashion designers, or textile history
    'culinary',       // Stories about food history, restaurants, cooking traditions, or cuisine
    'landscape',      // Stories about parks, gardens, natural landmarks, or landscape design
    'lore',           // Stories about local legends, traditions, or cultural heritage
    'paranormal',     // Stories about ghost sightings, supernatural events, or unexplained phenomena
    'unsungHero',     // ONLY for stories about specific individuals who made important but overlooked contributions
    'popCulture',     // Stories about entertainment, media, trends, or cultural phenomena
    'civilRights',    // Stories about equality movements, social justice, or civil rights activism
    'education'       // Stories about schools, libraries, educational institutions, or learning
];

async function fixStoryTypes() {
    try {
        console.log('Starting story type cleanup...');
        
        // Get total count first
        const { count, error: countError } = await supabase
            .from('ai_generated_stories')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            throw countError;
        }

        console.log(`Total stories to process: ${count}`);
        
        let processedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let typeDistribution = {};

        // Process in batches of 1000
        while (processedCount < count) {
            const { data: stories, error } = await supabase
                .from('ai_generated_stories')
                .select('*')
                .range(processedCount, processedCount + 999);

            if (error) {
                throw error;
            }

            console.log(`\nProcessing batch of ${stories.length} stories (${processedCount + 1} to ${processedCount + stories.length} of ${count})`);

            for (const story of stories) {
                try {
                    console.log(`\n=== Processing story ID ${story.id} ===`);
                    
                    let content = story.content;
                    if (typeof content === 'string') {
                        content = JSON.parse(content);
                    }

                    // Check if story types exist in content
                    const contentTypes = content?.storyTypes || content?.story_types;
                    if (!contentTypes) {
                        console.log('No story types in content object, skipping...');
                        skippedCount++;
                        continue;
                    }

                    console.log('Found story types in content:', contentTypes);

                    // Filter to valid types
                    const validTypes = Array.isArray(contentTypes) 
                        ? contentTypes.filter(type => VALID_TYPES.includes(type))
                        : [];

                    // Take exactly 2 types
                    const finalTypes = validTypes.slice(0, 2);

                    // Track type distribution
                    finalTypes.forEach(type => {
                        typeDistribution[type] = (typeDistribution[type] || 0) + 1;
                    });

                    // Remove story types from content
                    delete content.storyTypes;
                    delete content.story_types;

                    // Update the record
                    const { error: updateError } = await supabase
                        .from('ai_generated_stories')
                        .update({
                            content: content,
                            story_types: finalTypes,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', story.id);

                    if (updateError) {
                        throw updateError;
                    }

                    console.log('Successfully moved story types to dedicated column');
                    updatedCount++;

                } catch (storyError) {
                    console.error(`Error processing story ${story.id}:`, storyError);
                    errorCount++;
                }
            }

            processedCount += stories.length;
            console.log(`\nProgress: ${processedCount}/${count} stories processed`);
            console.log(`Updated: ${updatedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
        }

        console.log('\nStory type cleanup complete!');
        console.log(`Successfully updated ${updatedCount} stories`);
        console.log(`Skipped ${skippedCount} stories (no content types to move)`);
        console.log(`Failed to update ${errorCount} stories`);
        
        // Print type distribution
        console.log('\nType Distribution:');
        Object.entries(typeDistribution)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
                const percentage = ((count / (updatedCount * 2)) * 100).toFixed(1);
                console.log(`${type}: ${count} stories (${percentage}%)`);
            });
    } catch (error) {
        console.error('Error fixing story types:', error);
    }
}

// Run the update
fixStoryTypes();
