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

// Location functions
export const getNearbyLocations = async (latitude, longitude, filter = 'all', radius = 5000) => {
  try {
    console.log('Getting nearby locations with:', { latitude, longitude, filter, radius });

    if (!latitude || !longitude) {
      console.error('No location provided');
      return [];
    }

    // Initialize locations if needed
    try {
      // First clear existing locations
      await clearLocations();

      // Then get new locations from API
      console.log('Initializing locations with coordinates:', { latitude, longitude });
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

      const { locations } = await response.json();
      console.log('Got locations from API:', locations);

      // Store locations and stories in database using admin client
      for (const item of locations) {
        try {
          console.log('Storing location:', item.location);
          // Insert location
          const { data: locationData, error: locationError } = await adminClient
            .from('locations')
            .insert([{
              title: item.location.title,
              description: item.location.description,
              category: item.location.category,
              historical_period: item.location.historical_period,
              latitude: item.location.latitude,
              longitude: item.location.longitude,
              location: `POINT(${item.location.longitude} ${item.location.latitude})`,
              image_url: item.location.image_url || 'https://picsum.photos/800/600',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (locationError) {
            console.error('Error storing location:', locationError);
            continue;
          }

          console.log('Location stored:', locationData);

          // Insert story
          console.log('Storing story for location:', locationData.id);
          const { error: storyError } = await adminClient
            .from('ai_generated_stories')
            .insert([{
              content: item.story,
              location_id: locationData.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);

          if (storyError) {
            console.error('Error storing story:', storyError);
          }
        } catch (itemError) {
          console.error('Error processing location:', itemError);
        }
      }
    } catch (initError) {
      console.error('Error initializing locations:', initError);
      // Continue with fetching existing locations
    }

    // Get locations from database
    console.log('Fetching locations from database...');
    let { data: locations, error: locationsError } = await adminClient
      .from('locations')
      .select(`
        *,
        ai_generated_stories (
          content
        )
      `);

    console.log('Basic locations query result:', { locations, error: locationsError });

    if (locationsError) {
      console.error('Error fetching locations:', locationsError);
      return [];
    }

    // Calculate distances using PostGIS
    console.log('Calculating distances...');
    const { data: distances, error: distanceError } = await adminClient
      .rpc('calculate_distances', {
        lat: latitude,
        lng: longitude,
        radius_meters: radius
      });

    console.log('Distance calculation result:', { distances, error: distanceError });

    if (distanceError) {
      console.error('Error calculating distances:', distanceError);
      return [];
    }

    // Merge the location data with distances
    let mergedLocations = locations.map(location => {
      const distanceInfo = distances.find(d => d.id === location.id);
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
        distance: distanceInfo ? Math.round(distanceInfo.distance) : null,
        period: location.historical_period,
        category: location.category,
        lastUpdated: location.updated_at,
        aiGeneratedStory: story
      };
    });

    console.log('Merged locations:', mergedLocations);

    // Filter out locations beyond the radius
    mergedLocations = mergedLocations.filter(loc => loc.distance !== null && loc.distance <= radius);

    console.log('Filtered locations:', mergedLocations);

    // Apply filters
    switch (filter) {
      case 'nearby':
        mergedLocations.sort((a, b) => a.distance - b.distance);
        break;
      case 'popular':
        mergedLocations.sort((a, b) => b.visitCount - a.visitCount);
        break;
      case 'stories':
        mergedLocations = mergedLocations.filter(loc => loc.hasStories);
        break;
    }

    console.log('Final locations to return:', mergedLocations);
    return mergedLocations;
  } catch (error) {
    console.error('Error in getNearbyLocations:', error);
    return [];
  }
};

// Create a new historical location
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

// Update an existing location
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

// Increment visit count for a location
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

// Story functions
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

// Authentication functions (use regular client for these)
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

// Storage functions
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
