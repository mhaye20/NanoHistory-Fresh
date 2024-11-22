const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

// Available story types with descriptions
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

async function analyzeStoryWithAI(content, retryCount = 0) {
    const MAX_RETRIES = 2;
    
    try {
        const storyText = content?.story || '';
        const facts = content?.facts || [];
        const fullText = `${storyText}\n\nFacts:\n${facts.join('\n')}`;

        const prompt = `IMPORTANT: You must respond with ONLY a JSON object, no other text.

Task: Analyze this historical story and assign exactly TWO types from this list:

music: Stories about musical history, musicians, venues, or musical traditions
visualArt: Stories about paintings, sculptures, galleries, or visual artists
performingArt: Stories about theater, dance, performance venues, or performing artists
architecture: Stories about building design, architectural styles, or construction methods
fashion: Stories about clothing, style trends, fashion designers, or textile history
culinary: Stories about food history, restaurants, cooking traditions, or cuisine
landscape: Stories about parks, gardens, natural landmarks, or landscape design
lore: Mythical tales and folklore tied to the area.
paranormal: Stories about ghost sightings, supernatural events, or unexplained phenomena
unsungHero: ONLY for stories about specific individuals who made important but overlooked contributions to history
popCulture: Famous movies, books, or events inspired by the location
civilRights: Stories about equality movements, social justice, or civil rights activism
education: Stories about schools, libraries, educational institutions, or learning

Story Content:
${fullText}

REQUIRED FORMAT:
{
    "types": ["type1", "type2"],
    "explanations": {
        "type1": "reason for this type",
        "type2": "reason for this type"
    }
}

RULES:
1. Response must be valid JSON
2. Must choose exactly TWO types from the provided list
3. NO additional text before or after the JSON
4. NO markdown formatting
5. NO natural language responses
6. ONLY use 'unsungHero' if the story focuses on a specific person who made overlooked contributions`;

        const response = await fetch('https://micro-history.vercel.app/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                query: prompt,
                context: {
                    userProfile: {
                        interests: ['history']
                    }
                }
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to analyze story: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Extract the JSON string from the AI response
        const jsonMatch = data.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            if (retryCount < MAX_RETRIES) {
                console.log(`No JSON found in response, retrying (attempt ${retryCount + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return analyzeStoryWithAI(content, retryCount + 1);
            }
            throw new Error('No JSON found in AI response after retries');
        }

        const result = JSON.parse(jsonMatch[0]);
        
        // Validate and filter types
        const validTypes = result.types.filter(type => VALID_TYPES.includes(type));
        if (validTypes.length < 2) {
            if (retryCount < MAX_RETRIES) {
                console.log(`Not enough valid types found (${validTypes.length}), retrying (attempt ${retryCount + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return analyzeStoryWithAI(content, retryCount + 1);
            }
            throw new Error('Not enough valid types found after retries');
        }

        // Take exactly 2 types
        const finalTypes = validTypes.slice(0, 2);
        
        console.log('\nAI Analysis Results:');
        console.log('Types:', finalTypes);
        console.log('Explanations:');
        finalTypes.forEach(type => {
            console.log(`${type}: ${result.explanations[type]}`);
        });

        return finalTypes;
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            console.log(`Error occurred, retrying (attempt ${retryCount + 1})...`);
            console.log('Error details:', error.message);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return analyzeStoryWithAI(content, retryCount + 1);
        }
        console.error('Error analyzing story with AI:', error);
        console.error('Error details:', error.message);
        return [];
    }
}

async function updateStoryTypes() {
    try {
        console.log('Starting AI story type analysis...');
        
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
                    console.log('Story excerpt:', story.content?.story?.substring(0, 200) + '...');
                    
                    let content = story.content;
                    if (typeof content === 'string') {
                        content = JSON.parse(content);
                    }

                    // Get AI analysis with retries
                    const storyTypes = await analyzeStoryWithAI(content);

                    if (storyTypes.length === 2) {
                        // Track type distribution
                        storyTypes.forEach(type => {
                            typeDistribution[type] = (typeDistribution[type] || 0) + 1;
                        });

                        // Update the content with story types
                        content.storyTypes = storyTypes;
                        
                        // Update the story in the database
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
                    } else {
                        console.log('Failed to get valid types after retries, skipping update');
                        errorCount++;
                    }

                    // Add a delay between stories
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (storyError) {
                    console.error(`Error processing story ${story.id}:`, storyError);
                    errorCount++;
                    // Add longer delay after error
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            processedCount += stories.length;
            console.log(`\nProgress: ${processedCount}/${count} stories processed`);
        }

        console.log('\nAI story type analysis complete!');
        console.log(`Successfully updated ${updatedCount} stories`);
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
        console.error('Error updating story types:', error);
    }
}

// Run the update
updateStoryTypes();
