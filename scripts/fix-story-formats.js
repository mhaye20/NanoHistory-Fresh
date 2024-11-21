const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase admin client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

function processStoryContent(storyData) {
    try {
        console.log('Processing story:', {
            type: typeof storyData,
            isNull: storyData === null,
            keys: storyData ? Object.keys(storyData) : []
        });

        // If story is a string, try to parse it
        if (typeof storyData === 'string') {
            try {
                storyData = JSON.parse(storyData);
            } catch (e) {
                console.log('Story is a plain string, wrapping in structure');
                return {
                    story: storyData,
                    facts: [],
                    historicalPeriods: [],
                    suggestedActivities: []
                };
            }
        }

        // Extract content from various possible structures
        let content = storyData;
        
        // Handle nested content structure
        if (storyData?.story?.content) {
            content = storyData.story.content;
        } else if (storyData?.content) {
            content = storyData.content;
        }

        // Log the extracted content
        console.log('Extracted content:', {
            hasStory: !!content?.story,
            hasFacts: Array.isArray(content?.facts),
            hasHistoricalPeriods: Array.isArray(content?.historicalPeriods),
            hasActivities: Array.isArray(content?.suggestedActivities)
        });

        // Return properly structured content
        return {
            story: content?.story || '',
            facts: Array.isArray(content?.facts) ? content.facts : [],
            historicalPeriods: Array.isArray(content?.historicalPeriods) ? content.historicalPeriods : [],
            suggestedActivities: Array.isArray(content?.suggestedActivities) ? content.suggestedActivities : [],
            imageUrl: content?.imageUrl
        };
    } catch (error) {
        console.error('Error processing story:', error);
        return {
            story: 'Error processing story content',
            facts: [],
            historicalPeriods: [],
            suggestedActivities: []
        };
    }
}

async function fixStoryFormats() {
    try {
        console.log('Starting story format fix...');
        
        // Get all AI generated stories
        const { data: stories, error } = await supabase
            .from('ai_generated_stories')
            .select('*');

        if (error) {
            throw error;
        }

        console.log(`Found ${stories.length} stories to process`);
        let fixedCount = 0;
        let errorCount = 0;

        // Process each story
        for (const story of stories) {
            try {
                console.log(`\nProcessing story for location ${story.location_id}...`);
                
                // Process the story content
                const processedContent = processStoryContent(story.content);
                
                // Update the story with processed content
                const { error: updateError } = await supabase
                    .from('ai_generated_stories')
                    .update({
                        content: processedContent,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', story.id);

                if (updateError) {
                    throw updateError;
                }

                console.log('Successfully updated story format');
                fixedCount++;
            } catch (storyError) {
                console.error(`Error processing story ${story.id}:`, storyError);
                errorCount++;
            }

            // Add a small delay between updates
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('\nStory format fix complete!');
        console.log(`Successfully fixed ${fixedCount} stories`);
        console.log(`Failed to fix ${errorCount} stories`);
    } catch (error) {
        console.error('Error fixing story formats:', error);
    }
}

// Run the fix
fixStoryFormats();
