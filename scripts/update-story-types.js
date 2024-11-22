const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

// Primary keywords that strongly indicate a type
const primaryKeywords = {
    music: [
        'concert hall', 'symphony orchestra', 'opera house', 'music venue',
        'recording studio', 'music festival', 'musical performance',
        'jazz club', 'concert venue', 'music school', 'conservatory',
        'performed music', 'musical tradition', 'music history'
    ],
    art: [
        'art gallery', 'art museum', 'exhibition space', 'artist studio',
        'sculpture garden', 'art collection', 'art institute',
        'art exhibition', 'art center', 'paintings', 'sculptures',
        'artistic movement', 'art history', 'visual arts'
    ],
    architecture: [
        'architectural landmark', 'historic building', 'architectural style',
        'structural design', 'architectural significance', 'construction technique',
        'architectural detail', 'building method', 'architectural movement',
        'architectural preservation', 'building restoration'
    ],
    fashion: [
        'fashion house', 'design studio', 'fashion district', 'textile industry',
        'clothing manufacture', 'fashion exhibition', 'costume collection',
        'fashion history', 'design school', 'fashion academy',
        'fashion design', 'clothing industry', 'fashion tradition'
    ],
    politics: [
        'government building', 'legislative hall', 'political landmark',
        'diplomatic site', 'political history', 'government headquarters',
        'political movement', 'state capitol', 'political event',
        'legislative history', 'political significance', 'seat of government'
    ],
    civilRights: [
        'civil rights landmark', 'freedom trail', 'rights movement site',
        'social justice site', 'protest location', 'civil rights history',
        'equality movement', 'civil rights leader', 'social movement site',
        'civil rights memorial', 'human rights landmark'
    ],
    education: [
        'historic school', 'university campus', 'educational institution',
        'learning center', 'academic building', 'historic college',
        'educational landmark', 'school history', 'academic history',
        'educational heritage', 'historic university'
    ]
};

// Supporting keywords that help confirm a type when combined with context
const supportingKeywords = {
    music: [
        'musician', 'composer', 'conductor', 'band', 'performance',
        'concert', 'musical instrument', 'orchestra', 'choir',
        'musical heritage', 'acoustics', 'melody'
    ],
    art: [
        'artist', 'curator', 'masterpiece', 'collection', 'exhibition',
        'gallery', 'museum', 'artwork', 'creative', 'aesthetic',
        'artistic', 'visual art'
    ],
    architecture: [
        'architect', 'design', 'construction', 'building', 'structure',
        'facade', 'restoration', 'preservation', 'architectural',
        'historic site', 'landmark'
    ],
    fashion: [
        'designer', 'textile', 'garment', 'style', 'clothing',
        'costume', 'fashion', 'trend', 'boutique', 'apparel',
        'dress', 'fabric'
    ],
    politics: [
        'politician', 'government', 'legislation', 'political',
        'democracy', 'administration', 'diplomatic', 'congress',
        'senate', 'parliament', 'governor'
    ],
    civilRights: [
        'activist', 'protest', 'equality', 'justice', 'rights',
        'discrimination', 'segregation', 'freedom', 'movement',
        'civil rights', 'social justice'
    ],
    education: [
        'professor', 'student', 'academic', 'education', 'teaching',
        'learning', 'research', 'study', 'scholarship', 'curriculum',
        'educational'
    ]
};

function analyzeStoryContent(content) {
    const storyText = (content?.story || '').toLowerCase();
    const facts = (content?.facts || []).map(fact => fact.toLowerCase()).join(' ');
    const fullText = `${storyText} ${facts}`;
    
    // First pass: Check for primary keywords
    const typeScores = {};
    for (const [type, keywords] of Object.entries(primaryKeywords)) {
        const primaryMatches = keywords.filter(keyword => 
            fullText.includes(keyword.toLowerCase())
        ).length;
        
        if (primaryMatches > 0) {
            typeScores[type] = primaryMatches * 2; // Primary keywords count double
        }
    }

    // Second pass: Check for supporting keywords
    for (const [type, keywords] of Object.entries(supportingKeywords)) {
        const supportingMatches = keywords.filter(keyword => 
            fullText.includes(keyword.toLowerCase())
        ).length;
        
        typeScores[type] = (typeScores[type] || 0) + supportingMatches;
    }

    // Get the top 2 types with highest scores
    const sortedTypes = Object.entries(typeScores)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 2)
        .filter(([,score]) => score >= 2) // Must have at least 2 matches
        .map(([type]) => type);

    // If no strong matches found, look for general historical significance
    if (sortedTypes.length === 0) {
        if (fullText.includes('historic') || fullText.includes('heritage') || 
            fullText.includes('landmark') || fullText.includes('preservation')) {
            sortedTypes.push('architecture');
        }
    }

    return sortedTypes;
}

async function updateStoryTypes() {
    try {
        console.log('Starting story type update...');
        
        const { data: stories, error } = await supabase
            .from('ai_generated_stories')
            .select('*');

        if (error) {
            throw error;
        }

        console.log(`Found ${stories.length} stories to process`);
        let updatedCount = 0;
        let errorCount = 0;
        let typeDistribution = {};

        for (const story of stories) {
            try {
                console.log(`\nProcessing story ID ${story.id}...`);
                
                let content = story.content;
                if (typeof content === 'string') {
                    content = JSON.parse(content);
                }

                const storyTypes = analyzeStoryContent(content);
                console.log('Detected story types:', storyTypes);

                // Track type distribution
                storyTypes.forEach(type => {
                    typeDistribution[type] = (typeDistribution[type] || 0) + 1;
                });

                content.storyTypes = storyTypes;
                
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
            } catch (storyError) {
                console.error(`Error processing story ${story.id}:`, storyError);
                errorCount++;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('\nStory type update complete!');
        console.log(`Successfully updated ${updatedCount} stories`);
        console.log(`Failed to update ${errorCount} stories`);
        console.log('\nType distribution:');
        Object.entries(typeDistribution)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
                const percentage = ((count / stories.length) * 100).toFixed(1);
                console.log(`${type}: ${count} stories (${percentage}%)`);
            });
    } catch (error) {
        console.error('Error updating story types:', error);
    }
}

updateStoryTypes();
