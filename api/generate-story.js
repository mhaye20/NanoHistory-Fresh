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

    // First, get the location context using Google Places API
    console.log('Fetching location context...');
    const placeResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.latitude},${location.longitude}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
    );

    if (!placeResponse.ok) {
      const placeError = await placeResponse.text();
      throw new Error(`Failed to get location context: ${placeError}`);
    }

    const placeData = await placeResponse.json();
    console.log('Location context:', placeData.results[0]?.formatted_address);
    const locationContext = placeData.results[0]?.formatted_address || '';

    // Ask OpenAI to identify what's at these coordinates
    console.log('Identifying location...');
    const identificationPrompt = `What significant historical location, building, or landmark is located at or near these coordinates: (${location.latitude}, ${location.longitude}) in ${locationContext}? 
    Please provide the following details in JSON format:
    {
      "title": "Name of the location",
      "description": "Brief description",
      "category": "Type of location (e.g., Architecture, Government, Cultural)",
      "historical_period": "Main historical period",
      "significance": "Why this location is historically significant",
      "place_query": "Specific search query to find this exact place in Google Places API"
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
      const identifyError = await identifyResponse.text();
      throw new Error(`Failed to identify location: ${identifyError}`);
    }

    const identifyData = await identifyResponse.json();
    console.log('OpenAI response received');
    const locationInfo = JSON.parse(identifyData.choices[0].message.content);

    // Get place photos using Google Places API
    console.log('Fetching place photos...');
    const placesResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(locationInfo.place_query)}&inputtype=textquery&fields=photos,place_id&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
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
        imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=1200x800&location=${location.latitude},${location.longitude}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`;
        console.log('Falling back to Street View');
      }
    }

    // Store or update the location in the database
    console.log('Storing location data...');
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
          image_url: imageUrl,
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (locationError) {
      throw new Error('Failed to store location data');
    }

    // Now generate a detailed story about the identified location
    console.log('Generating story...');
    const storyPrompt = `Generate a detailed historical story about ${locationInfo.title} in ${locationContext}.
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
      const storyError = await storyResponse.text();
      throw new Error(`Failed to generate story: ${storyError}`);
    }

    const storyData = await storyResponse.json();
    const generatedContent = JSON.parse(storyData.choices[0].message.content);

    // Add the image URL to the content
    const contentWithImage = {
      ...generatedContent,
      imageUrl: imageUrl
    };

    // Store the story in the database
    console.log('Storing story...');
    const { error: storyError } = await supabase
      .from('stories')
      .insert([
        {
          location_id: locationData.id,
          content: contentWithImage,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]);

    if (storyError) {
      throw new Error('Failed to store story');
    }

    console.log('Successfully generated and stored story with image');
    return new Response(
      JSON.stringify(contentWithImage),
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
    suggestedActivities: ["Visit the location", "Learn about local history"],
    imageUrl: null
  };
}
