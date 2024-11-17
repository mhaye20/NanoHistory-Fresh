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

// Initialize Supabase client
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

// Mock data for fallback when location permissions are denied
const mockLocations = [
  {
    id: 1,
    title: "Historic Downtown Square",
    description: "A beautiful town square dating back to the 1800s, featuring original architecture and historical landmarks.",
    latitude: 37.7749,
    longitude: -122.4194,
    imageUrl: "https://picsum.photos/800/600",
    rating: 4.5,
    visitCount: 128,
    hasStories: true,
    hasAR: true,
    distance: 1200, // meters
  },
  // ... other mock locations ...
];

// Location functions
export const getNearbyLocations = async (latitude, longitude, filter = 'all', radius = 5000) => {
  try {
    console.log('Getting nearby locations with:', { latitude, longitude, filter, radius });

    if (!latitude || !longitude) {
      console.log('No location provided, using mock data');
      return mockLocations;
    }

    // First, get just the locations without joins to see if that works
    console.log('Fetching locations from database...');
    let { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select('*');

    console.log('Basic locations query result:', { locations, error: locationsError });

    if (locationsError) {
      console.error('Error fetching locations:', locationsError);
      return mockLocations;
    }

    // Then, calculate distances using PostGIS
    console.log('Calculating distances...');
    const { data: distances, error: distanceError } = await supabase
      .rpc('calculate_distances', {
        lat: latitude,
        lng: longitude,
        radius_meters: radius
      });

    console.log('Distance calculation result:', { distances, error: distanceError });

    if (distanceError) {
      console.error('Error calculating distances:', distanceError);
      return mockLocations;
    }

    // Merge the location data with distances
    let mergedLocations = locations.map(location => {
      const distanceInfo = distances.find(d => d.id === location.id);
      return {
        id: location.id,
        title: location.title,
        description: location.description,
        latitude: location.latitude,
        longitude: location.longitude,
        imageUrl: location.image_url,
        rating: location.rating,
        visitCount: location.visit_count,
        hasStories: false, // We'll add this functionality back once we confirm basic location fetching works
        hasAR: false, // We'll add this functionality back once we confirm basic location fetching works
        distance: distanceInfo ? Math.round(distanceInfo.distance) : null,
        period: location.historical_period,
        category: location.category,
        lastUpdated: location.updated_at,
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
        // We'll add this back once basic location fetching works
        break;
    }

    console.log('Final locations to return:', mergedLocations);
    return mergedLocations;
  } catch (error) {
    console.error('Error in getNearbyLocations:', error);
    return mockLocations;
  }
};

// Create a new historical location
export const createLocation = async (locationData) => {
  try {
    const { latitude, longitude, ...rest } = locationData;
    
    const { data, error } = await supabase
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
    const { data, error } = await supabase
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
    const { data, error } = await supabase.rpc('increment_visit_count', {
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
    const { data, error } = await supabase
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
    let query = supabase
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

// Authentication functions
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
    const { data, error } = await supabase.storage
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
  return supabase.storage.from('images').getPublicUrl(path).data.publicUrl;
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
};
