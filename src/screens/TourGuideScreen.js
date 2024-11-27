import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  Switch,
  Animated,
  Modal,
} from 'react-native';
import DirectionsPanel from '../components/DirectionsPanel';
import LocationDetailScreen from './LocationDetailScreen';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { tourGuideService } from '../services/tourGuide';
import { supabase } from '../services/supabase';
import env from '../config/env';
import { debounce } from 'lodash';
import { useFocusEffect } from '@react-navigation/native';
import { formatDuration, convertDistance } from '../utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;
const TOP_OFFSET = Platform.OS === 'ios' ? 44 : STATUSBAR_HEIGHT;

const STORY_TYPES = [
  'all',
  'music',
  'visualArt',
  'performingArt',
  'architecture',
  'fashion',
  'culinary',
  'landscape',
  'lore',
  'paranormal',
  'unsungHero',
  'popCulture',
  'civilRights',
  'education'
];

const STORY_TYPE_INFO = {
  all: { label: 'All Stories', icon: 'apps' },
  music: { label: 'Music', icon: 'music-note' },
  visualArt: { label: 'Visual Art', icon: 'palette' },
  performingArt: { label: 'Performing Arts', icon: 'theater-comedy' },
  architecture: { label: 'Architecture', icon: 'apartment' },
  fashion: { label: 'Fashion', icon: 'style' },
  culinary: { label: 'Culinary', icon: 'restaurant' },
  landscape: { label: 'Landscape', icon: 'landscape' },
  lore: { label: 'Lore', icon: 'auto-stories' },
  paranormal: { label: 'Paranormal', icon: 'visibility' },
  unsungHero: { label: 'Unsung Heroes', icon: 'person' },
  popCulture: { label: 'Pop Culture', icon: 'movie' },
  civilRights: { label: 'Civil Rights', icon: 'people' },
  education: { label: 'Education', icon: 'school' }
};

