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
    const { latitude, longitude } = body;

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
    console.log('Fetching location context...');
    const placeResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
    );

    if (!placeResponse.ok) {
      const placeError = await placeResponse.text();
      throw new Error(`Failed to get location context: ${placeError}`);
    }

    const placeData = await placeResponse.json();
    console.log('Location context:', placeData.results[0]?.formatted_address);
    const locationContext = placeData.results[0]?.formatted_address || '';

    // Ask OpenAI to identify nearby landmarks
    console.log('Identifying landmarks...');
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
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
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
      throw new Error(`Failed to identify locations: ${identifyError}`);
    }

    const identifyData = await identifyResponse.json();
    console.log('OpenAI response received');
    const locations = JSON.parse(identifyData.choices[0].message.content);

    // Generate stories and find images for each location
    console.log('Processing locations...');
    const locationStories = await Promise.all(locations.map(async (loc, index) => {
      console.log(`Processing location ${index + 1}/${locations.length}: ${loc.title}`);
      
      // Try to get place photos using Google Places API
      console.log('Fetching place photos...');
      const placesResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(loc.place_query)}&inputtype=textquery&fields=photos,place_id&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );

      let imageUrl = null;

      if (!placesResponse.ok) {
        console.log('Places API error:', await placesResponse.text());
      } else {
        const placesData = await placesResponse.json();
        console.log('Places API response:', placesData);
        const photoReference = placesData.candidates?.[0]?.photos?.[0]?.photo_reference;

        if (photoReference) {
          imageUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoReference}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;
          console.log('Using Places photo');
        } else {
          // Fallback to Street View if no place photos
          imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=1200x800&location=${loc.latitude},${loc.longitude}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;
          console.log('Falling back to Street View');
        }
      }

      // Generate story
      console.log('Generating story...');
      const storyPrompt = `Generate a detailed historical story about "${loc.title}" in ${locationContext}.
      Focus specifically on:
      - The physical building/site itself
      - Its architectural features and design
      - When it was built and by whom
      - How it has been used over time
      - Notable events that happened at this specific location
      - Its role in the local community
      
      Do NOT include general area history unless directly related to this building/site.
      
      Return in this JSON format:
      {
        "story": "Detailed narrative about this specific building/site",
        "facts": ["Specific fact about this building/site", "Another specific fact", "A third specific fact"],
        "historicalPeriods": ["Periods relevant to this building/site"],
        "suggestedActivities": ["Activities related to this specific location"]
      }`;

      const storyResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
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
        throw new Error(`Failed to generate story: ${storyError}`);
      }

      const storyData = await storyResponse.json();
      const story = JSON.parse(storyData.choices[0].message.content);

      // Add the image URL to the story content
      const storyWithImage = {
        ...story,
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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };
    }));

    console.log('All locations processed successfully');
    return new Response(
      JSON.stringify({
        message: 'Generated location data',
        locations: locationStories
      }),
      { headers, status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
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
