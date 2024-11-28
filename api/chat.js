export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

// Convert PEM to binary buffer
function pemToBuffer(pem) {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function generateGoogleToken() {
  const credentials = JSON.parse(process.env.EXPO_PUBLIC_GOOGLE_CREDENTIALS);
  const now = Math.floor(Date.now() / 1000);
  
  // Create JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: credentials.private_key_id
  };

  // Create JWT claim set
  const claim_set = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  // Base64url encode the header and claim set
  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const encodedClaimSet = btoa(JSON.stringify(claim_set)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  // Create the signature input
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  try {
    // Convert PEM private key to binary format
    const privateKeyBuffer = pemToBuffer(credentials.private_key);

    // Import the private key
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    // Sign the input
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(signatureInput)
    );

    // Create the JWT
    const jwt = `${signatureInput}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token: ' + JSON.stringify(tokenData));
    }
    return tokenData.access_token;
  } catch (error) {
    console.error('Token generation error:', error);
    throw error;
  }
}

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

    // Get access token using Edge-compatible method
    const accessToken = await generateGoogleToken();

    // Format the conversation history for Gemini
    const messages = [];

    // Add system context
    messages.push({
      role: 'user',
      parts: [{ text: `You are a knowledgeable historical guide who helps users explore and learn about historical locations and events. Consider the following context: User interests: ${context.userProfile?.interests?.join(', ') || 'history'}. ${context.currentLocation ? `Current location: near coordinates (${context.currentLocation.coords.latitude}, ${context.currentLocation.coords.longitude}).` : ''}` }]
    });
    messages.push({
      role: 'assistant',
      parts: [{ text: 'Understood. I will help guide users through historical locations and events.' }]
    });

    // Add conversation history
    if (context.previousMessages) {
      context.previousMessages.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          parts: [{ text: msg.text }]
        });
      });
    }

    // Add current query
    messages.push({
      role: 'user',
      parts: [{ text: query }]
    });

    // Make the request to Gemini Pro
    const response = await fetch(
      `https://${process.env.EXPO_PUBLIC_GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com/v1/projects/${process.env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT}/locations/${process.env.EXPO_PUBLIC_GOOGLE_CLOUD_LOCATION}/publishers/google/models/gemini-pro:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          contents: messages,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
            topP: 0.8,
            topK: 40
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      throw new Error('Failed to get AI response');
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response format from Gemini API');
    }

    const aiResponse = data.candidates[0].content.parts[0].text;

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
