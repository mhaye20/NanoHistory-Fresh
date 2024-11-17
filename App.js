import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import ARViewScreen from './src/screens/ARViewScreen';
import AIGuideScreen from './src/screens/AIGuideScreen';
import CreateStoryScreen from './src/screens/CreateStoryScreen';
import LocationDetailScreen from './src/screens/LocationDetailScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerStyle: {
                backgroundColor: '#0f172a',
              },
              headerTintColor: '#fff',
              headerTitleStyle: {
                fontWeight: 'bold',
              },
              contentStyle: {
                backgroundColor: '#0f172a',
              },
            }}
          >
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Explore"
              component={ExploreScreen}
              options={{
                title: 'Explore History',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="ARView"
              component={ARViewScreen}
              options={{
                title: 'AR View',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="AIGuide"
              component={AIGuideScreen}
              options={{
                title: 'AI Guide',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="CreateStory"
              component={CreateStoryScreen}
              options={{
                title: 'Share Your Story',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="LocationDetail"
              component={LocationDetailScreen}
              options={({ route }) => ({
                title: route.params?.location?.title || 'Location Details',
                animation: 'slide_from_right',
              })}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}