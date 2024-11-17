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

    // Ask OpenAI to identify nearby landmarks
    const identificationPrompt = `You are looking at coordinates (${latitude}, ${longitude}) in Bedford-Stuyvesant, Brooklyn, New York. 
    Identify 4-5 significant historical buildings, landmarks, or cultural sites at or very near these exact coordinates.
    
    For each location, provide:
    {
      "title": "Actual name of the building or site",
      "description": "Brief but accurate description focusing on the building/site itself",
      "category": "Type (e.g., Architecture, Cultural, Religious)",
      "historical_period": "Main historical period of the building/site",
      "latitude": "${latitude}",
      "longitude": "${longitude}",
      "significance": "Historical significance of this specific building/site"
    }

    Focus on actual buildings and sites, not general neighborhood history.
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
      throw new Error('Failed to identify locations');
    }

    const identifyData = await identifyResponse.json();
    const locations = JSON.parse(identifyData.choices[0].message.content);

    // Generate stories for each location
    const locationStories = await Promise.all(locations.map(async (loc) => {
      const storyPrompt = `Generate a detailed historical story about the building/site "${loc.title}" at (${latitude}, ${longitude}).
      Focus specifically on:
      - The physical building/site itself
      - Its architectural features and design
      - When it was built and by whom
      - How it has been used over time
      - Notable events that happened at this specific location
      - Its role in the local community
      
      Do NOT include general neighborhood history unless directly related to this building/site.
      
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
        throw new Error('Failed to generate story');
      }

      const storyData = await storyResponse.json();
      const story = JSON.parse(storyData.choices[0].message.content);

      return {
        location: {
          title: loc.title,
          description: loc.description,
          category: loc.category,
          historical_period: loc.historical_period,
          latitude: loc.latitude,
          longitude: loc.longitude,
          location: `POINT(${loc.longitude} ${loc.latitude})`,
          image_url: 'https://picsum.photos/800/600',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        story: {
          content: story,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };
    }));

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
        details: error.message
      }),
      { headers, status: 500 }
    );
  }
}
