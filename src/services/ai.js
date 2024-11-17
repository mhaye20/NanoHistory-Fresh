import env from '../config/env';
import { supabase } from './supabase';
import * as Location from 'expo-location';

// Helper function to simulate API delay for development
const simulateDelay = () => new Promise(resolve => setTimeout(resolve, 1000));

// Enhanced function to generate personalized historical stories
export const generateHistoricalStory = async (location, userPreferences = {}) => {
  const { interests = [], languagePreference = 'en', accessibilityNeeds = [], previousVisits = [] } = userPreferences;

  if (!env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT) {
    await simulateDelay();
    
    // Enhanced personalization logic
    const interestBasedContent = interests.map(interest => {
      switch(interest.toLowerCase()) {
        case 'architecture':
          return 'The architectural style reflects the period\'s innovative building techniques.';
        case 'culture':
          return 'This site played a crucial role in shaping local traditions.';
        case 'military':
          return 'Strategic importance made this location vital during historical conflicts.';
        default:
          return 'This location holds significant historical value.';
      }
    }).join(' ');

    // Adapt content based on previous visits
    const visitContext = previousVisits.length > 0 
      ? 'Since your last visit, new historical evidence has emerged.'
      : 'First-time visitors often find these details fascinating.';

    // Generate dynamic story elements
    const timeOfDay = new Date().getHours();
    const atmosphericContext = timeOfDay >= 18 || timeOfDay < 6
      ? 'As night falls, imagine the historical events that unfolded here.'
      : 'In the daylight, you can clearly see the historical markers.';

    return {
      story: `${interestBasedContent} ${visitContext} ${atmosphericContext}`,
      facts: [
        "Established in 1885",
        "Renovated in 1923",
        "Hosted several significant community events",
        "Featured in historical documents from 1900",
      ],
      audioUrl: null,
      simplifiedVersion: accessibilityNeeds.includes('cognitive')
        ? "This is an important old place. Many interesting things happened here."
        : null,
      gamificationPoints: calculatePoints(interests, previousVisits),
      suggestedNextLocations: generateSuggestedLocations(location, interests),
      arContent: {
        models: [
          {
            id: 'building-1885',
            name: 'Original Structure',
            description: 'View the building as it appeared in 1885',
            url: 'https://example.com/models/building-1885.glb',
          },
          {
            id: 'event-1923',
            name: 'Historical Event',
            description: 'Experience the renovation of 1923',
            url: 'https://example.com/models/event-1923.glb',
          },
        ],
        hotspots: [
          {
            id: 'entrance',
            title: 'Main Entrance',
            description: 'Original doorway from 1885',
            position: { x: 0, y: 1.6, z: -2 },
          },
          {
            id: 'plaque',
            title: 'Historical Plaque',
            description: 'Commemorating the 1923 renovation',
            position: { x: 1, y: 1.4, z: -1 },
          },
        ],
      },
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

    // Generate audio version if needed
    if (accessibilityNeeds.includes('visual')) {
      try {
        const audioBlob = await generateVoice(
          storyData.simplifiedVersion || storyData.story,
          { language: languagePreference }
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

// Enhanced AR content generation
export const generateARContent = async (location, userContext = {}) => {
  const { deviceCapabilities, previousInteractions = [], timeOfDay, interests = [] } = userContext;

  if (!env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT) {
    await simulateDelay();

    // Generate dynamic AR content based on user interests and time
    const models = interests.includes('architecture')
      ? [
          {
            id: 'architectural-details',
            title: 'Architectural Features',
            description: 'Explore the building\'s unique design elements',
            position: { x: 0, y: 1, z: -2 },
            scale: { x: 1, y: 1, z: 1 },
            animations: ['rotate', 'highlight'],
          },
        ]
      : [];

    // Add historical event recreations
    const events = [
      {
        id: 'historical-event-1',
        title: 'Community Gathering (1923)',
        description: 'Experience a significant moment in history',
        position: { x: 2, y: 0, z: -3 },
        particles: {
          type: 'crowd',
          density: 0.5,
          animation: 'gathering',
        },
      },
    ];

    // Adaptive lighting based on time of day
    const lighting = {
      type: timeOfDay >= 18 || timeOfDay < 6 ? 'night' : 'day',
      intensity: timeOfDay >= 18 || timeOfDay < 6 ? 0.5 : 1,
      shadows: true,
      ambient: {
        color: timeOfDay >= 18 || timeOfDay < 6 ? '#103362' : '#87CEEB',
        intensity: 0.3,
      },
    };

    return {
      models: [...models, ...events],
      lighting,
      interactions: [
        {
          type: 'tap',
          target: 'architectural-details',
          action: 'show_info',
          content: 'Tap elements to learn more about their history',
        },
        {
          type: 'proximity',
          target: 'historical-event-1',
          action: 'play_animation',
          threshold: 2, // meters
        },
      ],
      audio: {
        ambient: {
          url: 'https://example.com/sounds/ambient.mp3',
          volume: 0.3,
        },
        effects: [
          {
            id: 'crowd-noise',
            url: 'https://example.com/sounds/crowd.mp3',
            trigger: 'proximity',
            target: 'historical-event-1',
          },
        ],
      },
    };
  }

  try {
    const response = await fetch(`${env.getGoogleCloudEndpoint()}/generateARContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, userContext }),
    });

    if (!response.ok) throw new Error('Failed to generate AR content');
    return response.json();
  } catch (error) {
    console.error('Error generating AR content:', error);
    throw error;
  }
};

// Enhanced AI chat responses
export const getAIResponse = async (query, context = {}) => {
  const {
    previousMessages = [],
    userProfile = {},
    currentLocation = null,
    timeOfDay = null,
  } = context;

  if (!env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT) {
    await simulateDelay();

    // Context-aware response generation
    const locationContext = currentLocation
      ? `Based on your location near ${currentLocation.title}, `
      : '';

    const timeContext = timeOfDay >= 18 || timeOfDay < 6
      ? 'While it\'s dark now, during the day '
      : '';

    const responses = [
      `${locationContext}you might be interested in exploring the nearby historical landmarks.`,
      `${timeContext}you can see the architectural details that make this place unique.`,
      `Given your interest in ${userProfile.interests?.join(', ') || 'history'}, you'll find fascinating stories about this area.`,
    ];

    // Add suggested actions based on context
    const suggestedActions = [
      {
        type: 'visit',
        title: 'Visit Historical Site',
        description: 'Explore this location in person',
        points: 50,
      },
      {
        type: 'ar_view',
        title: 'View in AR',
        description: 'See historical reconstructions',
        points: 25,
      },
    ];

    return {
      text: responses[Math.floor(Math.random() * responses.length)],
      suggestedActions,
      relatedLocations: await generateNearbyRecommendations(currentLocation),
    };
  }

  try {
    const response = await fetch(`${env.getGoogleCloudEndpoint()}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, context }),
    });

    if (!response.ok) throw new Error('Failed to get AI response');
    return response.json();
  } catch (error) {
    console.error('Error getting AI response:', error);
    throw error;
  }
};

// Enhanced voice synthesis
export const generateVoice = async (text, options = {}) => {
  const {
    voice_id = '21m00Tcm4TlvDq8ikWAM',
    language = 'en',
    speed = 1.0,
    pitch = 1.0,
    style = 'natural',
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
          style: style === 'natural' ? 0.5 : 1.0,
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

// Enhanced user content submission with AI curation
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
    // AI content validation and enhancement
    const enhancedContent = await enhanceUserContent(content);

    // Store in Supabase
    const { data, error } = await supabase
      .from('user_contributions')
      .insert([{
        location_id: locationId,
        user_id: userId,
        content_type: contentType,
        text: enhancedContent.text,
        media_urls: media,
        tags: enhancedContent.tags,
        ai_enhanced: true,
        status: 'pending_review',
        created_at: new Date().toISOString(),
      }]);

    if (error) throw error;

    return {
      ...data[0],
      enhancement_summary: enhancedContent.summary,
    };
  } catch (error) {
    console.error('Error submitting user content:', error);
    throw error;
  }
};

// Helper functions
const calculatePoints = (interests, previousVisits) => {
  let points = 50; // Base points
  points += interests.length * 10; // Points for each interest
  points += previousVisits.length * 5; // Points for loyalty
  return points;
};

const generateSuggestedLocations = (currentLocation, interests) => {
  // Mock nearby locations based on interests
  return [
    {
      id: 'nearby-1',
      title: 'Historical Monument',
      distance: '0.5km',
      relevance: calculateRelevance(interests, ['history', 'architecture']),
    },
    {
      id: 'nearby-2',
      title: 'Cultural Center',
      distance: '1.2km',
      relevance: calculateRelevance(interests, ['culture', 'art']),
    },
  ];
};

const calculateRelevance = (userInterests, locationTags) => {
  const matchingTags = userInterests.filter(interest => 
    locationTags.includes(interest.toLowerCase())
  );
  return matchingTags.length / locationTags.length;
};

const generateNearbyRecommendations = async (currentLocation) => {
  if (!currentLocation) return [];
  
  // Mock recommendations
  return [
    {
      id: 'rec-1',
      title: 'Historic Building',
      distance: '0.3km',
      description: 'A well-preserved example of Victorian architecture',
    },
    {
      id: 'rec-2',
      title: 'Heritage Site',
      distance: '0.8km',
      description: 'Site of significant historical events',
    },
  ];
};

const enhanceUserContent = async (content) => {
  // Mock AI enhancement
  return {
    text: content.text,
    tags: [...content.tags, 'ai-curated'],
    summary: 'AI-enhanced user contribution about local history',
  };
};

export default {
  generateHistoricalStory,
  generateARContent,
  getAIResponse,
  generateVoice,
  submitUserContent,
};
