// Environment configuration
const env = {
  // Supabase Configuration
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hduqjplgjkwidytiftzx.supabase.co',
  EXPO_PUBLIC_SUPABASE_KEY: process.env.EXPO_PUBLIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkdXFqcGxnamt3aWR5dGlmdHp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE2MjIwNTEsImV4cCI6MjA0NzE5ODA1MX0.-CYOyqN49GJLE6KZNRKjmyqPC5g1mGythBADiGAc3qo',
  EXPO_PUBLIC_SUPABASE_SERVICE_KEY: process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkdXFqcGxnamt3aWR5dGlmdHp4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTYyMjA1MSwiZXhwIjoyMDQ3MTk4MDUxfQ.5GUZIIT4GyL7Yn6BLb7q26h4uNgYYSM9Ma2b8jESj-o',

  // Google Cloud Configuration
  EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT: process.env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT || 'microhistory-441722',
  EXPO_PUBLIC_GOOGLE_CLOUD_LOCATION: process.env.EXPO_PUBLIC_GOOGLE_CLOUD_LOCATION || 'us-east1',
  EXPO_PUBLIC_GOOGLE_CREDENTIALS: process.env.EXPO_PUBLIC_GOOGLE_CREDENTIALS,

  // ElevenLabs Configuration
  EXPO_PUBLIC_ELEVENLABS_API_KEY: process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || 'sk_3bef40b49878e30b2e07b6f918b1bd3c135e4cf4a347a14d',

  // App Environment
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres.hduqjplgjkwidytiftzx:Senpai0%21michael01@aws-0-us-east-1.pooler.supabase.com:6543/postgres',

  // Feature Flags
  features: {
    enableVoiceSynthesis: true,
    enableARExperience: true,
    enableLocationSharing: true,
    enableUserContributions: true,
    enableAIGuide: true,
  },

  // App Settings
  settings: {
    maxStoryLength: 2000,
    maxImageSize: 5 * 1024 * 1024, // 5MB
    defaultRadius: 5000, // 5km for nearby locations
    refreshInterval: 60000, // 1 minute
    cacheTimeout: 3600, // 1 hour
  },

  // API Endpoints
  getGoogleCloudEndpoint: () => {
    return `https://${process.env.EXPO_PUBLIC_GOOGLE_CLOUD_LOCATION || 'us-east1'}-${process.env.EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT || 'microhistory-441722'}.cloudfunctions.net`;
  },

  getElevenLabsEndpoint: () => {
    return 'https://api.elevenlabs.io/v1';
  },

  // Error Messages
  errors: {
    missingConfig: 'Missing required configuration. Please check your environment variables.',
    networkError: 'Network error. Please check your connection and try again.',
    authError: 'Authentication error. Please sign in again.',
    locationError: 'Unable to access location. Please check your permissions.',
    uploadError: 'Failed to upload file. Please try again.',
    aiError: 'AI service is temporarily unavailable. Please try again later.',
  },

  // Validation
  validateConfig: () => {
    const requiredVars = [
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_KEY',
      'EXPO_PUBLIC_GOOGLE_CLOUD_PROJECT',
      'EXPO_PUBLIC_GOOGLE_CLOUD_LOCATION',
      'EXPO_PUBLIC_ELEVENLABS_API_KEY',
    ];

    const missingVars = requiredVars.filter(varName => !env[varName]);

    if (missingVars.length > 0) {
      console.warn('Missing required environment variables:', missingVars);
      return false;
    }

    return true;
  },
};

export default env;