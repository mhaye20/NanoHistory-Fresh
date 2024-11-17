import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

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
    const { location, userPreferences } = body;

    if (!location?.latitude || !location?.longitude) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          message: 'Location coordinates are required'
        }),
        { headers, status: 400 }
      );
    }

    // First, ask OpenAI to identify what's at these coordinates
    const identificationPrompt = `What significant historical location, building, or landmark is located at or near these coordinates: (${location.latitude}, ${location.longitude})? 
    Please provide the following details in JSON format:
    {
      "title": "Name of the location",
      "description": "Brief description",
      "category": "Type of location (e.g., Architecture, Government, Cultural)",
      "historical_period": "Main historical period",
      "significance": "Why this location is historically significant"
    }`;

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
            content: 'You are a knowledgeable historian who identifies historical locations based on coordinates.'
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
      throw new Error('Failed to identify location');
    }

    const identifyData = await identifyResponse.json();
    const locationInfo = JSON.parse(identifyData.choices[0].message.content);

    // Store or update the location in the database
    const { data: locationData, error: locationError } = await supabase
      .from('locations')
      .upsert([
        {
          title: locationInfo.title,
          description: locationInfo.description,
          category: locationInfo.category,
          historical_period: locationInfo.historical_period,
          latitude: location.latitude,
          longitude: location.longitude,
          location: `POINT(${location.longitude} ${location.latitude})`,
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (locationError) {
      throw new Error('Failed to store location data');
    }

    // Now generate a detailed story about the identified location
    const storyPrompt = `Generate a detailed historical story about ${locationInfo.title}.
    Consider:
    - Its historical significance: ${locationInfo.significance}
    - Its architectural and physical features
    - Notable events and people associated with it
    - Its role in the community over time
    
    User interests: ${userPreferences?.interests?.join(', ') || ''}
    
    Return in this JSON format:
    {
      "story": "Detailed historical narrative",
      "facts": ["Interesting fact 1", "Interesting fact 2", "Interesting fact 3"],
      "historicalPeriods": ["Relevant historical periods"],
      "suggestedActivities": ["Activity 1", "Activity 2", "Activity 3"]
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
            content: 'You are a knowledgeable historian who provides detailed, accurate historical information.'
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
    const generatedContent = JSON.parse(storyData.choices[0].message.content);

    // Store the story in the database
    const { error: storyError } = await supabase
      .from('stories')
      .insert([
        {
          location_id: locationData.id,
          content: generatedContent,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

    if (storyError) {
      throw new Error('Failed to store story');
    }

    return new Response(
      JSON.stringify(generatedContent),
      { headers, status: 200 }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify(generateFallbackResponse()),
      { headers, status: 200 }
    );
  }
}

function generateFallbackResponse() {
  return {
    story: "Information about this location is currently unavailable.",
    facts: [
      "Historical sites help us understand our past",
      "Local landmarks tell important stories",
      "Preserving history enriches communities"
    ],
    historicalPeriods: ["Modern Era"],
    suggestedActivities: ["Visit the location", "Learn about local history"]
  };
}
