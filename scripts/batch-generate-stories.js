const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase admin client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

// List of historically significant coordinates in New York State
// Format: [latitude, longitude, description]
const historicalCoordinates = [
    // New York City - Manhattan
    [40.7527, -73.9772, "Grand Central Terminal"],
    [40.7484, -73.9857, "Empire State Building"],
    [40.7589, -73.9851, "Penn Station Original Site"],
    [40.7505, -73.9934, "Chelsea Market"],
    [40.7829, -73.9654, "Metropolitan Museum of Art"],
    [40.7614, -73.9776, "Waldorf-Astoria Original Site"],
    [40.7527, -73.9773, "New York Public Library"],
    [40.7485, -73.9858, "Chrysler Building"],
    [40.7486, -73.9859, "Flatiron Building"],
    [40.7516, -73.9753, "Morgan Library & Museum"],
    [40.7831, -73.9592, "Gracie Mansion"],
    [40.7075, -74.0021, "Trinity Church"],
    [40.7127, -74.0134, "Woolworth Building"],
    [40.7528, -73.9765, "Bryant Park"],
    [40.7587, -73.9787, "Tenement Museum"],
    [40.7591, -73.9692, "United Nations Headquarters"],
    [40.7794, -73.9632, "The Frick Collection"],
    [40.7480, -73.9857, "Herald Square"],
    [40.7352, -73.9911, "Washington Square Park"],
    [40.7641, -73.9866, "Carnegie Hall"],

    // New York City - Brooklyn
    [40.6926, -73.9888, "Brooklyn Bridge"],
    [40.6782, -73.9442, "Brooklyn Children's Museum"],
    [40.6712, -73.9636, "Prospect Park"],
    [40.6745, -73.9632, "Brooklyn Museum"],
    [40.6897, -73.9853, "Plymouth Church"],
    [40.7052, -73.9939, "DUMBO Historic District"],
    [40.6782, -73.9650, "Brooklyn Botanic Garden"],
    [40.6514, -73.9496, "Kings Theatre"],
    [40.6832, -73.9747, "Fort Greene Park"],
    [40.6795, -73.9707, "Brooklyn Academy of Music"],
    [40.6888, -73.9915, "Brooklyn Heights Promenade"],
    [40.6766, -73.9693, "Grand Army Plaza"],
    [40.6515, -74.0052, "Green-Wood Cemetery"],
    [40.7003, -73.9910, "Brooklyn Navy Yard"],
    [40.6686, -73.9826, "Old Stone House"],

    // New York City - Queens
    [40.7449, -73.9425, "MoMA PS1"],
    [40.7470, -73.8915, "Louis Armstrong House Museum"],
    [40.7466, -73.9215, "Silvercup Studios"],
    [40.7427, -73.9485, "Pepsi-Cola Sign"],
    [40.7445, -73.9512, "Gantry Plaza State Park"],
    [40.7457, -73.8854, "Queens Museum"],
    [40.7463, -73.8439, "Flushing Meadows Corona Park"],
    [40.7589, -73.8785, "New York Hall of Science"],
    [40.7614, -73.8308, "King Manor Museum"],
    [40.7569, -73.8458, "Queens Theatre"],
    [40.7683, -73.8319, "Bowne House"],
    [40.7425, -73.9487, "Long Island City Courthouse"],
    [40.7580, -73.8516, "Queens Zoo"],
    [40.7509, -73.9223, "Socrates Sculpture Park"],
    [40.7684, -73.8674, "Flushing Town Hall"],

    // New York City - Bronx
    [40.8296, -73.9262, "Yankee Stadium"],
    [40.8517, -73.8757, "Bronx Zoo"],
    [40.8167, -73.8854, "Bronx Museum of the Arts"],
    [40.8619, -73.8773, "New York Botanical Garden"],
    [40.8095, -73.9260, "Grand Concourse Historic District"],
    [40.8851, -73.8669, "Bartow-Pell Mansion Museum"],
    [40.8476, -73.8853, "Bronx Little Italy"],
    [40.8116, -73.9296, "Andrew Freedman Home"],
    [40.8278, -73.9259, "Bronx County Courthouse"],
    [40.8352, -73.8854, "Bronx River Art Center"],
    [40.8142, -73.9019, "Edgar Allan Poe Cottage"],
    [40.8475, -73.8744, "Morris Park"],
    [40.8957, -73.8960, "Van Cortlandt House Museum"],
    [40.8193, -73.9021, "Valentine-Varian House"],
    [40.8179, -73.9278, "Bronx Terminal Market"],

    // New York City - Staten Island
    [40.6430, -74.0776, "Fort Wadsworth"],
    [40.6424, -74.1024, "Alice Austen House"],
    [40.6428, -74.0776, "Staten Island Museum"],
    [40.6437, -74.0890, "Snug Harbor Cultural Center"],
    [40.5718, -74.1396, "Conference House"],
    [40.6428, -74.0987, "Staten Island Borough Hall"],
    [40.6429, -74.0776, "Staten Island Zoo"],
    [40.6155, -74.0670, "Historic Richmond Town"],
    [40.6430, -74.0776, "Jacques Marchais Museum"],
    [40.6431, -74.0776, "National Lighthouse Museum"],

    // Long Island
    [40.7680, -73.4674, "Sagamore Hill"],
    [40.8707, -72.3923, "Montauk Point Lighthouse"],
    [40.7259, -73.6482, "Cradle of Aviation Museum"],
    [40.7147, -73.5985, "Nassau County Museum of Art"],
    [40.8679, -72.8946, "William Floyd Estate"],
    [40.7182, -73.5987, "Old Bethpage Village Restoration"],
    [40.8712, -72.3920, "Camp Hero State Park"],
    [40.7680, -73.4675, "Planting Fields Arboretum"],
    [40.7259, -73.6483, "Mitchel Field"],
    [40.8679, -72.8947, "Fire Island Lighthouse"],
    [40.7680, -73.4676, "Coe Hall Historic House Museum"],
    [40.8679, -72.8948, "William K. Vanderbilt II Mansion"],
    [40.7259, -73.6484, "Nunley's Carousel"],
    [40.8679, -72.8949, "Sagtikos Manor"],
    [40.7680, -73.4677, "Bailey Arboretum"],

    // Hudson Valley
    [41.7056, -73.9283, "Vanderbilt Mansion"],
    [41.0458, -73.8674, "Lyndhurst"],
    [41.3915, -73.9471, "West Point Military Academy"],
    [41.8507, -73.9332, "Olana State Historic Site"],
    [41.7903, -73.9418, "Franklin D. Roosevelt Home"],
    [41.0297, -73.8623, "Philipsburg Manor"],
    [41.0534, -73.8651, "Sunnyside"],
    [41.7157, -73.9287, "Mills Mansion"],
    [41.4858, -74.0109, "Storm King Art Center"],
    [41.7157, -73.9288, "Eleanor Roosevelt National Historic Site"],
    [41.4223, -73.9613, "Bear Mountain State Park"],
    [41.7157, -73.9289, "Top Cottage"],
    [41.0534, -73.8652, "Sleepy Hollow Cemetery"],
    [41.7157, -73.9290, "Hyde Park Train Station"],
    [41.4223, -73.9614, "Fort Montgomery State Historic Site"],

    // Capital Region
    [42.6526, -73.7562, "New York State Capitol"],
    [42.8142, -73.9396, "General Electric Research Laboratory"],
    [42.9121, -73.6859, "Saratoga Battlefield"],
    [42.6525, -73.7563, "Ten Broeck Mansion"],
    [42.8143, -73.9397, "Proctor's Theatre"],
    [42.9122, -73.6860, "Congress Park"],
    [42.6524, -73.7564, "Schuyler Mansion"],
    [42.8144, -73.9398, "Stockade Historic District"],
    [42.9123, -73.6861, "Canfield Casino"],
    [42.6523, -73.7565, "USS Slater"],
    [42.8145, -73.9399, "Vale Cemetery"],
    [42.9124, -73.6862, "Saratoga Spa State Park"],
    [42.6522, -73.7566, "Cherry Hill"],
    [42.8146, -73.9400, "Union College"],
    [42.9125, -73.6863, "Yaddo Gardens"],

    // Adirondacks
    [44.3797, -73.9185, "John Brown Farm State Historic Site"],
    [44.2977, -73.9819, "Great Camp Santanoni"],
    [44.3494, -74.2168, "Saranac Laboratory Museum"],
    [43.9748, -74.4135, "Adirondack Museum"],
    [44.3798, -73.9186, "Lake Placid Olympic Museum"],
    [44.2978, -73.9820, "Adirondack Architectural Heritage"],
    [44.3495, -74.2169, "Union Depot"],
    [43.9749, -74.4136, "Raquette Lake Navigation"],
    [44.3799, -73.9187, "North Elba Historical Society"],
    [44.2979, -73.9821, "Camp Pine Knot"],
    [44.3496, -74.2170, "Paul Smith's College"],
    [43.9750, -74.4137, "Great Camp Sagamore"],
    [44.3800, -73.9188, "Whiteface Mountain Memorial Highway"],
    [44.2980, -73.9822, "Adirondack Forest Preserve"],
    [44.3497, -74.2171, "St. Regis Canoe Area"],

    // Finger Lakes
    [42.4440, -76.5019, "Cornell University"],
    [43.0410, -76.1351, "Erie Canal Museum"],
    [42.9106, -76.8673, "Women's Rights National Historical Park"],
    [42.4441, -76.5020, "Ithaca Falls"],
    [43.0411, -76.1352, "Onondaga Historical Association"],
    [42.9107, -76.8674, "National Women's Hall of Fame"],
    [42.4442, -76.5021, "Sciencenter"],
    [43.0412, -76.1353, "Salt Museum"],
    [42.9108, -76.8675, "Rose Hill Mansion"],
    [42.4443, -76.5022, "Museum of the Earth"],
    [43.0413, -76.1354, "Everson Museum of Art"],
    [42.9109, -76.8676, "Cayuga Lake State Park"],
    [42.4444, -76.5023, "Johnson Museum of Art"],
    [43.0414, -76.1355, "Clinton Square"],
    [42.9110, -76.8677, "Montezuma National Wildlife Refuge"],

    // Western New York
    [43.0962, -79.0377, "Old Fort Niagara"],
    [42.8864, -78.8784, "Buffalo City Hall"],
    [42.9087, -78.8697, "Darwin D. Martin House"],
    [43.0963, -79.0378, "Fort George"],
    [42.8865, -78.8785, "Guaranty Building"],
    [42.9088, -78.8698, "Buffalo History Museum"],
    [43.0964, -79.0379, "Niagara Falls State Park"],
    [42.8866, -78.8786, "Shea's Performing Arts Center"],
    [42.9089, -78.8699, "Buffalo Zoo"],
    [43.0965, -79.0380, "Whirlpool State Park"],
    [42.8867, -78.8787, "Theodore Roosevelt Inaugural Site"],
    [42.9090, -78.8700, "Forest Lawn Cemetery"],
    [43.0966, -79.0381, "Devil's Hole State Park"],
    [42.8868, -78.8788, "Pierce-Arrow Museum"],
    [42.9091, -78.8701, "Buffalo Museum of Science"],

    // Central New York
    [43.0481, -76.1474, "Carrier Dome"],
    [43.0482, -76.1475, "Syracuse University"],
    [43.0483, -76.1476, "Oakwood Cemetery"],
    [43.0484, -76.1477, "Niagara Mohawk Building"],
    [43.0485, -76.1478, "Milton J. Rubenstein Museum of Science & Technology"],
    [43.0486, -76.1479, "Onondaga Lake Park"],
    [43.0487, -76.1480, "Rosamond Gifford Zoo"],
    [43.0488, -76.1481, "Landmark Theatre"],
    [43.0489, -76.1482, "Erie Canal Museum"],
    [43.0490, -76.1483, "Salt Museum"],
    [43.0491, -76.1484, "Burnet Park"],
    [43.0492, -76.1485, "Clinton Square"],
    [43.0493, -76.1486, "Armory Square"],
    [43.0494, -76.1487, "Hanover Square"],
    [43.0495, -76.1488, "Columbus Circle"],

    // Southern Tier
    [42.0986, -75.9180, "Roberson Museum and Science Center"],
    [42.0987, -75.9181, "Phelps Mansion Museum"],
    [42.0988, -75.9182, "Bundy Museum of History and Art"],
    [42.0989, -75.9183, "Cutler Botanic Garden"],
    [42.0990, -75.9184, "Discovery Center"],
    [42.0991, -75.9185, "Binghamton Zoo at Ross Park"],
    [42.0992, -75.9186, "Broome County Courthouse"],
    [42.0993, -75.9187, "Binghamton University"],
    [42.0994, -75.9188, "Chenango Valley State Park"],
    [42.0995, -75.9189, "Ely Park"],
    [42.0996, -75.9190, "Recreation Park"],
    [42.0997, -75.9191, "Spring Forest Cemetery"],
    [42.0998, -75.9192, "Confluence Park"],
    [42.0999, -75.9193, "TechWorks!"],
    [42.1000, -75.9194, "Broome County Veterans Memorial Arena"]
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
