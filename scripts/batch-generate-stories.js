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

    // Alabama Historical Sites
    [32.4072, -87.0211, "Edmund Pettus Bridge"],
    [32.3777, -86.3005, "Dexter Avenue King Memorial Baptist Church"],
    [30.6868, -88.0145, "USS Alabama Battleship Memorial Park"],
    [33.0010, -87.6324, "Moundville Archaeological Park"],
    [33.5151, -86.8146, "Birmingham Civil Rights Institute"],
    [32.3778, -86.3099, "Rosa Parks Museum"],
    [33.5204, -86.7915, "Sloss Furnaces National Historic Landmark"],
    [30.2275, -88.0247, "Fort Morgan"],
    [34.1731, -86.7890, "Ave Maria Grotto"],
    [32.5079, -87.8372, "Gaineswood"],
    [32.9797, -85.7669, "Horseshoe Bend National Military Park"],
    [32.3199, -87.1250, "Old Cahawba Archaeological Park"],
    [30.7444, -87.9150, "Historic Blakeley State Park"],
    [30.6915, -88.0433, "Mobile Carnival Museum"],
    [32.3783, -86.2887, "F. Scott and Zelda Fitzgerald Museum"],
    [34.7445, -87.6686, "The Shoals Music Studio"],
    [34.9926, -87.3196, "Natchez Trace Parkway"],
    [34.6287, -86.8807, "Mooresville Historic District"],
    [32.5027, -86.2147, "Fort Toulouse-Fort Jackson Park"],
    [32.3778, -86.3099, "Old Alabama Town"],
    [32.0662, -87.1386, "Gee's Bend Quilt Collective"],
    [33.4027, -87.0419, "Tannehill Ironworks Historical State Park"],
    [33.0405, -87.0926, "Brierfield Ironworks Historical State Park"],
    [34.8023, -86.9714, "Alabama Veterans Museum"],
    [34.7307, -87.7019, "Belle Mont Mansion"],
    [32.3778, -86.3099, "Freedom Rides Museum"],
    [31.5419, -88.0511, "St. Stephens Historical Park"],
    [33.4857, -85.8091, "Cheaha State Park"],
    [34.7956, -87.6686, "Indian Mounds Park"],
    [32.4072, -87.0211, "Kenan's Mill"],
    [34.5444, -85.6119, "Little River Canyon National Preserve"],
    [34.5742, -86.4125, "Cathedral Caverns State Park"],
    [34.7307, -87.5353, "LaGrange College Site Park"],
    [32.3778, -86.3099, "Civil Rights Memorial Center"],
    [32.3778, -86.3099, "Governor's Mansion"],
    [30.2486, -88.0758, "Historic Fort Gaines"],
    [33.4894, -86.8490, "Red Mountain Park"],
    [32.4072, -87.0211, "Selma Interpretive Center"],
    [32.3778, -86.3099, "First White House of the Confederacy"],
    [32.6647, -86.3303, "Confederate Memorial Park"],
    [34.7304, -86.5861, "Big Spring International Park"],
    [34.7304, -86.5861, "Huntsville Depot Museum"],
    [30.6868, -88.0145, "Oakleigh Historic Complex"],
    [31.8088, -85.9692, "Pioneer Museum of Alabama"],
    [34.9757, -85.8069, "Russell Cave National Monument"],
    [34.7304, -86.5861, "Trail of Tears National Historic Trail"],
    [33.5206, -86.7977, "Vulcan Park and Museum"],
    [34.7304, -86.5861, "Weeden House Museum"],
    [34.7445, -87.6686, "Wilson Lock and Dam"],
    [34.1458, -87.4036, "Winston County Courthouse"]
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
