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
} from 'react-native';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUSBAR_HEIGHT = StatusBar.currentHeight || 0;
const TOP_OFFSET = Platform.OS === 'ios' ? 44 : STATUSBAR_HEIGHT;

const STORY_TYPES = [
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
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [route, setRoute] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [currentInstruction, setCurrentInstruction] = useState(null);
  const [navigationInfo, setNavigationInfo] = useState(null);
  const [headingSubscription, setHeadingSubscription] = useState(null);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [hasCompassPermission, setHasCompassPermission] = useState(false);

  useEffect(() => {
    const setup = async () => {
      try {
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
  }, []);

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

  const fetchInitialWaypoints = async () => {
    try {
      const { data: historicalPoints, error } = await supabase
        .from('locations')
        .select(`
          *,
          ai_generated_stories (
            content,
            story_types
          )
        `);

      if (error) throw error;

      const transformedPoints = historicalPoints.map(point => ({
        id: point.id,
        title: point.title,
        description: point.description,
        latitude: point.latitude,
        longitude: point.longitude,
        story: point.ai_generated_stories?.[0]?.content,
        story_types: point.ai_generated_stories?.[0]?.story_types || []
      }));

      setWaypoints(transformedPoints);
    } catch (error) {
      console.error('Error fetching waypoints:', error);
    }
  };

  const initializeLocation = async () => {
    try {
      await tourGuideService.requestLocationPermissions();
      const location = await tourGuideService.getCurrentLocation();
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      Alert.alert('Error', 'Unable to get your location. Please enable location services.');
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

      const newRoute = await tourGuideService.generateTourRoute(
        currentLocation,
        destinationLocation,
        selectedTypes.length > 0 ? selectedTypes : ['all']
      );

      if (!newRoute?.coordinates?.length) {
        throw new Error('Failed to generate route coordinates');
      }

      setRoute(newRoute);

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

  const toggleStoryType = (type) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
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
          console.log('Location update:', location.coords);
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
              pitch: 60,
              zoom: 18,
              duration: 1000,
            });
          }
        }
      );
      setLocationSubscription(locSubscription);

      // Start compass tracking if permission granted
      if (hasCompassPermission) {
        const headSubscription = await Location.watchHeadingAsync((heading) => {
          console.log('Heading update:', heading.trueHeading);
          setCurrentHeading(heading.trueHeading);
          
          // Update map bearing when heading changes
          if (mapRef.current && isNavigating) {
            mapRef.current.animateCamera({
              bearing: heading.trueHeading,
              duration: 500,
            });
          }
        });
        setHeadingSubscription(headSubscription);
      }
    } catch (error) {
      console.error('Error starting location/heading tracking:', error);
      Alert.alert('Error', 'Failed to start location tracking');
    }
  };

  const startNavigation = async () => {
    if (!route) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await tourGuideService.startNavigation();
      setIsNavigating(true);

      setNavigationInfo({
        totalDistance: (route.totalDistance / 1000).toFixed(1),
        totalDuration: Math.round(route.totalDuration / 60)
      });
      setCurrentInstruction(route.instructions[0]);

      await startLocationTracking();

      if (mapRef.current && currentLocation) {
        mapRef.current.animateCamera({
          center: currentLocation,
          heading: currentHeading,
          pitch: 60,
          zoom: 17,
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

      if (locationSubscription) {
        locationSubscription.remove();
        setLocationSubscription(null);
      }
      if (headingSubscription) {
        headingSubscription.remove();
        setHeadingSubscription(null);
      }

      if (mapRef.current && route) {
        mapRef.current.fitToCoordinates([
          currentLocation,
          ...route.waypoints.map(point => ({
            latitude: point.latitude,
            longitude: point.longitude,
          })),
          route.end
        ], {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
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
              zoomEnabled={true}
              scrollEnabled={!isNavigating}
              pitchEnabled={true}
              rotateEnabled={true}
              showsUserLocation={true}
              showsMyLocationButton={true}
              showsCompass={true}
              loadingEnabled={true}
              moveOnMarkerPress={true}
              minZoomLevel={1}
              maxZoomLevel={20}
              zoomTapEnabled={true}
              zoomControlEnabled={true}
              followsUserLocation={isNavigating}
              followsUserHeading={isNavigating}
              userLocationAnnotationTitle="You are here"
              userLocationCalloutEnabled={true}
              onError={(error) => {
                console.error('MapView error:', error);
                Alert.alert('Map Error', 'Failed to load the map. Please try again.');
              }}
              camera={{
                center: currentLocation,
                pitch: 60,
                heading: currentHeading,
                altitude: 1000,
                zoom: 17,
              }}
              onUserLocationChange={(event) => {
                if (isNavigating && event.nativeEvent.coordinate) {
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
            >
              {currentLocation && (
                <Marker
                  coordinate={currentLocation}
                  title="You are here"
                  pinColor="#3b82f6"
                />
              )}
              {waypoints.map((point, index) => (
                <Marker
                  key={point.id || index}
                  coordinate={{
                    latitude: point.latitude,
                    longitude: point.longitude,
                  }}
                  title={point.title}
                  description={point.description}
                  pinColor="#10b981"
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
            </MapView>

            {/* Compass indicator */}
            {isNavigating && (
              <View style={styles.compassContainer}>
                <MaterialIcons 
                  name="navigation" 
                  size={24} 
                  color="#fff"
                  style={[
                    styles.compassIcon,
                    { transform: [{ rotate: `${-currentHeading}deg` }] }
                  ]}
                />
                <Text style={styles.compassText}>
                  {Math.round(currentHeading)}°
                </Text>
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
        <View style={styles.searchContainer}>
          <BlurView intensity={80} tint="dark" style={styles.searchBlur}>
            <View style={styles.headerContainer}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
              >
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Historical Tour Guide</Text>
            </View>

            <View style={styles.searchInputContainer}>
              <MaterialIcons name="search" size={22} color="rgba(255, 255, 255, 0.6)" />
              <TextInput
                style={styles.searchInput}
                placeholder="Enter destination..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={destination}
                onChangeText={(text) => {
                  setDestination(text);
                  fetchPlacePredictions(text);
                }}
              />
              {destination.length > 0 && (
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

            {showPredictions && predictions.length > 0 && (
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
                  ]}
                  onPress={() => toggleStoryType(type)}
                >
                  <MaterialIcons 
                    name={STORY_TYPE_INFO[type].icon} 
                    size={20} 
                    color={selectedTypes.includes(type) ? '#fff' : 'rgba(255, 255, 255, 0.6)'} 
                  />
                  <Text style={[
                    styles.typeText,
                    selectedTypes.includes(type) && styles.selectedTypeText,
                  ]}>
                    {STORY_TYPE_INFO[type].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </BlurView>
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading map...</Text>
          </View>
        )}

        {route && (
          <BlurView intensity={80} tint="dark" style={styles.navigationContainer}>
            {isNavigating && currentInstruction && (
              <View style={styles.instructionContainer}>
                <MaterialIcons 
                  name={currentInstruction.maneuver ? 
                    getManeuverIcon(currentInstruction.maneuver) : 
                    'arrow-forward'
                  } 
                  size={24} 
                  color="#fff" 
                />
                <Text style={styles.instructionText}>
                  {currentInstruction.text}
                </Text>
                <View style={styles.distanceContainer}>
                  <Text style={styles.distanceText}>
                    {currentInstruction.distance}
                  </Text>
                  <Text style={styles.durationText}>
                    {currentInstruction.duration}
                  </Text>
                </View>
              </View>
            )}

            {isNavigating && navigationInfo && (
              <View style={styles.navigationInfoContainer}>
                <View style={styles.infoItem}>
                  <MaterialIcons name="map" size={20} color="#fff" />
                  <Text style={styles.infoText}>
                    {navigationInfo.totalDistance} km
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <MaterialIcons name="schedule" size={20} color="#fff" />
                  <Text style={styles.infoText}>
                    {navigationInfo.totalDuration} min
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.navigationButton, isNavigating && styles.stopButton]}
              onPress={isNavigating ? stopNavigation : startNavigation}
            >
              <MaterialIcons 
                name={isNavigating ? "stop" : "navigation"} 
                size={24} 
                color="#fff" 
              />
              <Text style={styles.navigationButtonText}>
                {isNavigating ? 'Stop Navigation' : 'Start Navigation'}
              </Text>
            </TouchableOpacity>
          </BlurView>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
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
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 24,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  compassIcon: {
    marginBottom: 4,
    transform: [{ rotate: '0deg' }], // This will be dynamically updated
  },
  compassText: {
    color: '#fff',
    fontSize: 12,
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
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  searchBlur: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  clearButton: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginLeft: 8,
  },
  predictionsContainer: {
    maxHeight: 200,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  predictionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  predictionMainText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  predictionSecondaryText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 2,
  },
  typeContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  typeContentContainer: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  selectedType: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  typeText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 16,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
    fontWeight: '500',
  },
  navigationContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 20,
    right: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  navigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    gap: 8,
  },
  stopButton: {
    backgroundColor: '#ef4444',
  },
  navigationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  instructionText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  distanceContainer: {
    alignItems: 'flex-end',
  },
  distanceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  durationText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  navigationInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TourGuideScreen;
