import env from '../config/env';
import { supabase } from './supabase';

// Enhanced function to generate personalized historical stories using Vertex AI
export const generateHistoricalStory = async (location, userPreferences = {}) => {
  const { interests = [], languagePreference = 'en', accessibilityNeeds = [], previousVisits = [] } = userPreferences;

  try {
    // First check cache
    const { data: cachedStory } = await supabase
      .from('ai_generated_stories')
      .select('content')
      .eq('location_id', location.id)
      .single();

    if (cachedStory) {
      console.log('Using cached story for location:', location.id);
      return {
        ...cachedStory.content,
        imageUrl: cachedStory.content.imageUrl,
        audioUrl: null,
        simplifiedVersion: accessibilityNeeds.includes('cognitive')
          ? cachedStory.content.story.split('.').slice(0, 3).join('.') + '.'
          : null,
      };
    }

    // Generate story locally if Vercel endpoint is not available
    if (!env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT) {
      console.log('Generating local story for location:', location.id);
      const localStory = generateLocalStory(location);
      
      // Cache the local story
      await supabase.from('ai_generated_stories').upsert([
        {
          location_id: location.id,
          content: localStory,
          created_at: new Date().toISOString(),
        }
      ]);

      return localStory;
    }

    // Call our Vercel serverless function
    const response = await fetch('https://micro-history.vercel.app/api/generate-story', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        userPreferences: {
          interests,
          languagePreference,
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate story from API');
    }

    let generatedContent;
    try {
      const text = await response.text();
      // Try to extract JSON from the response if it contains extra text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Response is not in valid JSON format');
      }
      generatedContent = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      throw new Error('Invalid response format from API');
    }

    // Validate the response structure
    if (!generatedContent.story || !Array.isArray(generatedContent.facts) || 
        !Array.isArray(generatedContent.historicalPeriods) || 
        !Array.isArray(generatedContent.suggestedActivities)) {
      throw new Error('Invalid response structure from API');
    }

    // Include the image URL in the content
    const contentToCache = {
      ...generatedContent,
      imageUrl: generatedContent.imageUrl
    };

    // Store the generated story in Supabase for future use
    const { error: cacheError } = await supabase.from('ai_generated_stories').upsert([
      {
        location_id: location.id,
        content: contentToCache,
        created_at: new Date().toISOString(),
      }
    ]);

    if (cacheError) {
      console.error('Error caching story:', cacheError);
    }

    return {
      story: generatedContent.story,
      facts: generatedContent.facts,
      historicalPeriods: generatedContent.historicalPeriods,
      suggestedActivities: generatedContent.suggestedActivities,
      imageUrl: generatedContent.imageUrl,
      audioUrl: null,
      simplifiedVersion: accessibilityNeeds.includes('cognitive')
        ? generatedContent.story.split('.').slice(0, 3).join('.') + '.'
        : null,
    };
  } catch (error) {
    console.error('Error generating story:', error);
    return generateLocalStory(location);
  }
};

// Function to generate a local story when API is unavailable
const generateLocalStory = (location) => {
  const periods = ['Colonial Era', 'Victorian Era', 'Modern Era', '19th Century', '20th Century'];
  const randomPeriod = periods[Math.floor(Math.random() * periods.length)];
  
  const facts = [
    `This location at ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} has been a significant landmark.`,
    location.category ? `The site is notable for its ${location.category.toLowerCase()} heritage.` : 'The site holds historical significance.',
    location.period ? `Dating back to the ${location.period}, this location has witnessed many changes.` : 'This area has evolved significantly over time.',
  ];

  const activities = [
    'Take a guided walking tour',
    'Photograph historical architecture',
    'Research local history',
    'Visit nearby landmarks',
  ];

  return {
    story: `${location.description || 'This historical site'} stands as a testament to the rich history of the area. Over time, it has played a vital role in shaping the local community and culture.`,
    facts,
    historicalPeriods: [randomPeriod],
    suggestedActivities: activities.slice(0, 3),
    imageUrl: location.image_url,
    audioUrl: null,
    simplifiedVersion: null,
  };
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
          threshold: 2,
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
    const response = await fetch('https://micro-history.vercel.app/api/generate-ar-content', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ location, userContext }),
    });

    if (!response.ok) throw new Error('Failed to generate AR content');
    return response.json();
  } catch (error) {
    console.error('Error generating AR content:', error);
    throw error;
  }
};

// Enhanced AI chat responses using Vertex AI directly
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
    // Call our serverless endpoint
    const response = await fetch('https://micro-history.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        context: {
          previousMessages,
          userProfile,
          currentLocation,
          timeOfDay,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Chat API Error:', errorText);
      throw new Error('Failed to get AI response');
    }

    const data = await response.json();
    return {
      text: data.text,
      suggestedActions: data.suggestedActions,
      relatedLocations: await generateNearbyRecommendations(currentLocation),
    };
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
const simulateDelay = () => new Promise(resolve => setTimeout(resolve, 1000));

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
