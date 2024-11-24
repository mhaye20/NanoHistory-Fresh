import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import env from '../config/env';

// Debug logging function
const logDebug = (context, message, data = null) => {
  console.log(`[${context}] ${message}`, data ? data : '');
};

// Error logging function
const logError = (context, error, additionalInfo = null) => {
  console.error(`[${context}] Error:`, error);
  if (error.message) console.error(`[${context}] Message:`, error.message);
  if (error.status) console.error(`[${context}] Status:`, error.status);
  if (error.statusText) console.error(`[${context}] Status Text:`, error.statusText);
  if (error.data) console.error(`[${context}] Error Data:`, error.data);
  if (additionalInfo) console.error(`[${context}] Additional Info:`, additionalInfo);
};

// SecureStore adapter for Supabase auth persistence
const ExpoSecureStoreAdapter = {
  getItem: (key) => {
    logDebug('SecureStore', `Getting item: ${key}`);
    return SecureStore.getItemAsync(key);
  },
  setItem: (key, value) => {
    logDebug('SecureStore', `Setting item: ${key}`);
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key) => {
    logDebug('SecureStore', `Removing item: ${key}`);
    return SecureStore.deleteItemAsync(key);
  },
};

// Get the redirect URL based on platform
const getRedirectUrl = () => {
  // Use a simpler redirect URL format
  return 'nanohistory://';
};

// Initialize Supabase client with anon key for auth
export const supabase = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_KEY,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      debug: true, // Enable Supabase's internal debug logging
      onAuthStateChange: (event, session) => {
        logDebug('Auth', `Auth state changed: ${event}`, {
          session: session ? 'Session exists' : 'No session',
          user: session?.user?.email,
        });
      },
    },
  }
);

// Log Supabase configuration
logDebug('Supabase', 'Configuration', {
  url: env.EXPO_PUBLIC_SUPABASE_URL,
  authFlow: 'pkce',
  redirectUrl: getRedirectUrl(),
});

// Initialize admin client with service role key for database operations
export const adminClient = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

