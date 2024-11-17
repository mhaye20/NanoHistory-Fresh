import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import env from '../config/env';

// SecureStore adapter for Supabase auth persistence
const ExpoSecureStoreAdapter = {
  getItem: (key) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key, value) => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key) => {
    return SecureStore.deleteItemAsync(key);
  },
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
    },
  }
);

// Initialize admin client with service role key for database operations
const adminClient = createClient(
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
    console.log('Clearing existing locations...');
    
    // First clear AI generated stories
    const { error: aiError } = await adminClient
      .from('ai_generated_stories')
      .delete()
      .not('id', 'is', null);

    if (aiError) {
      console.error('Error clearing AI stories:', aiError);
      throw aiError;
    }

    // Then clear stories
    const { error: storiesError } = await adminClient
      .from('stories')
      .delete()
      .not('id', 'is', null);

    if (storiesError) {
      console.error('Error clearing stories:', storiesError);
      throw storiesError;
    }

    // Finally clear locations
    const { error: locationsError } = await adminClient
      .from('locations')
      .delete()
      .not('id', 'is', null);

    if (locationsError) {
      console.error('Error clearing locations:', locationsError);
      throw locationsError;
    }

    // Clear cache
    locationsCache.data = null;
    locationsCache.timestamp = null;

    console.log('All locations cleared from database');
  } catch (error) {
    console.error('Error clearing locations:', error);
    throw error;
  }
};

export const getLocationDetails = async (locationId) => {
  try {
    const { data: location, error: locationError } = await adminClient
      .from('locations')
      .select(`
        *,
        ai_generated_stories (
          content
        )
      `)
      .eq('id', locationId)
      .single();

    if (locationError) {
      console.error('Error fetching location:', locationError);
      throw locationError;
    }

    const story = location.ai_generated_stories?.[0]?.content;

    return {
      id: location.id,
      title: location.title,
      description: location.description,
      latitude: location.latitude,
      longitude: location.longitude,
      imageUrl: location.image_url,
      rating: location.rating,
      visitCount: location.visit_count,
      hasStories: !!story,
      hasAR: false,
      period: location.historical_period,
      category: location.category,
      lastUpdated: location.updated_at,
      aiGeneratedStory: story
    };
  } catch (error) {
    console.error('Error getting location details:', error);
    throw error;
  }
};

export const getNearbyLocations = async (latitude, longitude, filter = 'all', radius = 5000, page = 1, limit = 10) => {
  try {
    console.log('Getting nearby locations with:', { latitude, longitude, filter, radius, page, limit });

    if (!latitude || !longitude) {
      console.error('No location provided');
      return { locations: [], hasMore: false };
    }

    const offset = (page - 1) * limit;

    // Get base locations query
    let baseQuery = adminClient
      .from('locations')
      .select(`
        *,
        ai_generated_stories (
          content
        )
      `, { count: 'exact' });

    // Get distances for all locations
    const { data: distances, error: distanceError } = await adminClient
      .rpc('calculate_distances', {
        lat: latitude,
        lng: longitude,
        radius_meters: radius
      });

    if (distanceError) {
      console.error('Error calculating distances:', distanceError);
      return { locations: [], hasMore: false };
    }

    // Create a map of distances for faster lookup
    const distanceMap = new Map(
      distances.map(d => [d.id, Math.round(d.distance)])
    );

    // Get locations based on filter
    let query = baseQuery;
    switch (filter) {
      case 'popular':
        query = query.order('visit_count', { ascending: false });
        break;
      case 'stories':
        query = query.not('ai_generated_stories', 'is', null);
        break;
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data: locations, error: locationsError, count } = await query;

    if (locationsError) {
      console.error('Error fetching locations:', locationsError);
      return { locations: [], hasMore: false };
    }

    // Transform locations with distances and stories
    let transformedLocations = locations.map(location => {
      const story = location.ai_generated_stories?.[0]?.content;
      return {
        id: location.id,
        title: location.title,
        description: location.description,
        latitude: location.latitude,
        longitude: location.longitude,
        imageUrl: location.image_url,
        rating: location.rating,
        visitCount: location.visit_count,
        hasStories: !!story,
        hasAR: false,
        distance: distanceMap.get(location.id) || null,
        period: location.historical_period,
        category: location.category,
        lastUpdated: location.updated_at,
        aiGeneratedStory: story
      };
    });

    // Filter out locations beyond the radius
    transformedLocations = transformedLocations.filter(loc => 
      loc.distance !== null && loc.distance <= radius
    );

    // For nearby filter, sort by distance
    if (filter === 'nearby') {
      transformedLocations.sort((a, b) => a.distance - b.distance);
    }

    return {
      locations: transformedLocations,
      hasMore: offset + limit < count
    };

  } catch (error) {
    console.error('Error in getNearbyLocations:', error);
    return { locations: [], hasMore: false };
  }
};

export const createLocation = async (locationData) => {
  try {
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
    return data[0];
  } catch (error) {
    console.error('Error creating location:', error);
    throw error;
  }
};

export const updateLocation = async (id, updates) => {
  try {
    const { data, error } = await adminClient
      .from('locations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
};

export const incrementVisitCount = async (locationId) => {
  try {
    const { data, error } = await adminClient.rpc('increment_visit_count', {
      location_id: locationId
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error incrementing visit count:', error);
    throw error;
  }
};

export const createStory = async (storyData) => {
  try {
    const { data, error } = await adminClient
      .from('stories')
      .insert([{
        ...storyData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select();

    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error creating story:', error);
    throw error;
  }
};

export const getStories = async (locationId = null) => {
  try {
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
    return data;
  } catch (error) {
    console.error('Error fetching stories:', error);
    return [];
  }
};

export const signInWithEmail = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error signing in:', error.message);
    throw error;
  }
};

export const signUpWithEmail = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error signing up:', error.message);
    throw error;
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Error signing out:', error.message);
    throw error;
  }
};

export const uploadImage = async (filePath, file) => {
  try {
    const { data, error } = await adminClient.storage
      .from('images')
      .upload(filePath, file);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

export const getImageUrl = (path) => {
  if (!path) return null;
  return adminClient.storage.from('images').getPublicUrl(path).data.publicUrl;
};

export default {
  supabase,
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
};
