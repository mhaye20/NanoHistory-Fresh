const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

const VALID_TYPES = [
    'music', 'visualArt', 'performingArt', 'architecture', 'fashion',
    'culinary', 'landscape', 'lore', 'paranormal', 'unsungHero',
    'popCulture', 'civilRights', 'education'
];

const BATCH_SIZE = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;
const PAGE_SIZE = 1000;  // Supabase's max page size

function cleanJsonString(str) {
    str = str.replace(/```json\s*/g, '')
             .replace(/```\s*/g, '');
    str = str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    str = str.replace(/\n/g, '\\n')
             .replace(/\r/g, '\\r')
             .replace(/\t/g, '\\t')
             .replace(/\\"/g, '"')
             .replace(/\\\\/g, '\\');
    return str;
}

function extractJsonFromResponse(text) {
    if (text.includes("I apologize") || text.includes("having trouble")) {
        return null;
    }

    const cleaned = cleanJsonString(text);
    
    const patterns = [
        /\{[\s\S]*\}/,
        /\[\s*\{[\s\S]*\}\s*\]/,
        /\{[^{}]*\}/
    ];

    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match) {
            try {
                return JSON.parse(match[0]);
            } catch (e) {
                console.log('Failed to parse with pattern:', pattern);
            }
        }
    }
    
    return null;
}

async function processStory(story, retryCount = 0) {
    try {
        console.log(`\nProcessing story ID ${story.id} (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
        console.log('Current story_types:', story.story_types);
        
        const storyText = story.content?.story || '';
        const facts = story.content?.facts || [];
        const fullText = `${storyText}\n\nFacts:\n${facts.join('\n')}`;

        const prompt = `IMPORTANT: Respond with ONLY a valid JSON object. No markdown, no additional text.

Task: Enhance and classify this historical story.

Story Content:
${fullText}

REQUIRED JSON FORMAT:
{
    "enhanced": {
        "story": "Enhanced story text",
        "facts": ["Fact 1", "Fact 2"]
    },
    "analysis": {
        "types": ["type1"],
        "explanations": {
            "type1": "Reason"
        }
    }
}

Requirements:
1. Story Types: Choose 1-2 from [${VALID_TYPES.join(', ')}]
2. Keep story length similar to original
3. Maintain historical accuracy
4. Focus on cultural significance and human elements
5. Include architectural details only if relevant`;

        const response = await fetch('https://micro-history.vercel.app/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: prompt,
                context: { userProfile: { interests: ['history'] } }
            }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Raw API response:', data.text.substring(0, 100) + '...');
        
        const result = extractJsonFromResponse(data.text);
        if (!result) {
            if (retryCount < MAX_RETRIES - 1) {
                console.log(`Retrying story ${story.id} after delay...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                return processStory(story, retryCount + 1);
            }
            throw new Error('Could not extract valid JSON from response after retries');
        }
        
        if (!result.enhanced?.story || !result.enhanced?.facts || !result.analysis?.types) {
            throw new Error('Invalid response structure');
        }

        const validTypes = result.analysis.types
            .filter(type => VALID_TYPES.includes(type))
            .slice(0, 2);

        const { error: updateError } = await supabase
            .from('ai_generated_stories')
            .update({
                content: result.enhanced,
                story_types: validTypes,
                updated_at: new Date().toISOString()
            })
            .eq('id', story.id);

        if (updateError) {
            throw updateError;
        }

        console.log(`Successfully processed story ${story.id} with types:`, validTypes);
        return {
            id: story.id,
            success: true,
            types: validTypes
        };

    } catch (error) {
        console.error(`Error processing story ${story.id}:`, error.message);
        return {
            id: story.id,
            success: false,
            error: error.message
        };
    }
}

async function getAllStories() {
    let allStories = [];
    let start = 0;
    let hasMore = true;

    while (hasMore) {
        const { data: stories, error } = await supabase
            .from('ai_generated_stories')
            .select('id, story_types')
            .range(start, start + PAGE_SIZE - 1);

        if (error) throw error;

        if (stories.length < PAGE_SIZE) {
            hasMore = false;
        }

        allStories = allStories.concat(stories);
        start += PAGE_SIZE;

        console.log(`Fetched ${allStories.length} stories so far...`);
    }

    return allStories;
}

async function updateStoryTypes() {
    try {
        console.log('Starting optimized story enhancement and type analysis...');
        
        // Get all stories using pagination
        console.log('Fetching all stories...');
        const allStories = await getAllStories();
        console.log(`Total stories fetched: ${allStories.length}`);

        // Filter stories that need processing
        const storiesToProcess = allStories.filter(story => {
            // Convert story_types to string for comparison if it's not already
            const typesStr = Array.isArray(story.story_types) 
                ? JSON.stringify(story.story_types) 
                : String(story.story_types);
            
            return typesStr === '[]' || typesStr === '{}' || typesStr === 'null' || !story.story_types;
        });

        const count = storiesToProcess.length;
        console.log(`Found ${count} stories that need processing`);
        console.log('Stories to process:', storiesToProcess.map(s => ({
            id: s.id,
            story_types: s.story_types
        })));
        
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        let typeDistribution = {};

        // Process stories in batches
        for (let i = 0; i < count; i += BATCH_SIZE) {
            const batchIds = storiesToProcess.slice(i, i + BATCH_SIZE).map(s => s.id);
            
            const { data: stories, error } = await supabase
                .from('ai_generated_stories')
                .select('*')
                .in('id', batchIds);

            if (error) {
                throw error;
            }

            for (const story of stories) {
                const result = await processStory(story);
                
                if (result.success) {
                    successCount++;
                    result.types.forEach(type => {
                        typeDistribution[type] = (typeDistribution[type] || 0) + 1;
                    });
                } else {
                    errorCount++;
                }
                
                processedCount++;
                const percentComplete = ((processedCount / count) * 100).toFixed(1);
                console.log(`\nProgress: ${processedCount}/${count} stories (${percentComplete}%)`);
                console.log(`Successful: ${successCount}, Failed: ${errorCount}`);
                
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.log('\nProcessing complete!');
        console.log(`Successfully processed: ${successCount} stories`);
        console.log(`Failed to process: ${errorCount} stories`);
        
        console.log('\nType Distribution:');
        Object.entries(typeDistribution)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
                const percentage = ((count / successCount) * 100).toFixed(1);
                console.log(`${type}: ${count} stories (${percentage}%)`);
            });

    } catch (error) {
        console.error('Fatal error:', error);
    }
}

updateStoryTypes();
