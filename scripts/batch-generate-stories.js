const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase admin client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

// List of historically significant coordinates across multiple states
// Format: [latitude, longitude, description]
const historicalCoordinates = [
    // Montana Historical Sites
    [48.7500, -113.7500, "Glacier National Park, West Glacier"],
    [45.0333, -110.7000, "Yellowstone National Park, Gardiner"],
    [45.5667, -107.4278, "Little Bighorn Battlefield National Monument, Crow Agency"],
    [45.6333, -113.5000, "Big Hole National Battlefield, Wisdom"],
    [45.6769, -111.0429, "Museum of the Rockies, Bozeman"],
    [45.9000, -112.0000, "Lewis and Clark Caverns State Park, Whitehall"],
    [45.2917, -111.9444, "Virginia City Historic District, Virginia City"],
    [46.3333, -113.3000, "Granite Ghost Town State Park, Philipsburg"],
    [45.9972, -108.0200, "Pompeys Pillar National Monument, Billings"],
    [45.1583, -112.9972, "Bannack State Park, Dillon"],
    [47.6933, -114.0733, "Flathead Lake, Polson"],
    [47.5083, -111.2833, "C.M. Russell Museum, Great Falls"],
    [46.0139, -112.5347, "The World Museum of Mining, Butte"],
    [46.8667, -113.3333, "Garnet Ghost Town, Drummond"],
    [46.8500, -111.9167, "Gates of the Mountains Wilderness, Helena"],
    [45.9278, -111.5278, "Missouri Headwaters State Park, Three Forks"],
    [46.5167, -114.0833, "St. Mary's Mission, Stevensville"],
    [46.5858, -112.0391, "Helena Cathedral, Helena"],
    [47.8167, -110.6667, "Fort Benton Historic District, Fort Benton"],
    [45.7833, -108.5000, "Western Heritage Center, Billings"],
    [45.1853, -109.2467, "Beartooth Highway, Red Lodge"],
    [47.8167, -112.1833, "Old Trail Museum, Choteau"],
    [48.4417, -113.2167, "Glacier Park Lodge, East Glacier Park"],
    [48.4000, -115.3167, "Libby Dam Visitor Center, Libby"],
    [46.5858, -112.0391, "Montana State Capitol, Helena"],
    [47.6000, -114.1167, "The People's Center, Pablo"],
    [45.6622, -110.5606, "Yellowstone Gateway Museum, Livingston"],
    [48.0333, -114.0667, "Bigfork Village, Bigfork"],
    [48.5583, -112.8917, "Museum of the Plains Indian, Browning"],
    [45.9278, -111.5278, "Madison Buffalo Jump State Park, Three Forks"],
    [46.1333, -112.9500, "Anaconda Smoke Stack State Park, Anaconda"],
    [48.2000, -114.3167, "Flathead National Forest, Kalispell"],
    [45.7500, -108.4667, "Pictograph Cave State Park, Billings"],
    [47.3333, -111.5000, "First Peoples Buffalo Jump State Park, Ulm"],
    [45.8333, -109.9500, "Big Timber Carnegie Library, Big Timber"],
    [45.9000, -112.0000, "Ringing Rocks, Whitehall"],
    [46.8722, -114.0311, "Clark Fork River Market, Missoula"],
    [47.3500, -114.2167, "National Bison Range, Moiese"],
    [47.6167, -109.4167, "Upper Missouri River Breaks National Monument, Lewistown"],
    [46.7500, -114.5833, "Lolo Pass Visitor Center, Lolo"],
    [45.7833, -108.5000, "Yellowstone Art Museum, Billings"],
    [45.4333, -108.5500, "Chief Plenty Coups State Park, Pryor"],
    [45.6769, -111.0429, "American Computer & Robotics Museum, Bozeman"],
    [48.2000, -114.3167, "Lone Pine State Park, Kalispell"],
    [46.5167, -114.0833, "Fort Owen State Park, Stevensville"],
    [45.7833, -108.5000, "The Moss Mansion, Billings"],
    [48.3667, -107.8667, "High Plains Heritage Center, Malta"],
    [46.4500, -110.3167, "Charles M. Bair Family Museum, Martinsdale"],
    [47.5083, -111.2833, "Malmstrom Air Force Base Museum, Great Falls"],
    [47.8167, -112.1833, "Rocky Mountain Front Heritage Area, Choteau"],

    // Nebraska Historical Sites
    [41.7500, -103.3333, "Chimney Rock National Historic Site, Bayard"],
    [42.1500, -102.8500, "Carhenge, Alliance"],
    [41.2250, -95.9431, "Henry Doorly Zoo and Aquarium, Omaha"],
    [41.8667, -103.6667, "Scotts Bluff National Monument, Gering"],
    [40.6972, -99.0814, "The Archway, Kearney"],
    [41.0167, -96.1500, "Strategic Air Command & Aerospace Museum, Ashland"],
    [42.6667, -103.4667, "Fort Robinson State Park, Crawford"],
    [41.1333, -100.7667, "Buffalo Bill Ranch State Historical Park, North Platte"],
    [40.8089, -96.6975, "Nebraska State Capitol, Lincoln"],
    [42.4167, -98.1333, "Ashfall Fossil Beds State Historical Park, Royal"],
    [40.2917, -96.7472, "Homestead National Historical Park, Beatrice"],
    [41.2586, -95.9378, "The Durham Museum, Omaha"],
    [40.2333, -95.7000, "Indian Cave State Park, Shubert"],
    [40.9250, -98.3583, "Stuhr Museum of the Prairie Pioneer, Grand Island"],
    [40.5000, -98.9500, "Pioneer Village, Minden"],
    [41.2167, -101.6667, "Lake McConaughy, Ogallala"],
    [40.6972, -99.0814, "Museum of Nebraska Art (MONA), Kearney"],
    [42.8333, -102.9167, "Chadron State Park, Chadron"],
    [41.2586, -95.9378, "Joslyn Art Museum, Omaha"],
    [40.6972, -99.0814, "Great Platte River Road Archway Monument, Kearney"],
    [40.8167, -96.7000, "The Haymarket District, Lincoln"],
    [41.1333, -100.7667, "Golden Spike Tower, North Platte"],
    [41.1500, -95.9167, "Fontenelle Forest, Bellevue"],
    [41.8333, -103.6667, "Wildcat Hills State Recreation Area, Gering"],
    [41.4500, -96.0167, "Fort Atkinson State Historical Park, Fort Calhoun"],
    [41.2250, -95.9431, "Lied Jungle, Omaha"],
    [40.1333, -97.1000, "Rock Creek Station State Historical Park, Fairbury"],
    [42.7833, -100.5000, "Niobrara National Scenic River, Valentine"],
    [40.6778, -95.8583, "Arbor Lodge State Historical Park, Nebraska City"],
    [41.9000, -100.3000, "Halsey National Forest, Halsey"],
    [42.7667, -101.7000, "Bowring Ranch State Historical Park, Merriman"],
    [42.5833, -96.7167, "Ponca State Park, Ponca"],
    [41.0333, -96.2167, "Platte River State Park, Louisville"],
    [42.4167, -104.0500, "Agate Fossil Beds National Monument, Harrison"],
    [41.4000, -99.6333, "Custer County Historical Museum, Broken Bow"],
    [41.1333, -102.9667, "Fort Sidney Museum and Post Commander's Home, Sidney"],
    [41.8667, -103.6667, "Riverside Discovery Center, Scottsbluff"],
    [41.0333, -96.3667, "Ashland Historical Society Museum, Ashland"],
    [40.6778, -95.8583, "Kregel Windmill Museum, Nebraska City"],
    [41.4000, -99.6333, "The Sandhills Journey Scenic Byway, Broken Bow"],
    [40.3333, -99.3667, "Prairie Museum of Art and History, Holdrege"],
    [42.8167, -103.4667, "Toadstool Geologic Park, Crawford"],
    [40.6167, -96.9500, "Blue River State Recreation Area, Crete"],
    [40.8667, -97.5833, "Wessels Living History Farm, York"],
    [41.9000, -100.3000, "Nebraska National Forest, Halsey"],
    [41.4833, -91.7167, "Kalona Heritage Village, Kalona"],
    [40.8167, -96.7000, "Larsen Tractor Test and Power Museum, Lincoln"],
    [40.6778, -95.8583, "Missouri River Basin Lewis and Clark Center, Nebraska City"],
    [40.7500, -100.7333, "Dancing Leaf Cultural Learning Center, Wellfleet"],
    [42.6833, -102.6833, "Hay Springs Historical Society Museum, Hay Springs"],

];

