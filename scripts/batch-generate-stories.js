const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase admin client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

// List of historically significant coordinates
// Format: [latitude, longitude, description]
const historicalCoordinates = [
    // New York City landmarks
    [40.7484, -73.9857, "Empire State Building"],
    [40.7527, -73.9772, "Grand Central Terminal"],
    [40.7484, -73.9857, "Times Square"],
    [40.7527, -73.9772, "Chrysler Building"],
    [40.7527, -73.9772, "New York Public Library"],
    
    // Washington DC landmarks
    [38.8977, -77.0365, "White House"],
    [38.8899, -77.0091, "US Capitol"],
    [38.8892, -77.0501, "Lincoln Memorial"],
    [38.8946, -77.0229, "Smithsonian Institution"],
    
    // Boston landmarks
    [42.3601, -71.0589, "Boston Common"],
    [42.3663, -71.0543, "USS Constitution"],
    [42.3604, -71.0547, "Faneuil Hall"],
    
    // Philadelphia landmarks
    [39.9526, -75.1652, "Independence Hall"],
    [39.9517, -75.1750, "Liberty Bell"],
    [39.9656, -75.1810, "Eastern State Penitentiary"],
    
    // Chicago landmarks
    [41.8827, -87.6233, "Willis Tower"],
    [41.8826, -87.6226, "Art Institute of Chicago"],
    [41.8919, -87.6089, "Navy Pier"],
    
    // San Francisco landmarks
    [37.8199, -122.4783, "Golden Gate Bridge"],
    [37.8270, -122.4230, "Alcatraz Island"],
    [37.7952, -122.4028, "Chinatown"],
    
    // Los Angeles landmarks
    [34.1184, -118.3004, "Hollywood Sign"],
    [34.0522, -118.2437, "Union Station"],
    [34.1381, -118.3534, "Griffith Observatory"],
    
    // New Orleans landmarks
    [29.9511, -90.0715, "French Quarter"],
    [29.9579, -90.0630, "St. Louis Cathedral"],
    [29.9431, -90.0704, "Jackson Square"],
    
    // Charleston landmarks
    [32.7765, -79.9311, "Fort Sumter"],
    [32.7876, -79.9353, "Charleston City Market"],
    [32.7714, -79.9300, "Rainbow Row"],
    
    // Savannah landmarks
    [32.0809, -81.0912, "Forsyth Park"],
    [32.0835, -81.0998, "Mercer Williams House"],
    [32.0814, -81.0912, "Bonaventure Cemetery"],
];

async function initializeLocation(latitude, longitude) {
    const response = await fetch('https://micro-history.vercel.app/api/initialize-locations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latitude, longitude }),
    });

    if (!response.ok) {
        throw new Error(`Failed to initialize location: ${response.statusText}`);
    }

    const data = await response.json();

    // Store locations and stories in Supabase
    for (const item of data.locations) {
        // Create location
        const { data: location, error: locationError } = await supabase
            .from('locations')
            .insert([item.location])
            .select()
            .single();

        if (locationError) {
            throw locationError;
        }

        // Create AI story
        const { error: storyError } = await supabase
            .from('ai_generated_stories')
            .insert([{
                location_id: location.id,
                content: item.story,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }]);

        if (storyError) {
            throw storyError;
        }
    }

    return data;
}

async function batchGenerateStories() {
    console.log('Starting batch story generation...');
    let successCount = 0;
    let failureCount = 0;

    for (const [latitude, longitude, description] of historicalCoordinates) {
        try {
            console.log(`Generating stories for ${description} (${latitude}, ${longitude})`);
            await initializeLocation(latitude, longitude);
            console.log(`Successfully generated stories for ${description}`);
            successCount++;
            
            // Add a delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error(`Failed to generate stories for ${description}:`, error);
            failureCount++;
        }
    }

    console.log('\nBatch generation complete!');
    console.log(`Successfully generated stories for ${successCount} locations`);
    console.log(`Failed to generate stories for ${failureCount} locations`);
}

// Run the batch generation
batchGenerateStories();
