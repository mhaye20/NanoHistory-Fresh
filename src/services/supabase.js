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

// Story functions
export const createStory = async (storyData) => {
  try {
    const { data, error } = await supabase
      .from('stories')
      .insert([storyData])
      .select();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating story:', error.message);
    throw error;
  }
};

export const getStories = async (locationId = null) => {
  try {
    let query = supabase
      .from('stories')
      .select('*, user:users(name)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching stories:', error.message);
    throw error;
  }
};

// Location functions
export const getNearbyLocations = async (latitude, longitude, radius = 5000) => {
  try {
    const { data, error } = await supabase.rpc('nearby_locations', {
      lat: latitude,
      long: longitude,
      radius_meters: radius,
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching nearby locations:', error.message);
    throw error;
  }
};

export const getLocationDetails = async (locationId) => {
  try {
    const { data, error } = await supabase
      .from('locations')
      .select(`
        *,
        stories (
          *,
          user:users(name)
        )
      `)
      .eq('id', locationId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching location details:', error.message);
    throw error;
  }
};

// Storage functions
export const uploadImage = async (filePath, file) => {
  try {
    const { data, error } = await supabase.storage
      .from('story-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error uploading image:', error.message);
    throw error;
  }
};

export const getImageUrl = (path) => {
  try {
    const { data } = supabase.storage
      .from('story-images')
      .getPublicUrl(path);
    
    return data.publicUrl;
  } catch (error) {
    console.error('Error getting image URL:', error.message);
    throw error;
  }
};

export default {
  supabase,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  createStory,
  getStories,
  getNearbyLocations,
  getLocationDetails,
  uploadImage,
  getImageUrl,
};