// Cache for locations
let locationsCache = {
  data: null,
  timestamp: null,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

// Clear all locations from the database
export const clearLocations = async () => {
  try {
    logDebug('Locations', 'Clearing existing locations...');
    
    // First clear AI generated stories
    const { error: aiError } = await adminClient
      .from('ai_generated_stories')
      .delete()
      .not('id', 'is', null);

    if (aiError) {
      logError('Locations', aiError, 'Error clearing AI stories');
      throw aiError;
    }

    // Then clear stories
    const { error: storiesError } = await adminClient
      .from('stories')
      .delete()
      .not('id', 'is', null);

    if (storiesError) {
      logError('Locations', storiesError, 'Error clearing stories');
      throw storiesError;
    }

    // Finally clear locations
    const { error: locationsError } = await adminClient
      .from('locations')
      .delete()
      .not('id', 'is', null);

    if (locationsError) {
      logError('Locations', locationsError, 'Error clearing locations');
      throw locationsError;
    }

    // Clear cache
    locationsCache.data = null;
    locationsCache.timestamp = null;

    logDebug('Locations', 'All locations cleared from database');
  } catch (error) {
    logError('Locations', error);
    throw error;
  }
};

// Initialize locations using the API
export const initializeLocations = async (latitude, longitude) => {
  try {
    logDebug('Locations', 'Initializing locations...', { latitude, longitude });
    
    const response = await fetch('https://micro-history.vercel.app/api/initialize-locations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ latitude, longitude }),
    });

    if (!response.ok) {
      throw new Error('Failed to initialize locations');
    }

    const data = await response.json();
    
    // Store locations and stories in Supabase
    for (const item of data.locations) {
      // Create location
      const { data: location, error: locationError } = await adminClient
        .from('locations')
        .insert([item.location])
        .select()
        .single();

      if (locationError) {
        throw locationError;
      }

      // Create AI story with story types
      const { error: storyError } = await adminClient
        .from('ai_generated_stories')
        .insert([{
          location_id: location.id,
          content: item.story.content,
          story_types: item.story.story_types,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (storyError) {
        throw storyError;
      }
    }

    logDebug('Locations', 'Successfully initialized locations');
    return data;
  } catch (error) {
    logError('Locations', error);
    throw error;
  }
};

export const getLocationDetails = async (locationId) => {
  try {
    logDebug('Locations', 'Fetching location details', { locationId });

    const { data: location, error: locationError } = await adminClient
      .from('locations')
      .select(`
        id,
        title,
        description,
        latitude,
        longitude,
        image_url,
        rating,
        visit_count,
        historical_period,
        category,
        updated_at,
        stories (*),
        ai_generated_stories (
          content,
          story_types
        )
      `)
      .eq('id', locationId)
      .single();

    if (locationError) {
      logError('Locations', locationError, { locationId });
      throw locationError;
    }

    const aiStory = location.ai_generated_stories?.[0];
    const hasUserStories = location.stories && location.stories.length > 0;

    const transformedLocation = {
      id: location.id,
      title: location.title,
      description: location.description,
      latitude: location.latitude,
      longitude: location.longitude,
      imageUrl: location.image_url,
      rating: location.rating,
      visitCount: location.visit_count,
      hasStories: hasUserStories,
      hasAR: false,
      period: location.historical_period,
      category: location.category,
      lastUpdated: location.updated_at,
      aiGeneratedStory: aiStory?.content,
      userStories: location.stories || [],
      story_types: aiStory?.story_types || []
    };

    logDebug('Locations', 'Location details fetched', { 
      locationId,
      hasStories: hasUserStories,
      hasAiStory: !!aiStory,
      storyTypes: transformedLocation.story_types
    });

    return transformedLocation;
  } catch (error) {
    logError('Locations', error, { locationId });
    throw error;
  }
};

export const getNearbyLocations = async (latitude, longitude, filter = 'all', radius = 5000, page = 1, limit = 10) => {
  try {
    logDebug('Locations', 'Getting nearby locations', { 
      latitude, 
      longitude, 
      filter, 
      radius
    });

    // First get all ai_generated_stories to ensure we have the story types
    const { data: aiStories, error: aiError } = await adminClient
      .from('ai_generated_stories')
      .select('*');

    if (aiError) {
      logError('Locations', aiError);
      return { locations: [], hasMore: false };
    }

    // Create a map of location_id to story types for quick lookup
    const storyTypesMap = aiStories.reduce((acc, story) => {
      if (story.location_id && Array.isArray(story.story_types)) {
        acc[story.location_id] = story.story_types;
      }
      return acc;
    }, {});

    logDebug('Locations', 'Story types map:', storyTypesMap);

    let query;

    if (filter === 'stories') {
      // For stories filter, join with the stories table to get locations with user stories
      query = adminClient
        .from('locations')
        .select(`
          id,
          title,
          description,
          latitude,
          longitude,
          image_url,
          rating,
          visit_count,
          historical_period,
          category,
          updated_at,
          stories!inner (*),
          ai_generated_stories (
            id,
            content,
            story_types
          )
        `)
        .order('updated_at', { ascending: false });
    } else {
      // For other filters, use the base query
      query = adminClient
        .from('locations')
        .select(`
          id,
          title,
          description,
          latitude,
          longitude,
          image_url,
          rating,
          visit_count,
          historical_period,
          category,
          updated_at,
          stories (*),
          ai_generated_stories (
            id,
            content,
            story_types
          )
        `);

      // Apply filter-specific modifications
      if (filter === 'popular') {
        query = query.order('visit_count', { ascending: false });
      }
    }

    // Execute query
    let result = await query;
    
    if (result.error) {
      logError('Locations', result.error);
      return { locations: [], hasMore: false };
    }

    // Log raw data for debugging
    logDebug('Locations', 'Raw data from database:', {
      locationCount: result.data?.length,
      firstLocation: result.data?.[0] ? {
        id: result.data[0].id,
        title: result.data[0].title,
        story_types: storyTypesMap[result.data[0].id] || [],
        raw_ai_stories: result.data[0].ai_generated_stories,
        story_types_from_ai: result.data[0].ai_generated_stories?.[0]?.story_types
      } : null
    });

    // If no locations found and coordinates are provided, try to initialize locations
    if ((!result.data || result.data.length === 0) && latitude && longitude) {
      logDebug('Locations', 'No locations found, initializing...');
      await initializeLocations(latitude, longitude);
      
      // Retry the query after initialization
      result = await query;
      
      if (result.error) {
        throw result.error;
      }
    }

    // Transform locations with distances and stories
    const transformedLocations = (result.data || []).map(location => {
      const aiStory = location.ai_generated_stories?.[0];
      // Try to get story types from our map first, then fall back to the AI story
      const storyTypes = storyTypesMap[location.id] || aiStory?.story_types || [];
      
      logDebug('Locations', `Story types for location ${location.id}:`, {
        locationId: location.id,
        title: location.title,
        storyTypes: JSON.stringify(storyTypes),
        storyTypesFromMap: storyTypesMap[location.id],
        storyTypesFromAi: aiStory?.story_types,
        hasAiStories: location.ai_generated_stories?.length > 0,
        rawAiStories: location.ai_generated_stories
      });

      const hasUserStories = location.stories && location.stories.length > 0;

      // If we have coordinates, calculate distance
      let distance = null;
      if (latitude && longitude) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = latitude * Math.PI/180;
        const φ2 = location.latitude * Math.PI/180;
        const Δφ = (location.latitude - latitude) * Math.PI/180;
        const Δλ = (location.longitude - longitude) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        distance = R * c; // Distance in meters
      }

      return {
        id: location.id,
        title: location.title,
        description: location.description,
        latitude: location.latitude,
        longitude: location.longitude,
        imageUrl: location.image_url,
        rating: location.rating,
        visitCount: location.visit_count,
        hasStories: hasUserStories,
        hasAR: false,
        distance: distance,
        period: location.historical_period,
        category: location.category,
        lastUpdated: location.updated_at,
        aiGeneratedStory: aiStory?.content,
        userStories: location.stories || [],
        story_types: storyTypes
      };
    });

    // Sort by distance if coordinates provided and nearby filter
    let sortedLocations = [...transformedLocations];
    if (latitude && longitude && filter === 'nearby') {
      sortedLocations.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    }

    // Filter by radius if coordinates provided
    if (latitude && longitude && radius) {
      sortedLocations = sortedLocations.filter(loc => 
        loc.distance !== null && loc.distance <= radius
      );
    }

    // Log story types for each location after transformation
    logDebug('Locations', 'Story types after transformation:', {
      locations: sortedLocations.map(loc => ({
        id: loc.id,
        title: loc.title,
        story_types: JSON.stringify(loc.story_types)
      }))
    });

    // Collect all unique story types
    const allTypes = new Set(['all']);
    sortedLocations.forEach(loc => {
      if (Array.isArray(loc.story_types)) {
        loc.story_types.forEach(type => allTypes.add(type));
      }
    });

    const availableTypes = Array.from(allTypes);
    logDebug('Locations', 'Available story types:', {
      types: availableTypes,
      count: availableTypes.length,
      locationsWithTypes: sortedLocations.filter(loc => Array.isArray(loc.story_types) && loc.story_types.length > 0).length,
      typeDistribution: availableTypes.reduce((acc, type) => {
        if (type === 'all') return acc;
        acc[type] = sortedLocations.filter(loc => 
          Array.isArray(loc.story_types) && loc.story_types.includes(type)
        ).length;
        return acc;
      }, {})
    });

    return {
      locations: sortedLocations,
      hasMore: false
    };

  } catch (error) {
    logError('Locations', error, { latitude, longitude, filter });
    return { locations: [], hasMore: false };
  }
};

export const createStory = async (storyData) => {
  try {
    logDebug('Stories', 'Creating new story', storyData);
    const { latitude, longitude, location_id, ...rest } = storyData;

    let locationId = location_id;
    let isHistoricLocation = false;

    if (!locationId) {
      // If no location_id provided, find nearest location
      const { data: distances, error: distanceError } = await adminClient
        .rpc('calculate_distances', {
          lat: latitude,
          lng: longitude,
          radius_meters: 100 // Look for locations within 100 meters
        });

      if (distanceError) {
        logError('Stories', distanceError, 'Error finding nearest location');
        throw distanceError;
      }

      if (distances && distances.length > 0) {
        const nearestLocation = distances[0];
        
        // Check if location has AI-generated stories
        const { data: location, error: locationError } = await adminClient
          .from('locations')
          .select('ai_generated_stories')
          .eq('id', nearestLocation.id)
          .single();

        if (!locationError && location.ai_generated_stories?.length > 0) {
          locationId = nearestLocation.id;
          isHistoricLocation = true;
          logDebug('Stories', 'User is at historic location', { locationId });
        }
      }
    } else {
      // If location_id provided, verify it's a historic location
      const { data: location, error: locationError } = await adminClient
        .from('locations')
        .select('ai_generated_stories')
        .eq('id', locationId)
        .single();

      if (!locationError && location.ai_generated_stories?.length > 0) {
        isHistoricLocation = true;
        logDebug('Stories', 'Using provided historic location', { locationId });
      }
    }

    if (!locationId) {
      // Create new non-historic location
      const { data: newLocation, error: createLocationError } = await adminClient
        .from('locations')
        .insert([{
          title: `Location near ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          description: 'A location with user stories',
          latitude,
          longitude,
          location: `POINT(${longitude} ${latitude})`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (createLocationError) {
        logError('Stories', createLocationError, 'Error creating location');
        throw createLocationError;
      }

      locationId = newLocation.id;
      logDebug('Stories', 'Created new non-historic location', { locationId });
    }

    // Create the story with the location ID
    const { data: story, error: storyError } = await adminClient
      .from('stories')
      .insert([{
        ...rest,
        location_id: locationId,
      }])
      .select(`
        *,
        location:locations(*)
      `)
      .single();

    if (storyError) {
      logError('Stories', storyError, 'Error creating story');
      throw storyError;
    }

    // Update location's updated_at timestamp
    const { error: updateError } = await adminClient
      .from('locations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', locationId);

    if (updateError) {
      logError('Stories', updateError, 'Error updating location timestamp');
    }

    logDebug('Stories', 'Story created successfully', { 
      storyId: story.id,
      locationId,
      isHistoricLocation
    });

    return {
      ...story,
      isHistoricLocation
    };
  } catch (error) {
    logError('Stories', error);
    throw error;
  }
};

export const createLocation = async (locationData) => {
  try {
    logDebug('Locations', 'Creating new location', locationData);
    const { latitude, longitude, ...rest } = locationData;
    
    const { data, error } = await adminClient
      .from('locations')
      .insert([{
        ...rest,
        latitude,
        longitude,
        location: `POINT(${longitude} ${latitude})`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select();

    if (error) throw error;

    logDebug('Locations', 'Location created successfully', { 
      locationId: data[0].id 
    });

    return data[0];
  } catch (error) {
    logError('Locations', error);
    throw error;
  }
};

export const updateLocation = async (id, updates) => {
  try {
    logDebug('Locations', 'Updating location', { id, updates });
    const { data, error } = await adminClient
      .from('locations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    logDebug('Locations', 'Location updated successfully', { 
      locationId: data[0].id 
    });

    return data[0];
  } catch (error) {
    logError('Locations', error, { id });
    throw error;
  }
};

export const incrementVisitCount = async (locationId) => {
  try {
    logDebug('Locations', 'Incrementing visit count', { locationId });
    const { data, error } = await adminClient.rpc('increment_visit_count', {
      location_id: locationId
    });

    if (error) throw error;

    logDebug('Locations', 'Visit count incremented successfully', { 
      locationId 
    });

    return data;
  } catch (error) {
    logError('Locations', error, { locationId });
    throw error;
  }
};

export const getStories = async (locationId = null) => {
  try {
    logDebug('Stories', 'Fetching stories', { locationId });
    let query = adminClient
      .from('stories')
      .select(`
        *,
        location:locations(*),
        author:profiles(*)
      `)
      .order('created_at', { ascending: false });

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) throw error;

    logDebug('Stories', 'Stories fetched successfully', { 
      count: data.length,
      locationId 
    });

    return data;
  } catch (error) {
    logError('Stories', error, { locationId });
    return [];
  }
};

export const signInWithEmail = async (email, password) => {
  try {
    logDebug('Auth', 'Attempting sign in', { email });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    logDebug('Auth', 'Sign in successful', { 
      email,
      userId: data.user?.id 
    });

    return data;
  } catch (error) {
    logError('Auth', error, { email });
    throw error;
  }
};

export const signUpWithEmail = async (email, password, options = {}) => {
  try {
    logDebug('Auth', 'Attempting sign up', { 
      email,
      options: {
        ...options,
        emailRedirectTo: getRedirectUrl(),
      }
    });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...options,
        emailRedirectTo: getRedirectUrl(),
        data: {
          ...options.data,
          email_confirmed: false,
        },
      },
    });

    if (error) throw error;

    logDebug('Auth', 'Sign up response', {
      user: data.user?.email,
      sessionExists: !!data.session,
      confirmationSent: !data.session,
    });

    return data;
  } catch (error) {
    logError('Auth', error, { 
      email,
      redirectUrl: getRedirectUrl(),
      supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL
    });
    throw error;
  }
};

export const signOut = async () => {
  try {
    logDebug('Auth', 'Attempting sign out');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    logDebug('Auth', 'Sign out successful');
  } catch (error) {
    logError('Auth', error);
    throw error;
  }
};

export const uploadImage = async (filePath, file) => {
  try {
    logDebug('Storage', 'Uploading image', { filePath });
    const { data, error } = await adminClient.storage
      .from('images')
      .upload(filePath, file);

    if (error) throw error;

    logDebug('Storage', 'Image uploaded successfully', { 
      filePath,
      path: data.path 
    });

    return data;
  } catch (error) {
    logError('Storage', error, { filePath });
    throw error;
  }
};

export const getImageUrl = (path) => {
  if (!path) return null;
  const url = adminClient.storage.from('images').getPublicUrl(path).data.publicUrl;
  logDebug('Storage', 'Generated image URL', { path, url });
  return url;
};

export default {
  supabase,
  adminClient,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  createStory,
  getStories,
  getNearbyLocations,
  createLocation,
  updateLocation,
  incrementVisitCount,
  uploadImage,
  getImageUrl,
  clearLocations,
  initializeLocations,
};