const TourGuideScreen = ({ navigation }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);  // Initialize with 'all'
  const [route, setRoute] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [filteredWaypoints, setFilteredWaypoints] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingWaypoints, setIsLoadingWaypoints] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [error, setError] = useState(null);
  const [showDirections, setShowDirections] = useState(false);
  const [distanceUnit, setDistanceUnit] = useState('km'); // 'km' or 'mi'
  const mapRef = useRef(null);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [currentInstruction, setCurrentInstruction] = useState(null);
  const [navigationInfo, setNavigationInfo] = useState(null);
  const [headingSubscription, setHeadingSubscription] = useState(null);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [hasCompassPermission, setHasCompassPermission] = useState(false);
  const [isHeadTrackingEnabled, setIsHeadTrackingEnabled] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(true);
  const searchBarHeight = useRef(new Animated.Value(1)).current;
  const [isInitialLocationSet, setIsInitialLocationSet] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [mapRegion, setMapRegion] = useState(null);
  const lastRegionRef = useRef(null);
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [isEditingWaypoints, setIsEditingWaypoints] = useState(false);
  const [temporaryWaypoints, setTemporaryWaypoints] = useState([]);
  const [showWaypointMenu, setShowWaypointMenu] = useState(false);
  const [showLocationDetails, setShowLocationDetails] = useState(false);

  const normalizeWaypoint = (waypoint) => {
    // If waypoint has coordinate object, extract lat/lng
    if (waypoint.coordinate) {
      return {
        ...waypoint,
        latitude: waypoint.coordinate.latitude,
        longitude: waypoint.coordinate.longitude,
        // Keep coordinate for map markers
        coordinate: waypoint.coordinate
      };
    }
    // If waypoint has direct lat/lng, create coordinate object
    else if (waypoint.latitude && waypoint.longitude) {
      return {
        ...waypoint,
        coordinate: {
          latitude: waypoint.latitude,
          longitude: waypoint.longitude
        }
      };
    }
    return waypoint;
  };

  const toggleSearchBar = () => {
    const toValue = isSearchExpanded ? 0 : 1;
    Animated.spring(searchBarHeight, {
      toValue,
      useNativeDriver: false,
      friction: 8,
    }).start();
    setIsSearchExpanded(!isSearchExpanded);
  };

  const expandSearchBar = () => {
    if (!isSearchExpanded) {
      Animated.spring(searchBarHeight, {
        toValue: 1,
        useNativeDriver: false,
        friction: 8,
      }).start();
      setIsSearchExpanded(true);
    }
  };

  const initializeLocation = async () => {
    try {
      // First try to load cached location
      const cachedLocation = await tourGuideService.loadCachedLocation();
      if (cachedLocation && !isInitialLocationSet) {
        setCurrentLocation({
          latitude: cachedLocation.latitude,
          longitude: cachedLocation.longitude,
        });
        setIsInitialLocationSet(true);
      }

      // Request permissions and get current location
      await tourGuideService.requestLocationPermissions();
      const location = await tourGuideService.getCurrentLocation();
      
      // Update with fresh location
      if (location) {
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        setIsInitialLocationSet(true);

        // Start watching for location updates with lower accuracy for better performance
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 10,
            timeInterval: 5000
          },
          (newLocation) => {
            setCurrentLocation({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
            });
          }
        );
        setLocationSubscription(subscription);
      }
    } catch (error) {
      console.error('Location initialization error:', error);
      Alert.alert('Error', 'Unable to get your location. Please enable location services.');
    }
  };

  const fetchInitialWaypoints = async () => {
    try {
      setIsLoadingWaypoints(true);
      console.log('Fetching initial waypoints...');
      
      // First get all ai_generated_stories to ensure we have the story types
      let allAiStories = [];
      let count = 0;
      let hasMore = true;

      // Fetch AI stories with pagination
      while (hasMore) {
        const { data: aiStories, error: aiError } = await supabase
          .from('ai_generated_stories')
          .select('*')
          .range(count, count + 999);

        if (aiError) {
          console.error('Error fetching AI stories:', aiError);
          return;
        }

        if (aiStories.length > 0) {
          allAiStories = [...allAiStories, ...aiStories];
          count += 1000;
        } else {
          hasMore = false;
        }
      }

      console.log('Fetched AI stories:', allAiStories.length);

      // Create a map of location_id to story types for quick lookup
      const storyTypesMap = allAiStories.reduce((acc, story) => {
        if (story.location_id && Array.isArray(story.story_types)) {
          acc[story.location_id] = story.story_types;
        }
        return acc;
      }, {});

      // Reset for locations fetch
      count = 0;
      hasMore = true;
      let allHistoricalPoints = [];

      // Fetch locations with pagination
      while (hasMore) {
        const { data: historicalPoints, error: locationsError } = await supabase
          .from('locations')
          .select(`
            *,
            ai_generated_stories (
              content,
              story_types
            )
          `)
          .range(count, count + 999);

        if (locationsError) throw locationsError;

        if (historicalPoints.length > 0) {
          allHistoricalPoints = [...allHistoricalPoints, ...historicalPoints];
          count += 1000;
        } else {
          hasMore = false;
        }
      }

      console.log('Fetched historical points:', allHistoricalPoints.length);

      // Transform the locations with proper story types
      const transformedPoints = allHistoricalPoints.map(point => {
        const aiStory = point.ai_generated_stories?.[0];
        // Try to get story types from our map first, then fall back to the AI story
        const storyTypes = storyTypesMap[point.id] || aiStory?.story_types || [];

        return {
          id: point.id,
          title: point.title,
          description: point.description,
          latitude: point.latitude,
          longitude: point.longitude,
          story: aiStory?.content,
          story_types: storyTypes
        };
      });

      console.log('Transformed points:', transformedPoints.length);

      // Set waypoints
      setWaypoints(transformedPoints);

      console.log('Set waypoints');

    } catch (error) {
      console.error('Error fetching waypoints:', error);
    } finally {
      setIsLoadingWaypoints(false);
    }
  };

  const applyFilters = useCallback((points, selectedTypes) => {
    console.log('Applying filters:', { points: points?.length, selectedTypes });
    
    if (!selectedTypes.length) {
      console.log('No types selected, returning empty array');
      return []; // Return empty array if no types selected
    }
    
    // If 'all' is selected, return all points without filtering
    if (selectedTypes.includes('all')) {
      console.log('All type selected, returning all points');
      return points || [];
    }

    const filtered = (points || []).filter(point => {
      // First ensure point has valid story_types array
      if (!Array.isArray(point.story_types)) {
        console.log('Point has no story_types array:', point.id);
        return false;
      }

      // Normalize story types for comparison
      const normalizedPointTypes = point.story_types.map(type => 
        type.toLowerCase().replace(/([A-Z])/g, '_$1')
      );
      const normalizedSelectedTypes = selectedTypes.map(type => 
        type.toLowerCase().replace(/([A-Z])/g, '_$1')
      );

      const hasMatchingType = normalizedSelectedTypes.some(selectedType => 
        normalizedPointTypes.includes(selectedType)
      );

      if (hasMatchingType) {
        console.log('Found matching type for point:', point.id);
      }

      return hasMatchingType;
    });

    console.log('Filtered points:', filtered.length);
    return filtered;
  }, []);

  const toggleStoryType = async (type) => {
    // Don't allow changes during navigation
    if (isNavigating) {
      Alert.alert(
        'Navigation Active',
        'Please stop navigation before changing story types.'
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (type === 'all') {
      if (!selectedTypes.includes('all')) {
        setSelectedTypes(['all']);
      } else {
        setSelectedTypes([]);
      }
    } else {
      setSelectedTypes((prev) => {
        let updatedTypes = prev.filter(t => t !== 'all');
        
        if (prev.includes(type)) {
          updatedTypes = updatedTypes.filter(t => t !== type);
        } else {
          updatedTypes = [...updatedTypes, type];
        }
        
        return updatedTypes;
      });
    }
  };

  // Add useFocusEffect to handle screen focus
  useFocusEffect(
    useCallback(() => {
      const setup = async () => {
        try {
          setIsLoadingWaypoints(true);
          await initializeLocation();
          await fetchInitialWaypoints();
          await requestCompassPermission();
        } catch (error) {
          console.error('Setup error:', error);
          Alert.alert(
            'Setup Error',
            'Failed to initialize the tour guide. Please check your permissions and try again.'
          );
        }
      };

      setup();

      return () => {
        if (isNavigating) {
          stopNavigation();
        }
        if (locationSubscription) {
          locationSubscription.remove();
        }
        if (headingSubscription) {
          headingSubscription.remove();
        }
      };
    }, [])
  );

  // Add effect to handle filtering
  useEffect(() => {
    if (waypoints.length > 0) {
      console.log('Applying filter with selectedTypes:', selectedTypes);
      const filtered = applyFilters(waypoints, selectedTypes);
      console.log('Setting filtered waypoints:', filtered.length);
      setFilteredWaypoints(filtered);
    }

    
  }, [waypoints, selectedTypes, applyFilters]);

  useEffect(() => {
    if (route) {
      setTemporaryWaypoints(waypoints);
    }
  }, [route]);

  const getManeuverIcon = (maneuver) => {
    switch (maneuver) {
      case 'turn-right':
        return 'turn-right';
      case 'turn-left':
        return 'turn-left';
      case 'turn-slight-right':
        return 'turn-slight-right';
      case 'turn-slight-left':
        return 'turn-slight-left';
      case 'turn-sharp-right':
        return 'turn-sharp-right';
      case 'turn-sharp-left':
        return 'turn-sharp-left';
      case 'uturn-right':
        return 'u-turn-right';
      case 'uturn-left':
        return 'u-turn-left';
      case 'roundabout-right':
      case 'roundabout-left':
        return 'roundabout';
      case 'merge':
        return 'merge';
      case 'fork-right':
      case 'fork-left':
        return 'fork-right';
      case 'straight':
        return 'straight';
      default:
        return 'arrow-forward';
    }
  };

  const requestCompassPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasCompassPermission(true);
      } else {
        Alert.alert(
          'Permission Required',
          'Compass permission is needed for navigation features.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting compass permission:', error);
    }
  };

  const fetchPlacePredictions = useCallback(
    debounce(async (input) => {
      if (!input.trim()) {
        setPredictions([]);
        setShowPredictions(false);
        return;
      }

      if (!env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
        setError('Google Maps API key is not configured');
        return;
      }

      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            input
          )}&key=${env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
        );
        const data = await response.json();
        
        if (data.status === 'REQUEST_DENIED') {
          setError('Unable to access location services');
          return;
        }
        
        if (data.results) {
          const predictions = data.results.map(result => ({
            place_id: result.place_id,
            description: result.formatted_address,
            structured_formatting: {
              main_text: result.address_components[0].long_name,
              secondary_text: result.formatted_address.split(',').slice(1).join(',').trim()
            },
            geometry: result.geometry
          }));
          setPredictions(predictions);
          setShowPredictions(true);
        }
      } catch (err) {
        console.error('Error fetching predictions:', err);
        setError('Failed to fetch location suggestions');
      }
    }, 300),
    []
  );

  const handleLocationSelect = async (prediction) => {
    try {
      if (!prediction?.geometry?.location) {
        throw new Error('Invalid location data');
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsLoading(true);
      setShowPredictions(false);
      setDestination(prediction.description || '');

      const { lat, lng } = prediction.geometry.location;
      const destinationLocation = {
        latitude: lat,
        longitude: lng
      };

      if (!currentLocation) {
        throw new Error('Current location not available');
      }

      // Generate the route
      const newRoute = await tourGuideService.generateTourRoute(
        currentLocation,
        destinationLocation,
        selectedTypes.length > 0 ? selectedTypes : ['all']
      );

      if (!newRoute?.coordinates?.length) {
        throw new Error('Failed to generate route coordinates');
      }

      console.log('Generated route duration:', newRoute.totalDuration);

      // Set the route immediately
      setRoute(newRoute);

      // Fit the map to show the entire route
      if (mapRef.current) {
        mapRef.current.fitToCoordinates(newRoute.coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.error('Route error:', error);
      Alert.alert('Error', error.message || 'Failed to generate tour route');
    } finally {
      setIsLoading(false);
    }
  };

  const startLocationTracking = async () => {
    try {
      // Start location tracking with higher accuracy and frequency
      const locSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5,
          timeInterval: 1000,
        },
        (location) => {
          setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });

          // Update map center when location changes
          if (mapRef.current && isNavigating) {
            mapRef.current.animateCamera({
              center: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              },
              pitch: isHeadTrackingEnabled ? 60 : 0,
              zoom: 18,
              duration: 1000,
            });
    }
  }
      );
      setLocationSubscription(locSubscription);

      // Start compass tracking if head tracking is enabled
      if (isHeadTrackingEnabled && hasCompassPermission) {
        startHeadingTracking();
      }
    } catch (error) {
      console.error('Error starting location tracking:', error);
      Alert.alert('Error', 'Failed to start location tracking');
    }
  };

  const startHeadingTracking = async () => {
    try {
      if (headingSubscription) {
        await headingSubscription.remove();
      }

      const headSubscription = await Location.watchHeadingAsync((heading) => {
        setCurrentHeading(heading.trueHeading);
        
        // Update map bearing when heading changes
        if (mapRef.current && isNavigating && isHeadTrackingEnabled) {
          mapRef.current.animateCamera({
            bearing: heading.trueHeading,
            duration: 500,
          });
        }
      });
      setHeadingSubscription(headSubscription);
    } catch (error) {
      console.error('Error starting heading tracking:', error);
    }
  };

  const stopHeadingTracking = async () => {
    try {
      if (headingSubscription) {
        await headingSubscription.remove();
        setHeadingSubscription(null);
      }

      // Reset map orientation when head tracking is disabled
      if (mapRef.current) {
        mapRef.current.animateCamera({
          center: currentLocation,
          pitch: 0,
          bearing: 0,
          zoom: 18,
          duration: 500,
        });
      }
    } catch (error) {
      console.error('Error stopping heading tracking:', error);
    }
  };

  const toggleHeadTracking = async (enabled) => {
    setIsHeadTrackingEnabled(enabled);
    if (enabled) {
      await startHeadingTracking();
    } else {
      await stopHeadingTracking();
    }
  };

  const startNavigation = async () => {
    // Validation checks
    if (!selectedTypes.length) {
      Alert.alert('Error', 'Please select at least one story type before starting navigation.');
      return;
    }

    if (!destination) {
      Alert.alert('Error', 'Please enter a destination before starting navigation.');
      return;
    }

    if (!route?.coordinates?.length) {
      Alert.alert('Error', 'No valid route available. Please try selecting a different destination.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await tourGuideService.startNavigation();
      setIsNavigating(true);
      setIsSearchExpanded(false); // Collapse the search overlay when navigation starts

      setNavigationInfo({
        totalDistance: (route.totalDistance / 1000).toFixed(1),
        totalDuration: route.totalDuration
      });
      setCurrentInstruction(route.instructions[0]);

      await startLocationTracking();

      if (mapRef.current && currentLocation) {
        mapRef.current.animateCamera({
          center: currentLocation,
          heading: isHeadTrackingEnabled ? currentHeading : 0,
          pitch: isHeadTrackingEnabled ? 60 : 0,
          zoom: 17,
          duration: 500,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start navigation');
    }
  };

  const stopNavigation = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await tourGuideService.stopNavigation();
      setIsNavigating(false);
      setCurrentInstruction(null);
      setNavigationInfo(null);
      setSelectedTypes([]); // Clear selected story types
      setDestination(''); // Clear destination
      setPredictions([]); // Clear predictions
      setShowPredictions(false);

      // Stop all tracking
      if (locationSubscription) {
        locationSubscription.remove();
        setLocationSubscription(null);
      }
      if (headingSubscription) {
        await stopHeadingTracking();
      }

      // Reset map view to current location with reasonable zoom
      if (mapRef.current && currentLocation) {
        mapRef.current.animateCamera({
          center: currentLocation,
          pitch: 0,
          bearing: 0,
          zoom: 15,
          duration: 500,
        });
      }

      // Clear route coordinates but keep route state
      setRoute(prevRoute => ({
        ...prevRoute,
        coordinates: [],
      }));

      // Expand the search bar overlay
      setIsSearchExpanded(true);
      
    } catch (error) {
      console.error('Error stopping navigation:', error);
    }
  };

  const clearSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDestination('');
    setPredictions([]);
    setShowPredictions(false);
    setError(null);
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleMapPress = async (event) => {
    if (!isEditingWaypoints) return;
    
    const { coordinate } = event.nativeEvent;
    const newWaypoint = normalizeWaypoint({
      id: `temp-${Date.now()}`,
      coordinate,
      title: `Waypoint ${temporaryWaypoints.length + 1}`,
    });
    
    setTemporaryWaypoints([...temporaryWaypoints, newWaypoint]);
  };

  const removeWaypoint = (waypointId) => {
    setTemporaryWaypoints(temporaryWaypoints.filter(wp => wp.id !== waypointId));
  };

  const saveModifiedRoute = async () => {
    setIsLoading(true);
    try {
      // Get the destination coordinates from the current route's end
      const destinationCoords = route?.end || destination;
      
      if (!temporaryWaypoints || temporaryWaypoints.length === 0) {
        throw new Error('No waypoints selected for the route');
      }

      // Normalize all waypoints before sending
      const normalizedWaypoints = temporaryWaypoints.map(normalizeWaypoint);

      // Log waypoints for debugging
      console.log('Saving route with normalized waypoints:', normalizedWaypoints);
      
      // Recalculate route with new waypoints
      const newRoute = await tourGuideService.generateTourRoute(
        currentLocation,
        destinationCoords,
        selectedTypes,
        normalizedWaypoints // Pass only our selected waypoints
      );

      if (!newRoute) {
        throw new Error('Failed to generate new route');
      }

      // Use the original normalized waypoints in the route
      newRoute.waypoints = normalizedWaypoints;
      
      setRoute(newRoute);
      setWaypoints(normalizedWaypoints);
      setIsEditingWaypoints(false);
    } catch (error) {
      console.error('Error updating route:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to update route with new waypoints. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const cancelWaypointEditing = () => {
    setTemporaryWaypoints(waypoints);
    setIsEditingWaypoints(false);
  };

  const isWaypointInRoute = (waypoint) => {
    if (!waypoint) return false;
    return temporaryWaypoints.some(wp => wp.id === waypoint.id);
  };

  const handleWaypointPress = (waypoint) => {
    if (!waypoint) return;
    setSelectedWaypoint(waypoint);
    setShowWaypointMenu(true);
  };

  const handleViewDetails = () => {
    setShowWaypointMenu(false);
    setShowLocationDetails(true);
  };

  const closeLocationDetails = () => {
    setShowLocationDetails(false);
    setSelectedWaypoint(null);
  };

  const handleAddToRoute = () => {
    if (!selectedWaypoint) return;
    
    const normalizedWaypoint = normalizeWaypoint(selectedWaypoint);
    setTemporaryWaypoints([...temporaryWaypoints, normalizedWaypoint]);
    setShowWaypointMenu(false);
    setSelectedWaypoint(null);
  };

  const handleRemoveFromRoute = () => {
    if (!selectedWaypoint) return;
    
    setTemporaryWaypoints(temporaryWaypoints.filter(wp => wp.id !== selectedWaypoint.id));
    setShowWaypointMenu(false);
    setSelectedWaypoint(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.mapContainer}>
        {currentLocation ? (
          <>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                ...currentLocation,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
              region={mapRegion}
              onRegionChangeComplete={(region) => {
                lastRegionRef.current = region;
                setMapRegion(null);
              }}
              zoomEnabled={!isHeadTrackingEnabled || !isNavigating}
              scrollEnabled={!isHeadTrackingEnabled || !isNavigating}
              pitchEnabled={!isHeadTrackingEnabled || !isNavigating}
              rotateEnabled={!isHeadTrackingEnabled || !isNavigating}
              showsUserLocation={true}
              showsMyLocationButton={true}
              showsCompass={!isHeadTrackingEnabled}
              loadingEnabled={true}
              moveOnMarkerPress={true}
              minZoomLevel={1}
              maxZoomLevel={20}
              zoomTapEnabled={!isHeadTrackingEnabled || !isNavigating}
              zoomControlEnabled={true}
              followsUserLocation={isNavigating && isHeadTrackingEnabled}
              followsUserHeading={isNavigating && isHeadTrackingEnabled}
              userLocationAnnotationTitle="You are here"
              userLocationCalloutEnabled={true}
              onError={(error) => {
                console.error('MapView error:', error);
                Alert.alert('Map Error', 'Failed to load the map. Please try again.');
              }}
              camera={{
                center: currentLocation,
                pitch: isHeadTrackingEnabled ? 60 : 0,
                heading: isHeadTrackingEnabled ? currentHeading : 0,
                altitude: 1000,
                zoom: 17,
              }}
              onUserLocationChange={(event) => {
                if (isNavigating && isHeadTrackingEnabled && event.nativeEvent.coordinate) {
                  const { latitude, longitude } = event.nativeEvent.coordinate;
                  mapRef.current?.animateCamera({
                    center: { latitude, longitude },
                    heading: currentHeading,
                    pitch: 60,
                    zoom: 18,
                    duration: 1000,
                  });
                }
              }}
              onPress={handleMapPress}
            >
              {currentLocation && (
                <Marker
                  coordinate={currentLocation}
                  title="You are here"
                  pinColor="#3b82f6"
                />
              )}
              {!isLoadingWaypoints && filteredWaypoints.map((point, index) => (
                <Marker
                  key={point.id || index}
                  coordinate={{
                    latitude: point.latitude,
                    longitude: point.longitude,
                  }}
                  title={point.title}
                  description={point.description}
                  pinColor="#10b981"
                  onPress={() => handleWaypointPress(point)}
                />
              ))}
              {route?.end && (
                <Marker
                  coordinate={route.end}
                  title="Destination"
                  pinColor="#ef4444"
                />
              )}
              {route?.coordinates && route.coordinates.length > 1 && (
                <Polyline
                  coordinates={route.coordinates.map(coord => ({
                    latitude: Number(coord.latitude),
                    longitude: Number(coord.longitude)
                  }))}
                  strokeColor="#3b82f6"
                  strokeWidth={3}
                  lineDashPattern={[0]}
                  tappable={true}
                  geodesic={true}
                />
              )}
              {isEditingWaypoints ? temporaryWaypoints.map((waypoint, index) => (
                <Marker
                  key={waypoint.id}
                  coordinate={waypoint.coordinate}
                  title={waypoint.title}
                  pinColor="#FF6B6B"
                >
                  <TouchableOpacity
                    style={styles.removeWaypointButton}
                    onPress={() => removeWaypoint(waypoint.id)}
                  >
                    <MaterialIcons name="remove-circle" size={24} color="#FF4444" />
                  </TouchableOpacity>
                </Marker>
              )) : null}
            </MapView>

            {isLoadingWaypoints && (
              <View style={[styles.loadingContainer, { backgroundColor: 'rgba(0, 0, 0, 0.3)' }]}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading waypoints...</Text>
              </View>
            )}

          </>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}
      </View>

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <Animated.View 
          style={[
            styles.searchContainer,
            {
              maxHeight: searchBarHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [56, 500],
              }),
            },
          ]}
        >
          <BlurView intensity={80} tint="dark" style={styles.searchBlur}>
            <View style={[
              styles.headerContainer,
              { marginBottom: isSearchExpanded ? 12 : 0 }
            ]}>
              <Text style={styles.headerTitle}>Create a Trail</Text>
              <TouchableOpacity
                style={styles.expandButton}
                onPress={toggleSearchBar}
              >
                <MaterialIcons 
                  name={isSearchExpanded ? "expand-less" : "expand-more"} 
                  size={24} 
                  color="#fff" 
                />
              </TouchableOpacity>
            </View>

            {isSearchExpanded && (
              <>
      <View style={styles.searchInputContainer}>
        <MaterialIcons 
          name="search" 
          size={22} 
          color={isNavigating ? "rgba(255, 255, 255, 0.2)" : (selectedTypes.length ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 255, 255, 0.2)")} 
        />
        <TextInput
          style={[
            styles.searchInput,
            (isNavigating || !selectedTypes.length) && styles.disabledInput
          ]}
          placeholder={
            isNavigating 
              ? "Stop navigation to search..." 
              : (selectedTypes.length ? "Enter destination..." : "Select a story type first")
          }
          placeholderTextColor={
            isNavigating 
              ? "rgba(255, 255, 255, 0.2)" 
              : (selectedTypes.length ? "rgba(255, 255, 255, 0.4)" : "rgba(255, 255, 255, 0.2)")
          }
          value={destination}
          onFocus={expandSearchBar}
          onChangeText={(text) => {
            if (!isNavigating && selectedTypes.length) {
              setDestination(text);
              fetchPlacePredictions(text);
            }
          }}
          editable={!isNavigating && selectedTypes.length > 0}
        />
        {destination.length > 0 && !isNavigating && selectedTypes.length > 0 && (
          <TouchableOpacity 
            onPress={clearSearch}
            style={styles.clearButton}
          >
            <MaterialIcons name="close" size={20} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>
        )}
      </View>

                {error && (
                  <View style={styles.errorContainer}>
                    <MaterialIcons name="error-outline" size={20} color="#ef4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {showPredictions && predictions.length > 0 && !isNavigating && (
                  <ScrollView style={styles.predictionsContainer}>
                    {predictions.map((prediction) => (
                      <TouchableOpacity
                        key={prediction.place_id}
                        style={styles.predictionItem}
                        onPress={() => handleLocationSelect(prediction)}
                      >
                        <MaterialIcons name="place" size={20} color="rgba(255, 255, 255, 0.6)" />
                        <View style={styles.predictionTextContainer}>
                          <Text style={styles.predictionMainText}>
                            {prediction.structured_formatting.main_text}
                          </Text>
                          <Text style={styles.predictionSecondaryText}>
                            {prediction.structured_formatting.secondary_text}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.typeContainer}
                  contentContainerStyle={styles.typeContentContainer}
                >
                  {STORY_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        selectedTypes.includes(type) && styles.selectedType,
                        isNavigating && styles.disabledTypeButton
                      ]}
                      onPress={() => toggleStoryType(type)}
                      disabled={isNavigating}
                    >
                      <MaterialIcons 
                        name={STORY_TYPE_INFO[type].icon} 
                        size={20} 
                        color={
                          isNavigating 
                            ? 'rgba(255, 255, 255, 0.2)' 
                            : (selectedTypes.includes(type) ? '#fff' : 'rgba(255, 255, 255, 0.6)')
                        } 
                      />
                      <Text style={[
                        styles.typeText,
                        selectedTypes.includes(type) && styles.selectedTypeText,
                        isNavigating && styles.disabledTypeText
                      ]}>
                        {STORY_TYPE_INFO[type].label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </BlurView>
        </Animated.View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}

{isNavigating && (
  <View style={styles.navigationControls}>
    <TouchableOpacity
      style={styles.navigationButton}
      onPress={() => {
        setShowDirections(true);
      }}
    >
      <MaterialIcons name="list" size={24} color="#fff" />
      <Text style={styles.navigationButtonText}>Directions</Text>
    </TouchableOpacity>
  </View>
)}

        {route && (
          <View style={styles.editButtonsContainer}>
            {!isEditingWaypoints ? (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setIsEditingWaypoints(true)}
              >
                <MaterialIcons name="edit-location" size={24} color="white" />
                <Text style={styles.editButtonText}>Modify Route</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editingButtonsRow}>
                <TouchableOpacity
                  style={[styles.editButton, styles.cancelButton]}
                  onPress={cancelWaypointEditing}
                >
                  <MaterialIcons name="close" size={24} color="white" />
                  <Text style={styles.editButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editButton, styles.saveButton]}
                  onPress={saveModifiedRoute}
                >
                  <MaterialIcons name="check" size={24} color="white" />
                  <Text style={styles.editButtonText}>Save Route</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </SafeAreaView>

      {showDirections && route && (
        <DirectionsPanel
          visible={showDirections}
          onClose={() => setShowDirections(false)}
          route={{
            ...route,
            totalDistance: route?.totalDistance ? parseFloat(route.totalDistance) : 0,
            instructions: route?.instructions?.map(instruction => ({
              ...instruction,
              distance: instruction.distance ? parseFloat(instruction.distance) : 0,
              duration: instruction.duration_seconds || 0
            })) || []
          }}
          initialUnit={distanceUnit}
        />
      )}

      <Modal
        visible={showWaypointMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWaypointMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowWaypointMenu(false)}
        >
          <BlurView intensity={80} tint="dark" style={styles.waypointMenu}>
            <TouchableOpacity 
              style={styles.waypointMenuItem}
              onPress={handleViewDetails}
            >
              <MaterialIcons name="info" size={24} color="#fff" />
              <Text style={styles.waypointMenuText}>View Details</Text>
            </TouchableOpacity>

            {route && (
              isWaypointInRoute(selectedWaypoint) ? (
                <TouchableOpacity 
                  style={styles.waypointMenuItem}
                  onPress={handleRemoveFromRoute}
                >
                  <MaterialIcons name="remove-circle" size={24} color="#ef4444" />
                  <Text style={[styles.waypointMenuText, { color: '#ef4444' }]}>Remove from Route</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.waypointMenuItem}
                  onPress={handleAddToRoute}
                >
                  <MaterialIcons name="add-circle" size={24} color="#10b981" />
                  <Text style={[styles.waypointMenuText, { color: '#10b981' }]}>Add to Route</Text>
                </TouchableOpacity>
              )
            )}
          </BlurView>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showLocationDetails}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeLocationDetails}
      >
        {selectedWaypoint && (
          <LocationDetailScreen
            route={{ params: { location: selectedWaypoint } }}
            navigation={{
              goBack: closeLocationDetails,
              navigate: navigation.navigate
            }}
          />
        )}
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    flex: 1,
    backgroundColor: '#000',
  },
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  disabledTypeButton: {
    opacity: 0.5,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  disabledTypeText: {
    color: 'rgba(255, 255, 255, 0.2)',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  compassContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 90 : 70,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  compassIcon: {
    marginBottom: 2,
    transform: [{ rotate: '0deg' }],
  },
  compassText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  searchContainer: {
    marginTop: TOP_OFFSET,
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  searchBlur: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  expandButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    height: 40,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    marginLeft: 8,
  },
  clearButton: {
    padding: 6,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginLeft: 6,
  },
  predictionsContainer: {
    maxHeight: 180,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  predictionTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  predictionMainText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  predictionSecondaryText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 1,
  },
  typeContainer: {
    flexDirection: 'row',
    marginTop: 6,
    maxHeight: 36,
  },
  typeContentContainer: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedType: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  typeText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  selectedTypeText: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingVertical: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '500',
  },
  navigationContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 32 : 16,
    left: 12,
    right: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  navigationButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  navigationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  directionsButton: {
    backgroundColor: '#3b82f6',
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  navigationButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
  },
  instructionTextContainer: {
    flex: 1,
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  distanceText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  navigationInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  trackingModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  trackingModeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  disabledInput: {
    color: 'rgba(255, 255, 255, 0.2)',
  },
  navigationControls: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    flexDirection: 'column',
    gap: 12,
  },
  unitToggle: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  unitToggleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  editButtonsContainer: {
    position: 'absolute',
    bottom: 120,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  editButtonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  editingButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  removeWaypointButton: {
    position: 'absolute',
    top: -30,
    right: -10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waypointMenu: {
    width: 200,
    padding: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  waypointMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    marginVertical: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  waypointMenuText: {
    color: '#fff',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default TourGuideScreen;
