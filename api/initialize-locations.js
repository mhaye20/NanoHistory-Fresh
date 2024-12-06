export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { headers, status: 405 }
    );
  }

  try {
    const body = await req.json();
    const { latitude, longitude, customPrompt } = body;

    // Log environment variable status
    console.log('[Initialize] Environment variables check:', {
      MAPS_KEY_EXISTS: !!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      MAPS_KEY_LENGTH: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.length : 0,
      MAPS_KEY_START: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.substring(0, 8) : 'none'
    });

    if (!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
      console.error('[Initialize] Google Maps API key is missing');
      throw new Error('Google Maps API key is not configured');
    }

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          message: 'Coordinates are required'
        }),
        { headers, status: 400 }
      );
    }

    // First, get the location context using Google Places API
    console.log('[Initialize] Fetching location context...');
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;
    console.log('[Initialize] Geocoding API URL:', geocodeUrl.replace(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, 'API_KEY'));
    
    const placeResponse = await fetch(geocodeUrl);

    if (!placeResponse.ok) {
      const placeError = await placeResponse.text();
      console.error('[Initialize] Failed to get location context:', placeError);
      throw new Error(`Failed to get location context: ${placeError}`);
    }

    const placeData = await placeResponse.json();
    console.log('[Initialize] Geocoding API response status:', placeData.status);
    console.log('[Initialize] Location context:', placeData.results[0]?.formatted_address);
    const locationContext = placeData.results[0]?.formatted_address || '';

    // Ask OpenAI to identify nearby landmarks
    console.log('[Initialize] Identifying landmarks...');
    const identificationPrompt = `You are looking at coordinates (${latitude}, ${longitude}) in ${locationContext}. 
    Identify 4-5 significant historical buildings, landmarks, or cultural sites at or very near these exact coordinates.
    
    For each location, provide:
    {
      "title": "Actual name of the building or site",
      "description": "Brief but accurate description focusing on the building/site itself",
      "category": "Type (e.g., Architecture, Cultural, Religious)",
      "historical_period": "Main historical period",
      "latitude": "${latitude}",
      "longitude": "${longitude}",
      "significance": "Historical significance of this specific building/site",
      "place_query": "Specific search query to find this exact place in Google Places API"
    }

    Focus on actual buildings and sites, not general area history.
    For place_query, include the exact name and address to find the specific location.
    Return as a JSON array of locations.`;

    const identifyResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a knowledgeable architectural historian who identifies specific buildings and sites. Focus on the actual structures and places, not general area history.'
          },
          {
            role: 'user',
            content: identificationPrompt
          }
        ],
        temperature: 0.7
      })
    });

    if (!identifyResponse.ok) {
      const identifyError = await identifyResponse.text();
      console.error('[Initialize] Failed to identify locations:', identifyError);
      throw new Error(`Failed to identify locations: ${identifyError}`);
    }

    const identifyData = await identifyResponse.json();
    console.log('[Initialize] OpenAI response received');
    const locations = JSON.parse(identifyData.choices[0].message.content);

    // Generate stories and find images for each location
    console.log('[Initialize] Processing locations...');
    const locationStories = await Promise.all(locations.map(async (loc, index) => {
      console.log(`[Initialize] Processing location ${index + 1}/${locations.length}: ${loc.title}`);
      console.log(`[Initialize] Location coordinates:`, { lat: loc.latitude, lng: loc.longitude });
      
      // Try to get place photos using Google Places API
      console.log('[Initialize] Fetching place photos...');
      const placesUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(loc.place_query)}&inputtype=textquery&fields=photos,place_id&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;
      console.log('[Initialize] Places API URL:', placesUrl.replace(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, 'API_KEY'));
      
      const placesResponse = await fetch(placesUrl);

      let imageUrl = null;

      if (!placesResponse.ok) {
        console.error('[Initialize] Places API error:', await placesResponse.text());
      } else {
        const placesData = await placesResponse.json();
        console.log('[Initialize] Places API response:', placesData);
        console.log('[Initialize] Places API status:', placesData.status);
        const photoReference = placesData.candidates?.[0]?.photos?.[0]?.photo_reference;

        if (photoReference) {
          imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoReference}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;
          console.log('[Initialize] Using Places photo');
        } else {
          // Fallback to Street View if no place photos
          imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=1200x800&location=${loc.latitude},${loc.longitude}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;
          console.log('[Initialize] Falling back to Street View');
        }
      }

      console.log('[Initialize] Final image URL:', imageUrl?.replace(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, 'API_KEY'));

      // Generate story
      console.log('[Initialize] Generating story...');
      const storyPrompt = customPrompt || `Generate a detailed historical story about "${loc.title}" in ${locationContext}.
      Focus specifically on:
      - The physical building/site itself
      - Its architectural features and design
      - When it was built and by whom
      - How it has been used over time
      - Notable events that happened at this specific location
      - Its role in the local community
      
      Also identify exactly TWO of these story types that best match this location:
      - music: Stories about musical history, musicians, venues, or musical traditions
      - visualArt: Stories about paintings, sculptures, galleries, or visual artists
      - performingArt: Stories about theater, dance, performance venues, or performing artists
      - architecture: Stories about building design, architectural styles, or construction methods
      - fashion: Stories about clothing, style trends, fashion designers, or textile history
      - culinary: Stories about food history, restaurants, cooking traditions, or cuisine
      - landscape: Stories about parks, gardens, natural landmarks, or landscape design
      - lore: Mythical tales and folklore tied to the area
      - paranormal: Stories about ghost sightings, supernatural events, or unexplained phenomena
      - unsungHero: ONLY for stories about specific individuals who made important but overlooked contributions
      - popCulture: Famous movies, books, or events inspired by the location
      - civilRights: Stories about equality movements, social justice, or civil rights activism
      - education: Stories about schools, libraries, educational institutions, or learning
      
      Do NOT include general area history unless directly related to this building/site.
      
      Return in this JSON format:
      {
        "story": "Detailed narrative about this specific building/site",
        "facts": ["Specific fact about this building/site", "Another specific fact", "A third specific fact"],
        "historicalPeriods": ["Periods relevant to this building/site"],
        "suggestedActivities": ["Activities related to this specific location"], 
        "storyTypes": ["type1", "type2"]
      }`;

       const storyResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an architectural historian who provides detailed information about specific buildings and sites. Focus on the actual structure or place being discussed.'
            },
            {
              role: 'user',
              content: storyPrompt
            }
          ],
          temperature: 0.7
        })
      });

      if (!storyResponse.ok) {
        const storyError = await storyResponse.text();
        console.error('[Initialize] Failed to generate story:', storyError);
        throw new Error(`Failed to generate story: ${storyError}`);
      }

      const storyData = await storyResponse.json();
      const story = JSON.parse(storyData.choices[0].message.content);

      // Extract story types and remove from content
      const storyTypes = story.storyTypes || [];
      const { storyTypes: removed, ...storyContent } = story;

      // Add the image URL to the story content, but NOT story types
      const storyWithImage = {
        ...storyContent,
        imageUrl: imageUrl
      };

      return {
        location: {
          title: loc.title,
          description: loc.description,
          category: loc.category,
          historical_period: loc.historical_period,
          latitude: loc.latitude,
          longitude: loc.longitude,
          location: `POINT(${loc.longitude} ${loc.latitude})`,
          image_url: imageUrl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        story: {
          content: storyWithImage,
          story_types: storyTypes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };
    }));

    console.log('[Initialize] All locations processed successfully');
    return new Response(
      JSON.stringify({
        message: 'Generated location data',
        locations: locationStories
      }),
      { headers, status: 200 }
    );
  } catch (error) {
    console.error('[Initialize] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to initialize locations',
        details: error.message,
        stack: error.stack
      }),
      { headers, status: 500 }
    );
  }
}
