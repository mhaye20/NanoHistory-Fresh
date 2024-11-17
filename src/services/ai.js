import env from '../config/env';

// Helper function to simulate API delay for development
const simulateDelay = () => new Promise(resolve => setTimeout(resolve, 1000));

// Function to generate historical stories
export const generateHistoricalStory = async (location, interests = []) => {
  if (!env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT) {
    // Development mock response
    await simulateDelay();
    return {
      story: "This historic location has played a significant role in shaping our community's identity. Originally established in the late 19th century, it has witnessed countless important events and transformations.",
      facts: [
        "Established in 1885",
        "Renovated in 1923",
        "Hosted several significant community events",
      ],
    };
  }

  try {
    const response = await fetch(`https://${env.EXPO_PUBLIC_GOOGLE_CLOUD_LOCATION}-${env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT}.cloudfunctions.net/generateStory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ location, interests }),
    });

    if (!response.ok) throw new Error('Failed to generate story');
    return response.json();
  } catch (error) {
    console.error('Error generating story:', error);
    throw error;
  }
};

// Function to generate AR content
export const generateARContent = async (location) => {
  if (!env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT) {
    // Development mock response
    await simulateDelay();
    return {
      title: location.title,
      description: "Experience this location's history in augmented reality",
      points_of_interest: [
        {
          title: "Original Building",
          description: "View the original architecture from 1885",
          position: { x: 0, y: 1, z: -2 },
        },
        {
          title: "Historical Event",
          description: "Site of the historic gathering in 1923",
          position: { x: 2, y: 0, z: -3 },
        },
      ],
    };
  }

  try {
    const response = await fetch(`https://${env.EXPO_PUBLIC_GOOGLE_CLOUD_LOCATION}-${env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT}.cloudfunctions.net/generateARContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ location }),
    });

    if (!response.ok) throw new Error('Failed to generate AR content');
    return response.json();
  } catch (error) {
    console.error('Error generating AR content:', error);
    throw error;
  }
};

// Function to get AI chat responses
export const getAIResponse = async (query, context = {}) => {
  if (!env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT) {
    // Development mock response
    await simulateDelay();
    const responses = [
      "This location has a fascinating history dating back to the late 19th century.",
      "The architectural style reflects the Victorian influence of that period.",
      "Several significant community events took place here over the years.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  try {
    const response = await fetch(`https://${env.EXPO_PUBLIC_GOOGLE_CLOUD_LOCATION}-${env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT}.cloudfunctions.net/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, context }),
    });

    if (!response.ok) throw new Error('Failed to get AI response');
    return response.json();
  } catch (error) {
    console.error('Error getting AI response:', error);
    throw error;
  }
};

// Function to generate voice synthesis
export const generateVoice = async (text) => {
  if (!env.EXPO_PUBLIC_ELEVENLABS_API_KEY) {
    console.warn('ElevenLabs API key not found');
    return null;
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': env.EXPO_PUBLIC_ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) throw new Error('Failed to generate voice');
    return response.blob();
  } catch (error) {
    console.error('Error generating voice:', error);
    throw error;
  }
};

export default {
  generateHistoricalStory,
  generateARContent,
  getAIResponse,
  generateVoice,
};