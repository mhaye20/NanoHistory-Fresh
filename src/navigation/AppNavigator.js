import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen';
import LocationDetailScreen from '../screens/LocationDetailScreen';
import ARViewScreen from '../screens/ARViewScreen';
import AIGuideScreen from '../screens/AIGuideScreen';
import CreateStoryScreen from '../screens/CreateStoryScreen';
import AuthScreen from '../screens/AuthScreen';
import TourGuideScreen from '../screens/TourGuideScreen';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: {
    backgroundColor: '#0f172a',
  },
  headerTintColor: '#fff',
  headerTitleStyle: {
    fontWeight: '600',
  },
  headerBackTitleVisible: false,
  contentStyle: {
    backgroundColor: '#0f172a',
  },
};

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          ...screenOptions,
          animation: 'slide_from_bottom',
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
            headerTransparent: true,
            headerBlurEffect: 'dark',
          }}
        />
        <Stack.Screen
          name="LocationDetail"
          component={LocationDetailScreen}
          options={({ route }) => ({
            title: route.params?.location?.title || 'Location Details',
            headerTransparent: true,
            headerBlurEffect: 'dark',
          })}
        />
        <Stack.Group
          screenOptions={{
            presentation: 'modal',
          }}
        >
          <Stack.Screen
            name="ARView"
            component={ARViewScreen}
            options={{
              title: 'AR Experience',
              headerTransparent: true,
              headerBlurEffect: 'dark',
              presentation: 'fullScreenModal',
            }}
          />
          <Stack.Screen
            name="CreateStory"
            component={CreateStoryScreen}
            options={{
              title: 'Share Your Story',
              headerTransparent: true,
              headerBlurEffect: 'dark',
            }}
          />
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{
              title: '',
              headerTransparent: true,
              headerBlurEffect: 'dark',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack.Group>
        <Stack.Screen
          name="AIGuide"
          component={AIGuideScreen}
          options={{
            title: 'AI Historical Guide',
            headerTransparent: true,
            headerBlurEffect: 'dark',
          }}
        />
        <Stack.Screen
          name="TourGuide"
          component={TourGuideScreen}
          options={{
            title: 'Historical Tour Guide',
            headerTransparent: true,
            headerBlurEffect: 'dark',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
