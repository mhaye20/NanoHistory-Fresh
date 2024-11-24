const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

// Available story types with strict criteria
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

async function enhanceStoryContent(content, retryCount = 0) {
    const MAX_RETRIES = 2;
    
    try {
        const storyText = content?.story || '';
        const facts = content?.facts || [];
        const fullText = `${storyText}\n\nFacts:\n${facts.join('\n')}`;

        const prompt = `IMPORTANT: You must respond with ONLY a JSON object, no other text or formatting.

Task: Enhance this location's story by adding more diverse and interesting historical details beyond architectural descriptions. Focus on the human elements, cultural significance, and varied historical aspects of the location.

Current Story:
${fullText}

REQUIREMENTS:
1. Maintain historical accuracy and use the provided facts
2. Add interesting details about:
   - Cultural significance and community impact
   - Notable events or gatherings
   - Historical figures connected to the location
   - Social and cultural activities that occurred there
   - Local traditions or customs associated with the place
   - Any artistic, musical, or performance history
   - Food and culinary traditions if relevant
   - Social movements or civil rights connections
3. Keep architectural details but don't let them dominate the narrative
4. Maintain a similar length to the original story
5. Write in an engaging, story-like format

REQUIRED FORMAT:
{
    "story": "Enhanced story text here",
    "facts": ["Fact 1", "Fact 2", ...]
}

STRICT RULES:
1. Response must be ONLY the JSON object
2. NO text before or after the JSON
3. NO markdown formatting
4. NO natural language responses
5. NO explanations or additional content`;

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
            throw new Error(`Failed to enhance story: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Extract the JSON string from the AI response
        const jsonMatch = data.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            if (retryCount < MAX_RETRIES) {
                console.log(`No JSON found in response, retrying enhancement (attempt ${retryCount + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return enhanceStoryContent(content, retryCount + 1);
            }
            console.log('Failed to enhance story after retries, keeping original content');
            return content;
        }

        try {
            const result = JSON.parse(jsonMatch[0]);
            
            // Validate the enhanced content
            if (!result.story || !result.facts || !Array.isArray(result.facts)) {
                throw new Error('Invalid enhanced content structure');
            }
            
            // Ensure we got actual content, not empty or tiny content
            if (result.story.length < 100 || result.facts.length === 0) {
                throw new Error('Enhanced content too short or missing facts');
            }

            return result;
        } catch (parseError) {
            if (retryCount < MAX_RETRIES) {
                console.log(`Invalid JSON structure, retrying enhancement (attempt ${retryCount + 1})...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return enhanceStoryContent(content, retryCount + 1);
            }
            console.log('Failed to parse enhanced content after retries, keeping original content');
            return content;
        }
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            console.log(`Error enhancing story, retrying (attempt ${retryCount + 1})...`);
            console.log('Error details:', error.message);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return enhanceStoryContent(content, retryCount + 1);
        }
        console.error('Error enhancing story:', error);
        console.log('Keeping original content due to enhancement failure');
        return content;
    }
}

async function analyzeStoryWithAI(content, retryCount = 0) {
    const MAX_RETRIES = 2;
    
    try {
        const storyText = content?.story || '';
        const facts = content?.facts || [];
        const fullText = `${storyText}\n\nFacts:\n${facts.join('\n')}`;

        const prompt = `IMPORTANT: You are a STRICT historical content classifier. You must respond with ONLY a JSON object, no other text.

Task: Analyze this historical story and assign ONE or TWO most relevant types from the list below. Only assign a type if the story STRONGLY matches the criteria. It's better to assign fewer types than to assign inappropriate ones.

STRICT TYPE CRITERIA:

music: ONLY if the story primarily focuses on musicians, musical performances, music venues, or significant musical traditions. NOT for stories that merely mention music in passing.

visualArt: ONLY for stories centered on visual artwork, artists, galleries, or artistic movements. Must involve creation or display of visual art. NOT for decorative elements or architectural features.

performingArt: ONLY for stories about theatrical productions, dance performances, or performing artists. Must involve live performance arts. NOT for general entertainment or social gatherings.

architecture: ONLY for stories where building design, construction methods, or architectural significance is the main focus. NOT for stories that simply take place in or mention buildings. The story must be PRIMARILY about the architectural aspects.

fashion: ONLY for stories specifically about clothing design, fashion trends, designers, or textile history. NOT for casual mentions of what people wore.

culinary: ONLY for stories centered on food preparation, restaurants, specific dishes, or cooking traditions. NOT for stories that merely mention food or dining.

landscape: ONLY for stories about significant natural features, designed gardens, parks, or environmental landmarks. NOT for stories that simply take place outdoors.

lore: ONLY for stories involving well-documented local legends, cultural traditions, or folklore. Must be tied to local heritage. NOT for recent events or general history.

paranormal: ONLY for stories involving reported supernatural occurrences, ghost sightings, or unexplained phenomena. Must have historical documentation. NOT for fictional tales.

unsungHero: ONLY for stories about specific individuals who made verifiable but overlooked historical contributions. Must focus on the person's achievements. NOT for stories about well-known figures or general community members.

popCulture: ONLY for stories about significant entertainment, media events, or cultural phenomena that had lasting impact. NOT for routine entertainment or local events.

civilRights: ONLY for stories directly involving equality movements, social justice activism, or civil rights progress. NOT for general social history or community events.

education: ONLY for stories centered on learning institutions, educational methods, or significant teaching initiatives. NOT for stories that merely mention schools or learning.

Story Content:
${fullText}

REQUIRED FORMAT:
{
    "types": ["type1"] or ["type1", "type2"],
    "explanations": {
        "type1": "Detailed reason why this STRICTLY matches the type criteria",
        "type2": "Detailed reason why this STRICTLY matches the type criteria (if second type assigned)"
    }
}

STRICT RULES:
1. Response must be valid JSON
2. Assign ONLY types that STRONGLY match the criteria (1-2 types maximum)
3. If no types strongly match, return an empty types array
4. NO additional text before or after the JSON
5. NO markdown formatting
6. NO natural language responses
7. Better to assign NO types than to assign inappropriate ones
8. Do NOT assign 'architecture' type unless the story is PRIMARILY about architectural design/features`;

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
        
        // Validate types
        const validTypes = result.types.filter(type => VALID_TYPES.includes(type));
        
        // Accept 0-2 valid types (no longer requiring exactly 2)
        if (validTypes.length > 2) {
            validTypes.length = 2; // Trim to maximum of 2 types
        }

        console.log('\nAI Analysis Results:');
        console.log('Types:', validTypes);
        console.log('Explanations:');
        validTypes.forEach(type => {
            console.log(`${type}: ${result.explanations[type]}`);
        });

        return validTypes;
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
        console.log('Starting story enhancement and type analysis...');
        
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
        let enhancementFailures = 0;
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
                    console.log('Original story excerpt:', story.content?.story?.substring(0, 200) + '...');
                    
                    let content = story.content;
                    if (typeof content === 'string') {
                        content = JSON.parse(content);
                    }

                    // First enhance the story content
                    console.log('Enhancing story content...');
                    const enhancedContent = await enhanceStoryContent(content);
                    
                    // Check if enhancement was successful
                    const wasEnhanced = enhancedContent !== content;
                    if (!wasEnhanced) {
                        console.log('Story enhancement failed, using original content');
                        enhancementFailures++;
                    } else {
                        console.log('Enhanced story excerpt:', enhancedContent.story.substring(0, 200) + '...');
                    }

                    // Then analyze the story for types
                    console.log('Analyzing story for types...');
                    const storyTypes = await analyzeStoryWithAI(enhancedContent);

                    // Track type distribution (including stories with no types)
                    if (storyTypes.length === 0) {
                        typeDistribution['no_type'] = (typeDistribution['no_type'] || 0) + 1;
                    } else {
                        storyTypes.forEach(type => {
                            typeDistribution[type] = (typeDistribution[type] || 0) + 1;
                        });
                    }

                    // Remove storyTypes from content if it exists
                    const { storyTypes: removed, ...newContent } = enhancedContent;
                    
                    // Update both story content and types
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

                    console.log('Successfully updated story content and types:', storyTypes);
                    updatedCount++;

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
            console.log(`Updated: ${updatedCount}, Errors: ${errorCount}, Enhancement Failures: ${enhancementFailures}`);
        }

        console.log('\nStory enhancement and type analysis complete!');
        console.log(`Successfully updated ${updatedCount} stories`);
        console.log(`Failed to update ${errorCount} stories`);
        console.log(`Failed to enhance ${enhancementFailures} stories`);
        
        // Print type distribution
        console.log('\nType Distribution:');
        Object.entries(typeDistribution)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
                const percentage = ((count / updatedCount) * 100).toFixed(1);
                console.log(`${type}: ${count} stories (${percentage}%)`);
            });
    } catch (error) {
        console.error('Error updating stories:', error);
    }
}

// Run the update
updateStoryTypes();
