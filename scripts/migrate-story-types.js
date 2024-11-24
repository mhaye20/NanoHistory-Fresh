const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

async function migrateStoryTypes() {
    try {
        console.log('Starting story types migration...');
        
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
        let errorCount = 0;

        // Process in batches of 100
        while (processedCount < count) {
            const { data: stories, error } = await supabase
                .from('ai_generated_stories')
                .select('*')
                .range(processedCount, processedCount + 99);

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

                    // Extract story types from content
                    const storyTypes = content.storyTypes || [];
                    console.log('Found story types:', storyTypes);

                    if (storyTypes.length > 0) {
                        // Create new content object without storyTypes
                        const { storyTypes: removed, ...newContent } = content;

                        // Update the story with new content and story_types
                        const { error: updateError } = await supabase
                            .from('ai_generated_stories')
                            .update({
                                content: newContent,
                                story_types: storyTypes,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', story.id);

                        if (updateError) {
                            throw updateError;
                        }

                        console.log('Successfully migrated story types');
                        updatedCount++;
                    } else {
                        console.log('No story types found in content, skipping');
                    }

                } catch (storyError) {
                    console.error(`Error processing story ${story.id}:`, storyError);
                    errorCount++;
                }
            }

            processedCount += stories.length;
            console.log(`\nProgress: ${processedCount}/${count} stories processed`);
            console.log(`Updated: ${updatedCount}, Errors: ${errorCount}`);
        }

        console.log('\nStory types migration complete!');
        console.log(`Successfully updated ${updatedCount} stories`);
        console.log(`Failed to update ${errorCount} stories`);

    } catch (error) {
        console.error('Error migrating story types:', error);
    }
}

// Run the migration
migrateStoryTypes();
