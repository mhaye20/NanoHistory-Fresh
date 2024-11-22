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
  ScrollView,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_HEIGHT = Platform.OS === 'ios' ? 94 : 70;
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
        
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
          style={styles.gradient}
        >
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <Text style={styles.locationTitle}>{location.title}</Text>
              {location.period && (
                <BlurView intensity={30} tint="dark" style={styles.periodBadge}>
                  <MaterialIcons name="history" size={16} color="#fff" />
                  <Text style={styles.periodText}>{location.period}</Text>
                </BlurView>
              )}
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

                <TouchableOpacity
                  style={styles.detailsButton}
                  onPress={onPress}
                >
                  <LinearGradient
                    colors={['#3b82f6', '#2563eb']}
                    style={styles.actionButton}
                  >
                    <MaterialIcons name="arrow-forward" size={20} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ExploreScreen = ({ navigation, route }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
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
  const scrollX = useRef(new Animated.Value(0)).current;
  const achievementAnim = useRef(new Animated.Value(0)).current;

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
        setShowPredictions(false);
        return;
      }

      try {
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
    []
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
        // Filter locations by period if a specific period is selected
        const filteredLocations = selectedPeriod === 'all' 
          ? result.locations 
          : result.locations.filter(loc => 
              loc.period?.toLowerCase().includes(selectedPeriod.toLowerCase())
            );
        
        setLocations(filteredLocations);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError('Failed to fetch locations');
    } finally {
      setLoading(false);
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

  const progressPercentage = userLevel ? 
    ((userPoints - userLevel.minPoints) / (userLevel.nextLevel?.minPoints - userLevel.minPoints)) * 100 :
    0;

  return (
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
        <View style={styles.headerTop}>
          <BlurView intensity={30} tint="dark" style={styles.levelBanner}>
            <View style={styles.levelInfo}>
              <MaterialIcons name="military-tech" size={24} color="#fbbf24" />
              <View>
                <Text style={styles.levelTitle}>Level {userLevel?.level}</Text>
                <Text style={styles.levelSubtitle}>{userLevel?.title}</Text>
              </View>
            </View>
            <View style={styles.pointsContainer}>
              <Text style={styles.pointsValue}>{userPoints}</Text>
              <Text style={styles.pointsLabel}>POINTS</Text>
            </View>
          </BlurView>

          <View style={styles.searchWrapper}>
            <BlurView intensity={30} tint="dark" style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Enter city or address..."
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={customLocation}
                onChangeText={(text) => {
                  setCustomLocation(text);
                  fetchPlacePredictions(text);
                }}
                onSubmitEditing={searchLocation}
              />
              <TouchableOpacity 
                style={styles.searchButton}
                onPress={searchLocation}
              >
                <MaterialIcons name="search" size={24} color="#fff" />
              </TouchableOpacity>
            </BlurView>

            {showPredictions && predictions.length > 0 && (
              <BlurView intensity={80} tint="dark" style={styles.predictionsContainer}>
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
              </BlurView>
            )}
          </View>
        </View>

        <View style={styles.filterContainer}>
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterButton,
                selectedFilter === filter.id && styles.filterButtonActive,
              ]}
              onPress={() => {
                const newFilter = filter.id;
                setSelectedFilter(newFilter);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (currentCoords) {
                  fetchNearbyLocations(false, currentCoords, newFilter);
                } else {
                  fetchNearbyLocations(newFilter === 'all', null, newFilter);
                }
              }}
            >
              <MaterialIcons
                name={filter.icon}
                size={20}
                color={selectedFilter === filter.id ? '#fff' : 'rgba(255, 255, 255, 0.6)'}
              />
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === filter.id && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.periodFilterContainer}
        >
          {periods.map((period) => (
            <TouchableOpacity
              key={period.id}
              style={[
                styles.periodButton,
                selectedPeriod === period.id && styles.periodButtonActive,
              ]}
              onPress={() => {
                setSelectedPeriod(period.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <MaterialIcons
                name={period.icon}
                size={20}
                color={selectedPeriod === period.id ? '#fff' : 'rgba(255, 255, 255, 0.6)'}
              />
              <Text
                style={[
                  styles.periodText,
                  selectedPeriod === period.id && styles.periodTextActive,
                ]}
              >
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BlurView>

      <Animated.FlatList
        data={locations}
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
    </SafeAreaView>
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
    overflow: 'hidden',
  },
  headerTop: {
    marginBottom: 16,
  },
  levelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  levelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  levelTitle: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '600',
  },
  levelSubtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
  },
  pointsContainer: {
    alignItems: 'center',
  },
  pointsValue: {
    color: '#fbbf24',
    fontSize: 24,
    fontWeight: '700',
  },
  pointsLabel: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  searchWrapper: {
    position: 'relative',
    zIndex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginRight: 12,
  },
  searchButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  predictionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: 200,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  predictionText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 4,
    marginTop: 16,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  filterText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  periodFilterContainer: {
    marginTop: 12,
  },
  periodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  periodButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  periodText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  periodTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 24,
    paddingHorizontal: SPACING,
    minWidth: '100%',
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
  periodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 6,
  },
  periodText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginRight: 12,
  },
  searchButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },

});

export default ExploreScreen;
