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
    // Kentucky Historical Sites
    [37.1861, -86.1000, "Mammoth Cave National Park, Cave City"],
    [38.1500, -84.5167, "Kentucky Horse Park, Lexington"],
    [38.2567, -85.7647, "Louisville Slugger Museum & Factory, Louisville"],
    [36.9861, -86.4436, "National Corvette Museum, Bowling Green"],
    [38.2086, -85.7711, "Churchill Downs and Kentucky Derby Museum, Louisville"],
    [37.8333, -84.7333, "Shaker Village of Pleasant Hill, Harrodsburg"],
    [36.8389, -84.3439, "Cumberland Falls State Resort Park, Corbin"],
    [37.5333, -85.7333, "Abraham Lincoln Birthplace National Historical Park, Hodgenville"],
    [37.9833, -84.1833, "Daniel Boone National Forest, Winchester"],
    [38.0333, -84.4833, "Ashland, The Henry Clay Estate, Lexington"],
    [37.8092, -85.4667, "My Old Kentucky Home State Park, Bardstown"],
    [36.6833, -84.5500, "Big South Fork National River and Recreation Area, Stearns"],
    [37.8917, -85.9583, "Fort Knox Gold Vault, Fort Knox"],
    [39.0917, -84.4958, "Newport Aquarium, Newport"],
    [38.6250, -84.5917, "Ark Encounter, Williamstown"],
    [37.8167, -83.6833, "Red River Gorge, Stanton"],
    [37.7833, -83.6833, "Natural Bridge State Resort Park, Slade"],
    [38.2567, -85.7647, "Muhammad Ali Center, Louisville"],
    [38.0500, -84.4972, "Mary Todd Lincoln House, Lexington"],
    [38.0333, -84.4833, "Waveland State Historic Site, Lexington"],
    [37.7583, -84.8500, "Old Fort Harrod State Park, Harrodsburg"],
    [37.9833, -84.4167, "Boone Station State Historic Site, Gentry Mill"],
    [37.6750, -84.9722, "Perryville Battlefield State Historic Site, Perryville"],
    [37.7742, -87.1133, "Bluegrass Music Hall of Fame and Museum, Owensboro"],
    [37.0833, -88.6000, "Paducah Riverfront, Paducah"],
    [36.7833, -88.0667, "Land Between the Lakes National Recreation Area, Golden Pond"],
    [38.2000, -85.0000, "Kentucky Bourbon Trail, Multiple Locations"],
    [38.2000, -84.8667, "Thomas D. Clark Center for Kentucky History, Frankfort"],
    [37.6583, -85.5917, "Kentucky Railway Museum, New Haven"],
    [38.2167, -84.2500, "Cane Ridge Meeting House, Paris"],
    [37.5694, -84.2917, "Kentucky Artisan Center, Berea"],
    [37.3333, -82.9833, "Appalachian Artisan Center, Hindman"],
    [39.0833, -84.5083, "Behringer-Crawford Museum, Covington"],
    [37.8092, -85.4667, "Old Talbott Tavern, Bardstown"],
    [37.8092, -85.4667, "Bardstown Historic District, Bardstown"],
    [37.1833, -85.9167, "Kentucky Down Under Adventure Zoo, Horse Cave"],
    [38.2567, -85.7647, "Louisville Waterfront Park, Louisville"],
    [37.7742, -87.1133, "Western Kentucky Botanical Garden, Owensboro"],
    [38.2567, -85.7647, "The Speed Art Museum, Louisville"],
    [38.3833, -83.1167, "Carter Caves State Resort Park, Olive Hill"],
    [38.0500, -84.4972, "Hunt-Morgan House, Lexington"],
    [37.7278, -84.2917, "White Hall State Historic Site, Richmond"],
    [36.8583, -87.3083, "Jefferson Davis State Historic Site, Fairview"],
    [37.0917, -86.0417, "Bell's Tavern Ruins, Park City"],
    [37.6833, -85.2333, "Lincoln Homestead State Park, Springfield"],
    [39.0333, -84.7500, "Dinsmore Homestead, Burlington"],
    [36.9833, -85.1333, "Wolf Creek National Fish Hatchery, Jamestown"],
    [38.8833, -84.7500, "Big Bone Lick State Historic Site, Union"],
    [37.0167, -88.2833, "Kentucky Dam Village State Resort Park, Gilbertsville"],
    [36.8750, -86.6583, "South Union Shaker Village, South Union"],

    // Kansas Historical Sites
    [38.4167, -96.5500, "Tallgrass Prairie National Preserve, Strong City"],
    [39.0378, -95.6764, "Brown v. Board of Education National Historic Site, Topeka"],
    [38.7917, -100.8333, "Monument Rocks National Natural Landmark, Gove County"],
    [37.7528, -100.0167, "Boot Hill Museum, Dodge City"],
    [38.0611, -97.9297, "Kansas Cosmosphere and Space Center, Hutchinson"],
    [38.1667, -99.1000, "Fort Larned National Historic Site, Larned"],
    [39.0378, -95.6764, "Kansas State Capitol, Topeka"],
    [38.9167, -97.2167, "Eisenhower Presidential Library and Museum, Abilene"],
    [38.2000, -98.7833, "Quivira National Wildlife Refuge, Stafford County"],
    [37.6889, -97.3361, "Old Cowtown Museum, Wichita"],
    [39.5667, -95.1167, "Amelia Earhart Birthplace Museum, Atchison"],
    [38.5736, -97.6742, "Lindsborg's Little Sweden, Lindsborg"],
    [39.0333, -100.7167, "Castle Rock Badlands, Quinter"],
    [38.5736, -97.6742, "Coronado Heights Castle, Lindsborg"],
    [37.6889, -97.3361, "Wichita Art Museum, Wichita"],
    [38.3667, -96.5500, "Chase State Fishing Lake and Falls, Cottonwood Falls"],
    [39.3944, -101.0528, "Prairie Museum of Art and History, Colby"],
    [39.1333, -97.7000, "Rock City, Minneapolis"],
    [38.0611, -97.9297, "Strataca (Kansas Underground Salt Museum), Hutchinson"],
    [39.2028, -96.3072, "Oz Museum, Wamego"],
    [37.2833, -95.0500, "Big Brutus, West Mineral"],
    [38.3500, -98.8667, "Cheyenne Bottoms Wildlife Area, Great Bend"],
    [39.0667, -98.5333, "Garden of Eden, Lucas"],
    [38.2500, -94.7500, "Marais des Cygnes Massacre State Historic Site, Trading Post"],
    [37.6889, -97.3361, "Great Plains Nature Center, Wichita"],
    [38.6611, -96.4917, "Council Grove Historic District, Council Grove"],
    [38.5000, -94.9500, "John Brown Museum State Historic Site, Osawatomie"],
    [37.8417, -94.7042, "Fort Scott National Historic Site, Fort Scott"],
    [37.6889, -97.3361, "The Keeper of the Plains, Wichita"],
    [37.2833, -98.5833, "Medicine Lodge Peace Treaty Site, Medicine Lodge"],
    [38.9667, -95.3833, "Historic Lecompton, Lecompton"],
    [39.8917, -96.8667, "Hollenberg Pony Express Station, Hanover"],
    [37.2500, -95.8333, "Elk City State Park, Independence"],
    [38.6667, -100.9167, "Lake Scott State Park, Scott City"],
    [39.1000, -96.8167, "Fort Riley Cavalry Museum, Fort Riley"],
    [38.6611, -96.4917, "Kaw Mission State Historic Site, Council Grove"],
    [38.7000, -97.8333, "Mushroom Rock State Park, Brookville"],
    [37.0236, -94.7347, "Baxter Springs Heritage Center and Museum, Baxter Springs"],
    [39.0378, -95.6764, "Kansas Museum of History, Topeka"],
    [38.9333, -99.5667, "Walter P. Chrysler Boyhood Home, Ellis"],
    [38.8431, -94.7208, "Overland Park Arboretum and Botanical Gardens, Overland Park"],
    [37.0236, -94.7347, "Wildcat Glades Conservation and Audubon Center, Joplin"],
    [38.4111, -96.1811, "Red Rocks State Historic Site (William Allen White Home), Emporia"],
    [38.7667, -99.3167, "Cedar Bluff State Park, Ellis"],
    [37.7528, -100.0167, "Dodge City Trail of Fame, Dodge City"],
    [37.7528, -100.0167, "Santa Fe Trail Tracks, Dodge City"],
    [39.0333, -94.6333, "Shawnee Indian Mission State Historic Site, Fairway"],
    [37.0611, -97.0389, "Cherokee Strip Land Rush Museum, Arkansas City"],
    [38.0611, -97.9297, "Hutchinson Zoo, Hutchinson"],
    [39.1500, -94.7667, "Wyandotte County Lake Park, Kansas City"],

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
