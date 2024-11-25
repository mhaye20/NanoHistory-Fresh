import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Image,
  Platform,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { getNearbyLocations } from '../services/supabase';
import { getUserPointsAndLevel, getUserAchievements, POINT_VALUES } from '../services/points';
import { supabase } from '../services/supabase';
import env from '../config/env';
import { debounce } from 'lodash';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_HEIGHT = Platform.OS === 'ios' ? 70 : 50;
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const CARD_HEIGHT = 400;
const SPACING = 12;

const LocationCard = ({ location, onPress, onARPress, index, scrollX }) => {
  const inputRange = [
    (index - 1) * (CARD_WIDTH + SPACING * 2),
    index * (CARD_WIDTH + SPACING * 2),
    (index + 1) * (CARD_WIDTH + SPACING * 2),
  ];

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.9, 1, 0.9],
  });

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.6, 1, 0.6],
  });

  // Format story types for display
  const getDisplayStoryTypes = () => {
    if (!Array.isArray(location.story_types) || location.story_types.length === 0) {
      return 'General History';
    }
    // Take first 2 story types and format them
    const types = location.story_types.slice(0, 2).map(type => 
      type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1')
    );
    return types.join(' • ') + (location.story_types.length > 2 ? ' • ...' : '');
  };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          transform: [{ scale }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={onPress}
        style={styles.cardTouchable}
      >
        <Image
          source={{ uri: location.imageUrl }}
          style={styles.locationImage}
          resizeMode="cover"
        />
        
        <BlurView intensity={50} tint="dark" style={styles.topLabelOverlay}>
          <Text style={styles.topLabelText}>{getDisplayStoryTypes()}</Text>
        </BlurView>

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
          style={styles.gradient}
        >
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.locationTitle}>{location.title}</Text>
            </View>

            <Text style={styles.locationDescription} numberOfLines={3}>
              {location.description}
            </Text>

            <View style={styles.cardFooter}>
              <View style={styles.locationInfo}>
                <BlurView intensity={30} tint="dark" style={styles.distanceBadge}>
                  <MaterialIcons name="place" size={16} color="#fff" />
                  <Text style={styles.distanceText}>
                    {location.distance ? `${(location.distance / 1000).toFixed(1)} km` : '2.5 km'}
                  </Text>
                </BlurView>

                {location.hasStories && (
                  <BlurView intensity={30} tint="dark" style={styles.storiesBadge}>
                    <MaterialIcons name="history-edu" size={16} color="#10b981" />
                    <Text style={styles.storiesText}>Stories Available</Text>
                  </BlurView>
                )}
              </View>

              <View style={styles.actions}>
                {location.hasAR && (
                  <TouchableOpacity
                    style={styles.arButton}
                    onPress={onARPress}
                  >
                    <LinearGradient
                      colors={['#10b981', '#059669']}
                      style={styles.actionButton}
                    >
                      <MaterialIcons name="view-in-ar" size={20} color="#fff" />
                      <Text style={styles.pointsText}>+{POINT_VALUES.AR_PHOTO}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const FilterModal = ({ visible, onClose, title, options, selectedValue, onSelect }) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <BlurView intensity={80} tint="dark" style={styles.modalBlur}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.optionsContainer}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionButton,
                    selectedValue === option.id && styles.optionButtonSelected,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelect(option.id);
                    onClose();
                  }}
                >
                  <MaterialIcons
                    name={option.icon}
                    size={24}
                    color={selectedValue === option.id ? '#fff' : 'rgba(255, 255, 255, 0.6)'}
                  />
                  <Text
                    style={[
                      styles.optionText,
                      selectedValue === option.id && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selectedValue === option.id && (
                    <MaterialIcons
                      name="check"
                      size={24}
                      color="#fff"
                      style={styles.optionCheckmark}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
    </KeyboardAvoidingView>
  );
};

const ExploreScreen = ({ navigation, route }) => {
  const [locations, setLocations] = useState([]);
  const [filteredLocations, setFilteredLocations] = useState([]); // New state for filtered results
  const [allLocations, setAllLocations] = useState([]); // New state to store all locations
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState(route.params?.source === 'swipe' ? 'nearby' : 'all');
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [userLevel, setUserLevel] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [recentAchievement, setRecentAchievement] = useState(null);
  const [customLocation, setCustomLocation] = useState('');
  const [currentCoords, setCurrentCoords] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [localSearchResults, setLocalSearchResults] = useState([]);
  const scrollX = useRef(new Animated.Value(0)).current;
  const achievementAnim = useRef(new Animated.Value(0)).current;
  const [selectedStoryType, setSelectedStoryType] = useState('all');
  const [availableStoryTypes, setAvailableStoryTypes] = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);

  const filters = [
    { id: 'all', label: 'All', icon: 'public' },
    { id: 'nearby', label: 'Nearby', icon: 'near-me' },
    { id: 'popular', label: 'Popular', icon: 'trending-up' },
    { id: 'stories', label: 'Stories', icon: 'history-edu' },
  ];

  const periods = [
    { id: 'all', label: 'All Periods', icon: 'timeline' },
    { id: 'ancient', label: 'Ancient', icon: 'account-balance' },
    { id: 'medieval', label: 'Medieval', icon: 'castle' },
    { id: 'renaissance', label: 'Renaissance', icon: 'palette' },
    { id: 'modern', label: 'Modern', icon: 'apartment' },
    { id: 'contemporary', label: 'Contemporary', icon: 'business' },
  ];

  const storyTypeIcons = {
    all: { label: 'All Stories', icon: 'auto-stories' },
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

  const filterButtons = [
    { id: 'sort', label: 'Sort', icon: 'sort' },
    { id: 'period', label: 'Period', icon: 'history' },
    { id: 'type', label: 'Type', icon: 'category' },
  ];

  useEffect(() => {
    checkLocationPermission();
    loadUserData();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadUserData();
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (route.params?.refresh) {
      loadUserData();
      navigation.setParams({ refresh: undefined });
    }
  }, [route.params?.refresh]);

  useEffect(() => {
    if (permissionStatus === 'granted' || permissionStatus === 'denied') {
      fetchNearbyLocations(permissionStatus === 'denied');
    }
  }, [permissionStatus, selectedPeriod]);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const pointsData = await getUserPointsAndLevel(user.id);
        const achievementsData = await getUserAchievements(user.id);
        
        setUserPoints(pointsData.points);
        setUserLevel(pointsData);
        setAchievements(achievementsData);

        const recent = achievementsData[achievementsData.length - 1];
        if (recent && new Date(recent.earned_at) > new Date(Date.now() - 5000)) {
          setRecentAchievement(recent);
          showAchievementAnimation();
        }
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  const showAchievementAnimation = () => {
    achievementAnim.setValue(0);
    Animated.sequence([
      Animated.spring(achievementAnim, {
        toValue: 1,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(achievementAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start(() => setRecentAchievement(null));
  };

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
    } catch (err) {
      console.error('Error checking location permission:', err);
      setError('Failed to check location permissions');
      setLoading(false);
    }
  };

  const fetchPlacePredictions = useCallback(
    debounce(async (input) => {
      if (!input.trim()) {
        setPredictions([]);
        setLocalSearchResults([]);
        setShowPredictions(false);
        return;
      }

      try {
        // Search through local locations first
        const searchTerm = input.toLowerCase();
        const matchingLocations = locations.filter(location => 
          location.title.toLowerCase().includes(searchTerm) ||
          (location.content && typeof location.content === 'string' && 
           JSON.parse(location.content).story_location?.toLowerCase().includes(searchTerm))
        );
        setLocalSearchResults(matchingLocations);

        // Then fetch Google Maps predictions
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            input
          )}&key=${env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
        );
        const data = await response.json();
        
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
      }
    }, 300),
    [locations]
  );

  const handleLocationSelect = async (prediction) => {
    try {
      setLoading(true);
      setShowPredictions(false);
      setCustomLocation(prediction.description);

      const { lat, lng } = prediction.geometry.location;
      setCurrentCoords({ latitude: lat, longitude: lng });
      fetchNearbyLocations(false, { latitude: lat, longitude: lng });
    } catch (err) {
      console.error('Error selecting location:', err);
      Alert.alert('Error', 'Failed to get location details');
    } finally {
      setLoading(false);
    }
  };

  const handleLocalLocationSelect = (location) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPredictions(false);
    setCustomLocation('');
    handleLocationPress(location);
  };

  const searchLocation = async () => {
    if (!customLocation.trim()) {
      Alert.alert('Error', 'Please enter a location');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(customLocation)}&key=${env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        setCurrentCoords({ latitude: lat, longitude: lng });
        fetchNearbyLocations(false, { latitude: lat, longitude: lng });
      } else {
        Alert.alert('Error', 'Location not found');
      }
    } catch (err) {
      console.error('Error searching location:', err);
      Alert.alert('Error', 'Failed to search location');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = useCallback((locations, storyType, period) => {
    let filtered = [...locations];

    // Apply period filter
    if (period !== 'all') {
      filtered = filtered.filter(loc => 
        loc.period?.toLowerCase().includes(period.toLowerCase())
      );
    }

    // Apply story type filter
    if (storyType !== 'all') {
      const normalizedSelectedType = storyType.toLowerCase().replace(/([A-Z])/g, '_$1');
      filtered = filtered.filter(loc => {
        if (!Array.isArray(loc.story_types)) return false;
        const normalizedLocationTypes = loc.story_types.map(type => 
          type.toLowerCase().replace(/([A-Z])/g, '_$1')
        );
        return normalizedLocationTypes.includes(normalizedSelectedType);
      });
    }

    return filtered;
  }, []);

  const fetchNearbyLocations = async (skipLocation = false, customCoords = null, filterOverride = null) => {
    setLoading(true);
    try {
      let locationData = null;
      if (!skipLocation) {
        if (customCoords) {
          locationData = { coords: customCoords };
        } else {
          locationData = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setCurrentCoords(locationData.coords);
        }
      }

      const searchRadius = (filterOverride || selectedFilter) === 'nearby' ? 5000 : 50000;

      const result = await getNearbyLocations(
        locationData?.coords.latitude,
        locationData?.coords.longitude,
        filterOverride || selectedFilter,
        searchRadius
      );

      if (result?.locations) {
        // Parse story types for each location
        const parsedLocations = result.locations.map(loc => ({
          ...loc,
          story_types: (() => {
            try {
              if (Array.isArray(loc.story_types)) {
                return loc.story_types;
              }
              if (typeof loc.story_types === 'string') {
                const parsed = JSON.parse(loc.story_types);
                return Array.isArray(parsed) ? parsed : [];
              }
              return [];
            } catch (err) {
              console.error('[ExploreScreen] Error parsing story types:', err);
              return [];
            }
          })()
        }));

        // Store all locations
        setAllLocations(parsedLocations);

        // Apply current filters
        const filtered = applyFilters(parsedLocations, selectedStoryType, selectedPeriod);
        setFilteredLocations(filtered);
        setLocations(filtered);

        // Collect all unique story types
        const types = new Set(['all']);
        parsedLocations.forEach(loc => {
          if (Array.isArray(loc.story_types)) {
            loc.story_types.forEach(type => types.add(type));
          }
        });

        setAvailableStoryTypes(Array.from(types));
        setError(null);
      }
    } catch (err) {
      console.error('[ExploreScreen] Error fetching locations:', err);
      setError('Failed to fetch locations');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSelect = (filterId, value) => {
    console.log('[ExploreScreen] Filter selected:', {
      filterId,
      value,
      previousValue: getSelectedValue(filterId)
    });

    switch (filterId) {
      case 'sort':
        setSelectedFilter(value);
        if (currentCoords) {
          fetchNearbyLocations(false, currentCoords, value);
        } else {
          fetchNearbyLocations(value === 'all', null, value);
        }
        break;
      case 'period':
        setSelectedPeriod(value);
        const periodFiltered = applyFilters(allLocations, selectedStoryType, value);
        setFilteredLocations(periodFiltered);
        setLocations(periodFiltered);
        break;
      case 'type':
        setSelectedStoryType(value);
        const typeFiltered = applyFilters(allLocations, value, selectedPeriod);
        setFilteredLocations(typeFiltered);
        setLocations(typeFiltered);
        break;
    }
  };

  const handleLocationPress = useCallback((location) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('LocationDetail', { location });
  }, [navigation]);

  const handleARPress = useCallback((location) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('ARView', { location });
  }, [navigation]);

  const getSelectedValue = (filterId) => {
    switch (filterId) {
      case 'sort':
        return selectedFilter;
      case 'period':
        return selectedPeriod;
      case 'type':
        return selectedStoryType;
      default:
        return null;
    }
  };

  const getFilterOptions = (filterId) => {
    switch (filterId) {
      case 'sort':
        return filters.map(f => ({
          id: f.id,
          label: f.label,
          icon: f.icon,
        }));
      case 'period':
        return periods.map(p => ({
          id: p.id,
          label: p.label,
          icon: p.icon,
        }));
      case 'type':
        return availableStoryTypes.map(typeId => {
          // If we have a predefined icon/label for this type, use it
          if (storyTypeIcons[typeId]) {
            return {
              id: typeId,
              ...storyTypeIcons[typeId],
            };
          }
          // Otherwise create a default icon/label
          return {
            id: typeId,
            label: typeId.charAt(0).toUpperCase() + typeId.slice(1).replace(/([A-Z])/g, ' $1'),
            icon: 'category'
          };
        });
      default:
        return [];
    }
  };

  const getActiveFilters = () => {
    const active = [];
    if (selectedFilter !== 'all') {
      const filter = filters.find(f => f.id === selectedFilter);
      if (filter) active.push(filter.label);
    }
    if (selectedPeriod !== 'all') {
      const period = periods.find(p => p.id === selectedPeriod);
      if (period) active.push(period.label);
    }
    if (selectedStoryType !== 'all') {
      // If we have a predefined icon/label for this type, use it
      const type = storyTypeIcons[selectedStoryType];
      if (type) {
        active.push(type.label);
      } else {
        // Otherwise create a formatted label
        active.push(selectedStoryType.charAt(0).toUpperCase() + 
          selectedStoryType.slice(1).replace(/([A-Z])/g, ' $1'));
      }
    }
    return active;
  };

  const clearSearch = () => {
    setCustomLocation('');
    setPredictions([]);
    setLocalSearchResults([]);
    setShowPredictions(false);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Discovering historical sites...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => fetchNearbyLocations(permissionStatus === 'denied')}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <SafeAreaView style={styles.container}>
        {recentAchievement && (
          <Animated.View style={[
            styles.achievementPopup,
            {
              transform: [
                { scale: achievementAnim },
                { translateY: achievementAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-100, 0]
                })}
              ],
              opacity: achievementAnim
            }
          ]}>
            <BlurView intensity={80} tint="dark" style={styles.achievementContent}>
              <MaterialIcons name={recentAchievement.icon} size={24} color="#fbbf24" />
              <View>
                <Text style={styles.achievementTitle}>{recentAchievement.title}</Text>
                <Text style={styles.achievementDesc}>{recentAchievement.description}</Text>
              </View>
              <Text style={styles.achievementPoints}>+{recentAchievement.points}</Text>
            </BlurView>
          </Animated.View>
        )}

        <BlurView intensity={80} tint="dark" style={styles.header}>
          <LinearGradient
            colors={['rgba(251, 191, 36, 0.1)', 'rgba(251, 191, 36, 0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.levelBanner}
          >
            <View style={styles.levelInfo}>
              <View style={styles.medalContainer}>
                <MaterialIcons name="military-tech" size={24} color="#fbbf24" />
              </View>
              <View style={styles.levelTextContainer}>
                <Text style={styles.levelTitle}>Level {userLevel?.level}</Text>
                <Text style={styles.levelSubtitle}>{userLevel?.title || 'Explorer'}</Text>
              </View>
              <View style={styles.pointsContainer}>
                <Text style={styles.pointsValue}>{userPoints}</Text>
                <Text style={styles.pointsLabel}>PTS</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.searchWrapper}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.searchContainer}
            >
              <MaterialIcons name="search" size={22} color="rgba(255, 255, 255, 0.6)" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search location..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                value={customLocation}
                onChangeText={(text) => {
                  setCustomLocation(text);
                  fetchPlacePredictions(text);
                }}
                onSubmitEditing={searchLocation}
              />
              {customLocation.length > 0 && (
                <TouchableOpacity 
                  onPress={clearSearch}
                  style={styles.clearButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="close" size={20} color="rgba(255, 255, 255, 0.6)" />
                </TouchableOpacity>
              )}
            </LinearGradient>

            {showPredictions && (predictions.length > 0 || localSearchResults.length > 0) && (
              <View style={styles.predictionsWrapper}>
                <BlurView intensity={80} tint="dark" style={styles.predictionsContainer}>
                  <ScrollView 
                    style={styles.predictionsScroll}
                    bounces={false} 
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled={true}
                  >
                    {localSearchResults.length > 0 && (
                      <View>
                        <View style={styles.predictionSectionHeader}>
                          <MaterialIcons name="history-edu" size={18} color="rgba(255, 255, 255, 0.6)" />
                          <Text style={styles.predictionSectionTitle}>Story Locations</Text>
                        </View>
                        {localSearchResults.map((location) => (
                          <TouchableOpacity
                            key={location.id}
                            style={styles.predictionItem}
                            onPress={() => handleLocalLocationSelect(location)}
                          >
                            <MaterialIcons name="auto-stories" size={18} color="#10b981" />
                            <View style={styles.predictionTextContainer}>
                              <Text style={styles.predictionMainText}>
                                {location.title}
                              </Text>
                              <Text style={styles.predictionSecondaryText}>
                                {typeof location.content === 'string' 
                                  ? JSON.parse(location.content).story_location 
                                  : location.content?.story_location}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {predictions.length > 0 && (
                      <View>
                        <View style={styles.predictionSectionHeader}>
                          <MaterialIcons name="place" size={18} color="rgba(255, 255, 255, 0.6)" />
                          <Text style={styles.predictionSectionTitle}>Places</Text>
                        </View>
                        {predictions.map((prediction) => (
                          <TouchableOpacity
                            key={prediction.place_id}
                            style={styles.predictionItem}
                            onPress={() => handleLocationSelect(prediction)}
                          >
                            <MaterialIcons name="place" size={18} color="rgba(255, 255, 255, 0.6)" />
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
                      </View>
                    )}
                  </ScrollView>
                </BlurView>
              </View>
            )}
          </View>

          <View style={styles.filterButtons}>
            {filterButtons.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterButton,
                  activeFilter === filter.id && styles.filterButtonActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveFilter(filter.id);
                }}
              >
                <LinearGradient
                  colors={activeFilter === filter.id ? 
                    ['rgba(59, 130, 246, 0.3)', 'rgba(37, 99, 235, 0.3)'] : 
                    ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.filterButtonGradient}
                >
                  <MaterialIcons
                    name={filter.icon}
                    size={20}
                    color={activeFilter === filter.id ? '#fff' : 'rgba(255, 255, 255, 0.6)'}
                  />
                  <Text style={[
                    styles.filterButtonLabel,
                    activeFilter === filter.id && styles.filterButtonLabelActive
                  ]}>
                    {filter.label}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {getActiveFilters().length > 0 && (
            <BlurView intensity={30} tint="dark" style={styles.activeFiltersContainer}>
              {getActiveFilters().map((filter, index) => (
                <Text key={index} style={styles.activeFilterText}>
                  {filter}
                  {index < getActiveFilters().length - 1 ? ' • ' : ''}
                </Text>
              ))}
            </BlurView>
          )}
        </BlurView>

        <Animated.FlatList
          data={filteredLocations}  // Changed from locations to filteredLocations
          renderItem={({ item, index }) => (
            <LocationCard
              location={item}
              onPress={() => handleLocationPress(item)}
              onARPress={() => handleARPress(item)}
              index={index}
              scrollX={scrollX}
            />
          )}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          pagingEnabled
          snapToInterval={CARD_WIDTH + SPACING * 2}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="search-off" size={48} color="rgba(255, 255, 255, 0.6)" />
              <Text style={styles.emptyText}>No locations found</Text>
              <Text style={styles.emptySubtext}>Try a different filter or explore another area</Text>
            </View>
          }
        />

        {filterButtons.map((filter) => (
          <FilterModal
            key={filter.id}
            visible={activeFilter === filter.id}
            onClose={() => setActiveFilter(null)}
            title={filter.label}
            options={getFilterOptions(filter.id)}
            selectedValue={getSelectedValue(filter.id)}
            onSelect={(value) => handleFilterSelect(filter.id, value)}
          />
        ))}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: HEADER_HEIGHT,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  levelBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  levelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medalContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  levelTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 'auto',
  },
  levelTitle: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(251, 191, 36, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  levelSubtitle: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.8,
    marginTop: 2,
  },
  pointsContainer: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  pointsValue: {
    color: '#fbbf24',
    fontSize: 20,
    fontWeight: '700',
  },
  pointsLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.8,
    marginTop: 2,
  },
  searchWrapper: {
    marginTop: 16,
    zIndex: 2000,
    elevation: 2000,
    position: 'relative',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
    marginRight: 8,
  },
  clearButton: {
    padding: 4,
  },
  predictionsWrapper: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    zIndex: 2000,
    elevation: 2000,
  },
  predictionsContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  predictionsScroll: {
    flexGrow: 0,
  },
  predictionSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    gap: 8,
  },
  predictionSectionTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  predictionTextContainer: {
    flex: 1,
  },
  predictionMainText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  predictionSecondaryText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  filterButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  filterButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButtonLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  filterButtonLabelActive: {
    color: '#fff',
    fontWeight: '600',
  },
  activeFiltersContainer: {
    marginTop: 12,
    marginHorizontal: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeFilterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.9,
    paddingHorizontal: 4,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  cardContent: {
    padding: 20,
  },
  cardHeader: {
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  locationDescription: {
    fontSize: 16,
    color: '#e2e8f0',
    marginBottom: 16,
    lineHeight: 24,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  locationInfo: {
    gap: 8,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  distanceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  storiesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  storiesText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
  },
  pointsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  modalBlur: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  optionButtonSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  optionText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  optionCheckmark: {
    marginLeft: 'auto',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#e2e8f0',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 16,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    marginHorizontal: SPACING,
  },
  emptyText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  achievementPopup: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  achievementContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  achievementTitle: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '600',
  },
  achievementDesc: {
    color: '#e2e8f0',
    fontSize: 14,
  },
  achievementPoints: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  listContent: {
    paddingVertical: 24,
    paddingHorizontal: SPACING,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginHorizontal: SPACING,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardTouchable: {
    flex: 1,
  },
  locationImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  topLabelOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  topLabelText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
  },
});

export default ExploreScreen;
