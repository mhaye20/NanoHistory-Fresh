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

// Mock data for development
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
  {
    id: 2,
    title: "Old Railway Station",
    description: "Once a bustling transportation hub, this Victorian-era station has been preserved as a historical monument.",
    latitude: 37.7750,
    longitude: -122.4180,
    imageUrl: "https://picsum.photos/800/601",
    rating: 4.2,
    visitCount: 85,
    hasStories: true,
    hasAR: true,
    distance: 800,
  },
  {
    id: 3,
    title: "Heritage Museum",
    description: "A local museum housed in a 19th-century mansion, showcasing the area's rich cultural history.",
    latitude: 37.7752,
    longitude: -122.4185,
    imageUrl: "https://picsum.photos/800/602",
    rating: 4.8,
    visitCount: 256,
    hasStories: true,
    hasAR: false,
    distance: 1500,
  },
];

// Location functions
export const getNearbyLocations = async (latitude, longitude, filter = 'all') => {
  // Always return mock data for now
  console.log('Using mock location data');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
  
  let filteredLocations = [...mockLocations];
  
  // Apply filters
  switch (filter) {
    case 'nearby':
      filteredLocations.sort((a, b) => a.distance - b.distance);
      break;
    case 'popular':
      filteredLocations.sort((a, b) => b.visitCount - a.visitCount);
      break;
    case 'stories':
      filteredLocations = filteredLocations.filter(loc => loc.hasStories);
      break;
  }
  
  return filteredLocations;
};

// Helper function to calculate distance between two points using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

// Story functions
export const createStory = async (storyData) => {
  // Mock response for development
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { id: Date.now(), ...storyData };
};

export const getStories = async (locationId = null) => {
  // Mock response for development
  await new Promise(resolve => setTimeout(resolve, 1000));
  return [];
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
  // Mock response for development
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { path: filePath };
};

export const getImageUrl = (path) => {
  // Mock response for development
  return path;
};

export default {
  supabase,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  createStory,
  getStories,
  getNearbyLocations,
  getLocationDetails: async (id) => {
    // Return mock data
    await new Promise(resolve => setTimeout(resolve, 1000));
    const location = mockLocations.find(loc => loc.id === id);
    return location ? { ...location, stories: [] } : null;
  },
  uploadImage,
  getImageUrl,
};
