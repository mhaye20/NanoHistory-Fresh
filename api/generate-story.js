import { VertexAI } from '@google-cloud/vertexai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { location, userPreferences } = req.body;

    // Initialize Vertex AI with credentials from environment variables
    const vertexai = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION,
      googleAuthOptions: {
        credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS)
      }
    });

    // Get the model
    const model = vertexai.preview.getGenerativeModel({
      model: 'gemini-pro',
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.9,
        topP: 0.8,
        topK: 40
      }
    });

    // Construct the prompt
    const prompt = `Generate a detailed historical story about a location at coordinates (${location.latitude}, ${location.longitude}). 
    Consider the following aspects:
    - Local history and cultural significance
    - Architectural details if applicable
    - Notable events or people connected to this area
    - How this location has changed over time
    
    User interests: ${userPreferences.interests?.join(', ') || ''}
    Format the response as JSON with the following structure:
    {
      "story": "main story text",
      "facts": ["interesting fact 1", "interesting fact 2", "interesting fact 3"],
      "historicalPeriods": ["period1", "period2"],
      "suggestedActivities": ["activity1", "activity2"]
    }`;

    // Start chat and send message
    const chat = model.startChat();
    const result = await chat.sendMessage(prompt);

    if (!result?.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response from model');
    }

    const generatedContent = JSON.parse(result.response.candidates[0].content.parts[0].text);

    return res.status(200).json(generatedContent);
  } catch (error) {
    console.error('Error generating story:', error);
    return res.status(500).json({ 
      error: 'Failed to generate story',
      details: error.message 
    });
  }
}
