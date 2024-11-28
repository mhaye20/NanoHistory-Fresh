const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase admin client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

// Updated to match ExploreScreen's storyTypeIcons
const VALID_TYPES = [
    'music',          // Stories about musical history, musicians, venues, or musical traditions
    'visualArt',      // Stories about paintings, sculptures, galleries, or visual artists
    'performingArt',  // Stories about theater, dance, performance venues, or performing artists
    'architecture',   // Stories about building design, architectural styles, or construction methods
    'fashion',        // Stories about clothing, style trends, fashion designers, or textile history
    'culinary',       // Stories about food history, restaurants, cooking traditions, or cuisine
    'landscape',      // Stories about parks, gardens, natural landmarks, or landscape design
    'lore',          // Mythical tales and folklore tied to the area
    'paranormal',     // Stories about ghost sightings, supernatural events, or unexplained phenomena
    'unsungHero',     // ONLY for stories about specific individuals who made important but overlooked contributions
    'popCulture',     // Famous movies, books, or events inspired by the location
    'civilRights',    // Stories about equality movements, social justice, or civil rights activism
    'education'       // Stories about schools, libraries, educational institutions, or learning
];

// List of all US states
const states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
    'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
    'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
    'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
    'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
    'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

async function getHistoricalLocations(state, minLocations = 10) {
    console.log(`Finding historical locations in ${state}...`);
    
    const searchQueries = [
        `historical landmarks in ${state}`,
        `museums in ${state}`,
        `historic buildings in ${state}`,
        `historic sites in ${state}`,
        `national monuments in ${state}`,
        `historic districts in ${state}`,
        `cultural centers in ${state}`,
        `historic theaters in ${state}`,
        `historic universities in ${state}`,
        `historic churches in ${state}`
    ];

    const locations = [];
    
    for (const query of searchQueries) {
        if (locations.length >= minLocations) break;

        const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;
        
        try {
            const response = await fetch(placesUrl);
            const data = await response.json();

            if (data.status === 'OK' && data.results) {
                for (const place of data.results) {
                    if (locations.length >= minLocations) break;

                    // Check if we already have this location
                    const isDuplicate = locations.some(loc => 
                        Math.abs(loc.latitude - place.geometry.location.lat) < 0.0001 &&
                        Math.abs(loc.longitude - place.geometry.location.lng) < 0.0001
                    );

                    if (!isDuplicate) {
                        // Randomly assign exactly 2 story types to each location
                        const shuffledTypes = [...VALID_TYPES].sort(() => Math.random() - 0.5);
                        const selectedTypes = shuffledTypes.slice(0, 2);

                        locations.push({
                            latitude: place.geometry.location.lat,
                            longitude: place.geometry.location.lng,
                            description: place.name,
                            suggestedTypes: selectedTypes
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Error fetching places for query "${query}":`, error);
        }

        // Add delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Found ${locations.length} locations in ${state}`);
    return locations;
}

async function checkLocationExists(latitude, longitude) {
    try {
        const { data, error } = await supabase.rpc('calculate_distances', {
            lat: latitude,
            lng: longitude,
            radius_meters: 100
        });

        if (error) {
            console.error('Error checking location:', error);
            return false;
        }

        return data && data.length > 0;
    } catch (error) {
        console.error('Error in checkLocationExists:', error);
        return false;
    }
}

function generateStoryPrompt(location, suggestedTypes) {
    const typePrompts = {
        music: "Focus on the musical heritage, concerts, performances, and musical traditions associated with this location. Include details about local musicians, music venues, festivals, and how music has shaped the cultural landscape.",
        visualArt: "Emphasize the visual art significance, including paintings, sculptures, galleries, museums, local artists, and artistic movements that have connections to this place.",
        performingArt: "Detail the performing arts history, including theater productions, dance performances, notable performers, and the venue's role in the performing arts community.",
        architecture: "Detail the architectural features, building styles, construction history, and the architects or designers involved with this location.",
        fashion: "Explore the fashion history, textile traditions, clothing styles, and fashion-related events or personalities connected to this area.",
        culinary: "Focus on the food history, restaurants, cooking traditions, local cuisine, and culinary innovations associated with this location.",
        landscape: "Describe the natural or designed landscape features, including parks, gardens, scenic views, and how they've shaped the area's character.",
        lore: "Share mythical tales and folklore tied to this area, including local legends and traditional stories passed down through generations.",
        paranormal: "Explore any reported ghost sightings, supernatural events, or unexplained phenomena associated with this location.",
        unsungHero: "Focus on specific individuals who made important but overlooked contributions to this location's history and development.",
        popCulture: "Highlight any famous movies, books, or events that were inspired by or took place at this location.",
        civilRights: "Focus on civil rights history, social justice movements, equality struggles, and community activism that occurred here.",
        education: "Detail the educational history, learning institutions, teaching traditions, and academic achievements associated with this place."
    };

    const typeSpecificPrompts = suggestedTypes
        .map(type => typePrompts[type])
        .join('\n\n');

    return `Generate a rich, detailed historical story about ${location}. 
    
    ${typeSpecificPrompts}
    
    Include specific details about:
    - The location's historical significance
    - Notable events and people
    - Cultural impact and community role
    - Modern relevance and preservation
    
    Return in this JSON format:
    {
        "story": "Detailed historical narrative incorporating the requested focus areas",
        "facts": ["Interesting fact 1", "Interesting fact 2", "Interesting fact 3"],
        "historicalPeriods": ["Relevant historical periods"],
        "suggestedActivities": ["Activity 1", "Activity 2", "Activity 3"]
    }`;
}

async function initializeLocation(latitude, longitude, description, suggestedTypes) {
    const exists = await checkLocationExists(latitude, longitude);
    if (exists) {
        console.log('Location already exists in database, skipping...');
        return null;
    }

    const customPrompt = generateStoryPrompt(description, suggestedTypes);

    const response = await fetch('https://micro-history.vercel.app/api/initialize-locations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            latitude, 
            longitude,
            customPrompt
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to initialize location: ${response.statusText}`);
    }

    const data = await response.json();

    for (const item of data.locations) {
        const { data: location, error: locationError } = await supabase
            .from('locations')
            .insert([item.location])
            .select()
            .single();

        if (locationError) {
            throw locationError;
        }

        const processedStory = processStoryContent(item.story);
        
        const { error: storyError } = await supabase
            .from('ai_generated_stories')
            .insert([{
                location_id: location.id,
                content: processedStory,
                story_types: suggestedTypes,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }]);

        if (storyError) {
            throw storyError;
        }
    }

    return data;
}

function processStoryContent(storyData) {
    try {
        const content = storyData?.content || storyData;
        
        return {
            story: content?.story || '',
            facts: Array.isArray(content?.facts) ? content.facts : [],
            historicalPeriods: Array.isArray(content?.historicalPeriods) ? content.historicalPeriods : [],
            suggestedActivities: Array.isArray(content?.suggestedActivities) ? content.suggestedActivities : [],
            imageUrl: content?.imageUrl
        };
    } catch (error) {
        console.error('Error processing story content:', error);
        return {
            story: 'Error processing story content',
            facts: [],
            historicalPeriods: [],
            suggestedActivities: []
        };
    }
}

async function batchGenerateStories() {
    console.log('Starting batch story generation...');
    let totalSuccess = 0;
    let totalFailure = 0;
    let totalSkipped = 0;
    let typeDistribution = {};

    for (const state of states) {
        console.log(`\nProcessing state: ${state}`);
        
        try {
            const locations = await getHistoricalLocations(state);
            
            for (const location of locations) {
                try {
                    console.log(`Processing ${location.description} (${location.latitude}, ${location.longitude})`);
                    
                    const exists = await checkLocationExists(location.latitude, location.longitude);
                    if (exists) {
                        console.log(`Skipping ${location.description} - already exists in database`);
                        totalSkipped++;
                        continue;
                    }

                    console.log(`Generating stories for ${location.description} with types: ${location.suggestedTypes.join(', ')}`);
                    await initializeLocation(
                        location.latitude,
                        location.longitude,
                        location.description,
                        location.suggestedTypes
                    );

                    // Track type distribution
                    location.suggestedTypes.forEach(type => {
                        typeDistribution[type] = (typeDistribution[type] || 0) + 1;
                    });

                    console.log(`Successfully generated stories for ${location.description}`);
                    totalSuccess++;
                    
                    // Add delay between locations
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    console.error(`Failed to generate stories for ${location.description}:`, error);
                    totalFailure++;
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        } catch (error) {
            console.error(`Error processing state ${state}:`, error);
        }

        // Add delay between states
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log('\nBatch generation complete!');
    console.log(`Successfully generated stories for ${totalSuccess} locations`);
    console.log(`Skipped ${totalSkipped} existing locations`);
    console.log(`Failed to generate stories for ${totalFailure} locations`);

    // Print type distribution
    console.log('\nType Distribution:');
    Object.entries(typeDistribution)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
            const percentage = ((count / (totalSuccess * 2)) * 100).toFixed(1);
            console.log(`${type}: ${count} stories (${percentage}%)`);
        });
}

// Run the batch generation
batchGenerateStories();
