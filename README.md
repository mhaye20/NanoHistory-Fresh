# TaleTrail

TaleTrail is a React Native mobile application that brings historical locations to life through augmented reality (AR) experiences and AI-powered storytelling. The app allows users to explore nearby historical sites, learn about their significance through an AI guide, and contribute their own stories to the historical narrative.

## Features

- **Location-Based Exploration**: Discover historical sites near you with an interactive map interface
- **Augmented Reality (AR) Experience**: View historical locations through AR for an immersive experience
- **AI Historical Guide**: Interact with an AI-powered guide that provides detailed historical context and stories
- **User Stories**: Share and read personal stories connected to historical locations
- **Authentication System**: Secure user accounts with email verification
- **Dark Mode**: Built-in dark theme optimized for comfortable viewing

## Tech Stack

### Frontend
- React Native (Expo)
- TypeScript
- NativeWind (TailwindCSS)
- React Navigation
- Expo modules (Camera, Location, AR, etc.)
- Moti & Reanimated for animations

### Backend & Services
- Supabase for database and authentication
- Google Cloud Services (Text-to-Speech, VertexAI)
- Node.js API endpoints
- Vercel for serverless functions

## Prerequisites

- Node.js 16.x or higher
- Expo CLI
- iOS Simulator (Mac only) or Android Studio
- Supabase account
- Google Cloud account (for AI features)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/nanohistory.git
cd nanohistory
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_CLOUD_PROJECT_ID=your_project_id
```

4. Start the development server:
```bash
npm start
```

## Running the App

- iOS: `npm run ios`
- Android: `npm run android`
- Web: `npm run web`

## Required Permissions

The app requires the following device permissions:
- Camera (for AR features)
- Location (for discovering nearby historical sites)
- Microphone (for voice interactions with AI guide)
- Background Location (for real-time updates)

## Project Structure

```
├── api/                  # Backend API endpoints
├── assets/              # App icons and images
├── src/
│   ├── config/         # Configuration files
│   ├── navigation/     # Navigation setup
│   ├── screens/        # App screens
│   └── services/       # API and service integrations
├── scripts/            # Utility scripts
└── supabase/          # Supabase configurations
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
