const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

// Function to analyze story content and determine its types
function determineStoryTypes(content) {
    // Log the story content for analysis
    console.log('\nAnalyzing story:');
    console.log('Story:', content.story?.substring(0, 200) + '...');
    console.log('Facts:', content.facts);
    
    const types = new Set();
    const fullText = `${content.story || ''} ${(content.facts || []).join(' ')}`.toLowerCase();

    // Music indicators
    if (
        fullText.includes('music') ||
        fullText.includes('concert') ||
        fullText.includes('orchestra') ||
        fullText.includes('opera') ||
        fullText.includes('performed') ||
        fullText.includes('theater') ||
        fullText.includes('symphony') ||
        fullText.includes('musician') ||
        fullText.includes('composer')
    ) {
        console.log('Music indicators found');
        types.add('music');
    }

    // Art indicators
    if (
        fullText.includes('art') ||
        fullText.includes('museum') ||
        fullText.includes('gallery') ||
        fullText.includes('exhibition') ||
        fullText.includes('painting') ||
        fullText.includes('sculpture') ||
        fullText.includes('artist') ||
        fullText.includes('artistic') ||
        fullText.includes('cultural')
    ) {
        console.log('Art indicators found');
        types.add('art');
    }

    // Fashion indicators
    if (
        fullText.includes('fashion') ||
        fullText.includes('textile') ||
        fullText.includes('clothing') ||
        fullText.includes('garment') ||
        fullText.includes('dress') ||
        fullText.includes('style') ||
        fullText.includes('design') ||
        fullText.includes('wore') ||
        fullText.includes('fabric')
    ) {
        console.log('Fashion indicators found');
        types.add('fashion');
    }

    // Politics indicators
    if (
        fullText.includes('politic') ||
        fullText.includes('government') ||
        fullText.includes('president') ||
        fullText.includes('congress') ||
        fullText.includes('governor') ||
        fullText.includes('legislation') ||
        fullText.includes('senator') ||
        fullText.includes('capitol') ||
        fullText.includes('administration')
    ) {
        console.log('Politics indicators found');
        types.add('politics');
    }

    // Civil Rights indicators
    if (
        fullText.includes('civil rights') ||
        fullText.includes('protest') ||
        fullText.includes('freedom') ||
        fullText.includes('equality') ||
        fullText.includes('segregation') ||
        fullText.includes('discrimination') ||
        fullText.includes('movement') ||
        fullText.includes('activist') ||
        fullText.includes('social justice')
    ) {
        console.log('Civil Rights indicators found');
        types.add('civilRights');
    }

    // Education indicators
    if (
        fullText.includes('education') ||
        fullText.includes('university') ||
        fullText.includes('school') ||
        fullText.includes('college') ||
        fullText.includes('student') ||
        fullText.includes('professor') ||
        fullText.includes('academic') ||
        fullText.includes('learning') ||
        fullText.includes('teaching')
    ) {
        console.log('Education indicators found');
        types.add('education');
    }

    // Architecture should only be added if the story specifically focuses on the building's design/structure
    if (
        fullText.includes('architect') ||
        fullText.includes('architectural style') ||
        fullText.includes('construction') ||
        fullText.includes('building design') ||
        fullText.includes('structural') ||
        fullText.includes('renovation') ||
        fullText.includes('restoration') ||
        (fullText.includes('building') && 
         (fullText.includes('design') || fullText.includes('style') || fullText.includes('structure')))
    ) {
        console.log('Architecture indicators found');
        types.add('architecture');
    }

    // Get user confirmation for the detected types
    const detectedTypes = Array.from(types);
    console.log('\nDetected types:', detectedTypes);
    
    // Ask for confirmation
    console.log('\nDoes this classification look correct? (y/n)');
    
    return detectedTypes;
}

async function updateStoryTypes() {
    try {
        console.log('Starting story type analysis...');
        
        const { data: stories, error } = await supabase
            .from('ai_generated_stories')
            .select('*');

        if (error) {
            throw error;
        }

        console.log(`Found ${stories.length} stories to analyze`);
        let updatedCount = 0;
        let errorCount = 0;

        for (const story of stories) {
            try {
                console.log(`\n=== Processing story ID ${story.id} ===`);
                
                let content = story.content;
                if (typeof content === 'string') {
                    content = JSON.parse(content);
                }

                // Analyze content and determine story types
                const storyTypes = determineStoryTypes(content);

                // Update the content with story types
                content.storyTypes = storyTypes;
                
                // Update the story with new content
                const { error: updateError } = await supabase
                    .from('ai_generated_stories')
                    .update({
                        content: content,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', story.id);

                if (updateError) {
                    throw updateError;
                }

                console.log('Successfully updated story types');
                updatedCount++;

                // Add a delay to allow time for review
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (storyError) {
                console.error(`Error processing story ${story.id}:`, storyError);
                errorCount++;
            }
        }

        console.log('\nStory type analysis complete!');
        console.log(`Successfully updated ${updatedCount} stories`);
        console.log(`Failed to update ${errorCount} stories`);
    } catch (error) {
        console.error('Error updating story types:', error);
    }
}

// Run the update
updateStoryTypes();