async function checkLocationExists(latitude, longitude) {
    try {
        // Use Supabase's PostGIS to find locations within 100 meters
        const { data, error } = await supabase.rpc('calculate_distances', {
            lat: latitude,
            lng: longitude,
            radius_meters: 100 // Look for locations within 100 meters
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

function processStoryContent(storyData) {
    try {
        // Extract the actual story content from the API response structure
        const content = storyData?.content || storyData;
        
        // Log the content structure for debugging
        console.log('Processing story content:', {
            hasContent: !!content,
            contentType: typeof content,
            contentKeys: content ? Object.keys(content) : []
        });

        // Ensure we have the expected fields
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

async function initializeLocation(latitude, longitude) {
    // First check if location exists
    const exists = await checkLocationExists(latitude, longitude);
    if (exists) {
        console.log('Location already exists in database, skipping...');
        return null;
    }

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

        // Process and format the story content
        // Note: item.story already contains the content wrapper from the API
        const processedStory = processStoryContent(item.story);
        console.log('Processed story structure:', {
            hasStory: !!processedStory.story,
            storyLength: processedStory.story?.length,
            hasFacts: Array.isArray(processedStory.facts),
            factsCount: processedStory.facts?.length,
            hasHistoricalPeriods: Array.isArray(processedStory.historicalPeriods),
            periodsCount: processedStory.historicalPeriods?.length,
            hasActivities: Array.isArray(processedStory.suggestedActivities),
            activitiesCount: processedStory.suggestedActivities?.length
        });

        // Create AI story with processed content
        const { error: storyError } = await supabase
            .from('ai_generated_stories')
            .insert([{
                location_id: location.id,
                content: processedStory,  // Store the processed content directly
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
    let skipCount = 0;

    for (const [latitude, longitude, description] of historicalCoordinates) {
        try {
            console.log(`Processing ${description} (${latitude}, ${longitude})`);
            
            // Check if location exists
            const exists = await checkLocationExists(latitude, longitude);
            if (exists) {
                console.log(`Skipping ${description} - already exists in database`);
                skipCount++;
                continue;
            }

            console.log(`Generating stories for ${description}`);
            await initializeLocation(latitude, longitude);
            console.log(`Successfully generated stories for ${description}`);
            successCount++;
            
            // Add a delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error(`Failed to generate stories for ${description}:`, error);
            failureCount++;
            
            // Add a longer delay after failures to help with rate limiting
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    console.log('\nBatch generation complete!');
    console.log(`Successfully generated stories for ${successCount} locations`);
    console.log(`Skipped ${skipCount} existing locations`);
    console.log(`Failed to generate stories for ${failureCount} locations`);
}

// Run the batch generation
batchGenerateStories();
