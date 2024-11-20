import { GoogleAuth } from 'google-auth-library';

export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

// Initialize Google Auth client
const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.EXPO_PUBLIC_GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

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
    const { query, context } = body;

    // Get access token
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    // Format the conversation for Vertex AI
    const formattedMessages = context.previousMessages?.map(msg => ({
      author: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.text
    })) || [];

    // Add the current query
    formattedMessages.push({
      author: 'user',
      content: query
    });

    // Prepare the request for Vertex AI
    const requestBody = {
      instances: [{
        context: `You are a knowledgeable historical guide who helps users explore and learn about historical locations and events. Consider the following context: User interests: ${context.userProfile?.interests?.join(', ') || 'history'}. ${context.currentLocation ? `Current location: near coordinates (${context.currentLocation.coords.latitude}, ${context.currentLocation.coords.longitude}).` : ''}`,
        examples: [],
        messages: formattedMessages,
      }],
      parameters: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.8,
        topK: 40
      }
    };

    // Make the request to Vertex AI
    const response = await fetch(
      `https://${process.env.EXPO_PUBLIC_GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/projects/${process.env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT}/locations/${process.env.EXPO_PUBLIC_GOOGLE_CLOUD_LOCATION}/publishers/google/models/chat-bison:predict`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.token}`
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vertex AI Error:', errorText);
      throw new Error('Failed to get AI response');
    }

    const data = await response.json();
    const aiResponse = data.predictions[0].candidates[0].content;

    // Generate suggested actions based on the response
    const suggestedActions = [
      {
        type: 'discover',
        title: 'Explore Nearby',
        points: 50,
      },
      {
        type: 'tour',
        title: 'Start Tour',
        points: 100,
      }
    ];

    return new Response(
      JSON.stringify({
        text: aiResponse,
        suggestedActions,
        relatedLocations: []
      }),
      { headers, status: 200 }
    );

  } catch (error) {
    console.error('Error in chat endpoint:', error);
    return new Response(
      JSON.stringify({
        text: "I apologize, but I'm having trouble processing your request at the moment. Please try again.",
        suggestedActions: [],
        relatedLocations: []
      }),
      { headers, status: 200 }
    );
  }
}
