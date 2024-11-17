import env from '../config/env';
import { supabase } from './supabase';

// Helper function to simulate API delay for development
const simulateDelay = () => new Promise(resolve => setTimeout(resolve, 1000));

// Function to generate personalized historical stories
export const generateHistoricalStory = async (location, userPreferences = {}) => {
  const { interests, languagePreference, accessibilityNeeds, previousVisits } = userPreferences;

  if (!env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT) {
    // Development mock response with personalization
    await simulateDelay();
    const personalizedIntro = interests?.length > 0
      ? `Based on your interest in ${interests.join(', ')}, you'll find this particularly fascinating.`
      : '';

    return {
      story: `${personalizedIntro} This historic location has played a significant role in shaping our community's identity. Originally established in the late 19th century, it has witnessed countless important events and transformations.`,
      facts: [
        "Established in 1885",
        "Renovated in 1923",
        "Hosted several significant community events",
      ],
      audioUrl: null, // Will be populated with ElevenLabs synthesis URL
      simplifiedVersion: "This is a simple version of the story for accessibility needs",
      gamificationPoints: 50,
      suggestedNextLocations: [
        {
          id: 'nearby-1',
          title: 'Another Historic Site',
          distance: '0.5km',
          relevanceScore: 0.85,
        },
      ],
    };
  }

  try {
    const response = await fetch(`${env.getGoogleCloudEndpoint()}/generateStory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        location, 
        userPreferences: {
          interests,
          languagePreference,
          accessibilityNeeds,
          previousVisits,
        }
      }),
    });

    if (!response.ok) throw new Error('Failed to generate story');
    const storyData = await response.json();

    // Generate audio version if voice synthesis is enabled
    if (env.features.enableVoiceSynthesis) {
      try {
        const audioBlob = await generateVoice(
          accessibilityNeeds?.includes('visual') 
            ? storyData.simplifiedVersion 
            : storyData.story
        );
        storyData.audioUrl = URL.createObjectURL(audioBlob);
      } catch (error) {
        console.warn('Voice synthesis failed:', error);
      }
    }

    return storyData;
  } catch (error) {
    console.error('Error generating story:', error);
    throw error;
  }
};

// Function to generate enhanced AR content
export const generateARContent = async (location, userContext = {}) => {
  const { deviceCapabilities, previousInteractions, timeOfDay } = userContext;

  if (!env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT) {
    // Development mock response with enhanced AR features
    await simulateDelay();
    return {
      title: location.title,
      description: "Experience this location's history in augmented reality",
      points_of_interest: [
        {
          id: 'poi-1',
          title: "Original Building",
          description: "View the original architecture from 1885",
          position: { x: 0, y: 1, z: -2 },
          model_url: "https://example.com/3d-models/building.glb",
          animations: [
            {
              id: 'construction',
              name: "Construction Timeline",
              duration: 10000,
            }
          ],
          interactionPoints: [
            {
              position: { x: 0.5, y: 1.2, z: -1.8 },
              action: "reveal_info",
              content: "Click to learn about the architectural style",
            }
          ],
        },
        {
          id: 'poi-2',
          title: "Historical Event",
          description: "Site of the historic gathering in 1923",
          position: { x: 2, y: 0, z: -3 },
          model_url: "https://example.com/3d-models/event.glb",
          animations: [
            {
              id: 'crowd',
              name: "Crowd Gathering",
              duration: 8000,
            }
          ],
        },
      ],
      ambient_sounds: [
        {
          id: 'ambient-1',
          url: "https://example.com/sounds/period-atmosphere.mp3",
          volume: 0.5,
        }
      ],
      lighting_conditions: {
        timeOfDay,
        shadows: true,
        ambient_intensity: 0.8,
      },
    };
  }

  try {
    const response = await fetch(`${env.getGoogleCloudEndpoint()}/generateARContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        location,
        userContext: {
          deviceCapabilities,
          previousInteractions,
          timeOfDay,
        }
      }),
    });

    if (!response.ok) throw new Error('Failed to generate AR content');
    return response.json();
  } catch (error) {
    console.error('Error generating AR content:', error);
    throw error;
  }
};

// Function to get personalized AI chat responses
export const getAIResponse = async (query, context = {}) => {
  const {
    previousMessages = [],
    userProfile = {},
    currentLocation = null,
    timeOfDay = null,
  } = context;

  if (!env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT) {
    // Development mock response with personalization
    await simulateDelay();
    const responses = [
      `Based on your interests, you might want to know that this location has a fascinating history dating back to the late 19th century.`,
      `Given your previous visits to similar sites, you'll appreciate that the architectural style reflects the Victorian influence of that period.`,
      `Since you're interested in community history, you'll be intrigued to know that several significant events took place here over the years.`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  try {
    const response = await fetch(`${env.getGoogleCloudEndpoint()}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query,
        context: {
          previousMessages: previousMessages.slice(-5),
          userProfile,
          currentLocation,
          timeOfDay,
        }
      }),
    });

    if (!response.ok) throw new Error('Failed to get AI response');
    return response.json();
  } catch (error) {
    console.error('Error getting AI response:', error);
    throw error;
  }
};

// Function to generate voice synthesis with enhanced features
export const generateVoice = async (text, options = {}) => {
  const {
    voice_id = '21m00Tcm4TlvDq8ikWAM',
    language = 'en',
    speed = 1.0,
    pitch = 1.0,
  } = options;

  if (!env.EXPO_PUBLIC_ELEVENLABS_API_KEY) {
    console.warn('ElevenLabs API key not found');
    return null;
  }

  try {
    const response = await fetch(`${env.getElevenLabsEndpoint()}/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': env.EXPO_PUBLIC_ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
          style: 1.0,
          use_speaker_boost: true,
        },
        speech_settings: {
          language,
          speed,
          pitch,
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

// Function to handle user-generated content
export const submitUserContent = async (content) => {
  const {
    locationId,
    userId,
    contentType,
    text,
    media,
    tags,
  } = content;

  try {
    // Store content in Supabase
    const { data, error } = await supabase
      .from('user_contributions')
      .insert([{
        location_id: locationId,
        user_id: userId,
        content_type: contentType,
        text,
        media_urls: media,
        tags,
        status: 'pending_review',
        created_at: new Date().toISOString(),
      }]);

    if (error) throw error;

    // Trigger AI content validation
    const validationResponse = await fetch(`${env.getGoogleCloudEndpoint()}/validateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: data[0] }),
    });

    if (!validationResponse.ok) {
      throw new Error('Content validation failed');
    }

    return data[0];
  } catch (error) {
    console.error('Error submitting user content:', error);
    throw error;
  }
};

export default {
  generateHistoricalStory,
  generateARContent,
  getAIResponse,
  generateVoice,
  submitUserContent,
};
