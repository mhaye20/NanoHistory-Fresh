import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { kawaii } from '../theme/kawaii';

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
    backgroundColor: kawaii.pastelPalette.background.light,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerTintColor: kawaii.pastelPalette.text.primary,
  headerTitleStyle: {
    fontWeight: kawaii.playfulTypography.weights.bold,
    fontSize: kawaii.playfulTypography.sizes.large,
    color: kawaii.pastelPalette.text.primary,
    fontFamily: kawaii.playfulTypography.fontFamily,
  },
  headerBackTitleVisible: false,
  contentStyle: {
    backgroundColor: kawaii.pastelPalette.background.light,
  },
  headerShadowVisible: false,
  headerBlurEffect: 'light',
};

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          ...screenOptions,
          animation: 'fade_from_bottom',
          animationDuration: 300,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
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
            headerBlurEffect: 'light',
            headerStyle: {
              backgroundColor: 'transparent',
            },
          }}
        />
        <Stack.Screen
          name="LocationDetail"
          component={LocationDetailScreen}
          options={({ route }) => ({
            title: route.params?.location?.title || 'Location Details',
            headerTransparent: true,
            headerBlurEffect: 'light',
            headerStyle: {
              backgroundColor: 'transparent',
            },
          })}
        />
        <Stack.Group
          screenOptions={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            animationDuration: 300,
          }}
        >
          <Stack.Screen
            name="ARView"
            component={ARViewScreen}
            options={{
              title: 'AR Experience',
              headerTransparent: true,
              headerBlurEffect: 'light',
              presentation: 'fullScreenModal',
              headerStyle: {
                backgroundColor: 'transparent',
              },
            }}
          />
          <Stack.Screen
            name="CreateStory"
            component={CreateStoryScreen}
            options={{
              title: 'Share Your Story',
              headerTransparent: true,
              headerBlurEffect: 'light',
              headerStyle: {
                backgroundColor: 'transparent',
              },
            }}
          />
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{
              title: '',
              headerTransparent: true,
              headerBlurEffect: 'light',
              animation: 'slide_from_bottom',
              headerStyle: {
                backgroundColor: 'transparent',
              },
            }}
          />
        </Stack.Group>
        <Stack.Screen
          name="AIGuide"
          component={AIGuideScreen}
          options={{
            title: 'AI Historical Guide',
            headerTransparent: true,
            headerBlurEffect: 'light',
            headerStyle: {
              backgroundColor: 'transparent',
            },
          }}
        />
        <Stack.Screen
          name="TourGuide"
          component={TourGuideScreen}
          options={{
            title: 'Historical Tour Guide',
            headerTransparent: true,
            headerBlurEffect: 'light',
            headerStyle: {
              backgroundColor: 'transparent',
            },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;