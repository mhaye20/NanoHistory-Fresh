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
  Linking,
  Alert,
  ActivityIndicator,
  Dimensions,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { getNearbyLocations } from '../services/supabase';
import { generateHistoricalStory } from '../services/ai';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HEADER_HEIGHT = Platform.OS === 'ios' ? 94 : 70;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.75;

const CHALLENGES = [
  {
    id: 'daily',
    title: 'Daily Explorer',
    description: 'Visit 3 new historical sites today',
    points: 100,
    icon: 'explore',
    progress: 0,
    target: 3,
    color: '#4f46e5',
  },
  {
    id: 'photographer',
    title: 'History Photographer',
    description: 'Share 5 photos of historical landmarks',
    points: 150,
    icon: 'camera-alt',
    progress: 2,
    target: 5,
    color: '#10b981',
  },
  {
    id: 'storyteller',
    title: 'Local Storyteller',
    description: 'Submit 2 historical stories',
    points: 200,
    icon: 'history-edu',
    progress: 0,
    target: 2,
    color: '#f59e0b',
  },
];

const LocationCard = ({ location, onPress, onARPress, colorScheme, index, scrollY }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(50)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [isExpanded, setIsExpanded] = useState(false);

  const inputRange = [
    (index - 1) * CARD_HEIGHT,
    index * CARD_HEIGHT,
    (index + 1) * CARD_HEIGHT,
  ];

  const scale = scrollY.interpolate({
    inputRange,
    outputRange: [0.9, 1, 0.9],
  });

  const opacity2 = scrollY.interpolate({
    inputRange,
    outputRange: [0.5, 1, 0.5],
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 600,
        delay: index * 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        delay: index * 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View 
      style={[
        styles.locationCard,
        {
          transform: [
            { scale: Animated.multiply(scaleAnim, scale) },
            { translateY },
          ],
          opacity: Animated.multiply(opacity, opacity2),
        }
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.cardTouchable}
      >
        <Image
          source={{ uri: location.imageUrl }}
          style={styles.locationImage}
          resizeMode="cover"
        />
        
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.9)']}
          locations={[0, 0.3, 0.8]}
          style={styles.gradient}
        >
          <View style={styles.locationContent}>
            <View style={styles.locationHeader}>
              <Text style={styles.locationTitle}>
                {location.title}
              </Text>
              <BlurView intensity={30} tint="dark" style={styles.ratingContainer}>
                <MaterialIcons name="star" size={16} color="#fbbf24" />
                <Text style={styles.ratingText}>
                  {location.rating ? location.rating.toFixed(1) : '4.5'}
                </Text>
              </BlurView>
            </View>

            <TouchableOpacity 
              style={styles.descriptionContainer}
              onPress={() => {
                setIsExpanded(!isExpanded);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text 
                style={styles.locationDescription}
                numberOfLines={isExpanded ? undefined : 2}
              >
                {location.description}
              </Text>
            </TouchableOpacity>

            {location.aiGeneratedStory && location.aiGeneratedStory.facts && (
              <BlurView intensity={20} tint="dark" style={styles.aiInsights}>
                <View style={styles.aiInsightsHeader}>
                  <MaterialIcons name="psychology" size={20} color="#3b82f6" />
                  <Text style={styles.aiInsightsTitle}>
                    AI Insights
                  </Text>
                </View>
                <View style={styles.factsList}>
                  {location.aiGeneratedStory.facts.slice(0, 2).map((fact, index) => (
                    <View key={index} style={styles.factItem}>
                      <MaterialIcons name="lightbulb" size={16} color="#3b82f6" />
                      <Text style={styles.factText}>{fact}</Text>
                    </View>
                  ))}
                </View>
              </BlurView>
            )}

            <View style={styles.locationFooter}>
              <BlurView intensity={20} tint="dark" style={styles.locationMetrics}>
                <Text style={styles.locationDistance}>
                  {location.distance ? `${(location.distance / 1000).toFixed(1)} km away` : '2.5 km away'}
                </Text>
                {location.visitCount > 0 && (
                  <Text style={styles.visitCount}>
                    {location.visitCount} {location.visitCount === 1 ? 'visit' : 'visits'}
                  </Text>
                )}
              </BlurView>

              <View style={styles.badgeContainer}>
                {location.hasStories && (
                  <TouchableOpacity
                    style={styles.badge}
                    onPress={onPress}
                  >
                    <MaterialIcons name="history-edu" size={16} color="#fff" />
                    <Text style={styles.badgeText}>Stories</Text>
                  </TouchableOpacity>
                )}
                {location.hasAR && (
                  <TouchableOpacity
                    style={[styles.badge, styles.arBadge]}
                    onPress={onARPress}
                  >
                    <MaterialIcons name="view-in-ar" size={16} color="#fff" />
                    <Text style={styles.badgeText}>AR</Text>
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

const ChallengeCard = ({ challenge, colorScheme }) => (
  <BlurView
    intensity={80}
    tint={colorScheme}
    style={[styles.challengeCard, { borderColor: challenge.color }]}
  >
    <View style={[styles.challengeIcon, { backgroundColor: `${challenge.color}30` }]}>
      <MaterialIcons name={challenge.icon} size={24} color={challenge.color} />
    </View>
    <View style={styles.challengeContent}>
      <Text style={styles.challengeTitle}>
        {challenge.title}
      </Text>
      <Text style={styles.challengeDescription}>
        {challenge.description}
      </Text>
      <View style={styles.challengeProgress}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { 
                width: `${(challenge.progress / challenge.target) * 100}%`,
                backgroundColor: challenge.color,
              }
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {challenge.progress}/{challenge.target}
        </Text>
      </View>
      <View style={styles.challengeReward}>
        <MaterialIcons name="stars" size={16} color="#fbbf24" />
        <Text style={styles.rewardText}>{challenge.points} points</Text>
      </View>
    </View>
  </BlurView>
);

const ExploreScreen = ({ navigation, route }) => {
  // Initialize all refs first
  const flatListRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isMounted = useRef(true);

  // Then all state
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [showChallenges, setShowChallenges] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const colorScheme = useColorScheme();

  const filters = [
    { id: 'all', label: 'All', icon: 'public' },
    { id: 'nearby', label: 'Nearby', icon: 'near-me' },
    { id: 'popular', label: 'Popular', icon: 'trending-up' },
    { id: 'stories', label: 'Stories', icon: 'history-edu' },
  ];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Initial setup
  useEffect(() => {
    const setup = async () => {
      try {
        await loadUserPoints();
        await checkLocationPermission();
      } catch (err) {
        console.error('Setup error:', err);
      }
    };
    setup();
  }, []);

  // Handle refresh param
  useEffect(() => {
    if (route.params?.refresh) {
      navigation.setParams({ refresh: undefined });
      handleRefresh();
    }
  }, [route.params?.refresh]);

  // Handle permission and filter changes
  useEffect(() => {
    if (permissionStatus === 'granted' || permissionStatus === 'denied') {
      setPage(1);
      setLocations([]);
      setHasMore(true);
      fetchNearbyLocations(permissionStatus === 'denied', 1);
    }
  }, [permissionStatus, selectedFilter]);

  const loadUserPoints = async () => {
    if (!isMounted.current) return;
    setUserPoints(150);
  };

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (!isMounted.current) return;
      
      setPermissionStatus(status);
      
      if (status !== 'granted') {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted.current) return;
        setPermissionStatus(newStatus);
      }
    } catch (err) {
      console.error('Error checking location permission:', err);
      if (!isMounted.current) return;
      setError('Failed to check location permissions');
      setLoading(false);
    }
  };

  const fetchNearbyLocations = async (skipLocation = false, currentPage = page) => {
    if (!isMounted.current) return;

    try {
      const isFirstPage = currentPage === 1;
      if (isFirstPage && !refreshing) {
        setLoading(true);
      } else if (!isFirstPage) {
        setLoadingMore(true);
      }

      let locationData = null;

      if (!skipLocation && permissionStatus === 'granted') {
        locationData = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      if (!isMounted.current) return;

      let result;
      if (locationData) {
        result = await getNearbyLocations(
          locationData.coords.latitude,
          locationData.coords.longitude,
          selectedFilter,
          5000,
          currentPage
        );
      } else {
        result = await getNearbyLocations(
          null,
          null,
          selectedFilter,
          5000,
          currentPage
        );
      }

      if (!isMounted.current) return;

      if (result?.locations) {
        setLocations(prev => 
          currentPage === 1 ? result.locations : [...prev, ...result.locations]
        );
        setHasMore(result.hasMore);
        setError(null);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching locations:', err);
      if (!isMounted.current) return;
      setError('Failed to fetch locations');
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchNearbyLocations(permissionStatus === 'denied', nextPage);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setLocations([]);
    setHasMore(true);
    fetchNearbyLocations(permissionStatus === 'denied', 1);
  };

  const handleLocationPress = useCallback((location) => {
    navigation.navigate('LocationDetail', { 
      location: {
        ...location,
        aiGeneratedStory: location.aiGeneratedStory,
      }
    });
  }, [navigation]);

  const handleARPress = useCallback((location) => {
    navigation.navigate('ARView', { location });
  }, [navigation]);

  const openSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  const renderLocationItem = useCallback(({ item, index }) => (
    <LocationCard
      location={item}
      onPress={() => handleLocationPress(item)}
      onARPress={() => handleARPress(item)}
      colorScheme={colorScheme}
      index={index}
      scrollY={scrollY}
    />
  ), [colorScheme, handleLocationPress, handleARPress]);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="explore" size={48} color="#3b82f6" />
        <Text style={styles.messageText}>
          Finding nearby historical sites...
        </Text>
      </View>
    );
  }

  if (permissionStatus === 'denied' && !locations.length) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="location-off" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Location access is required</Text>
        <Text style={styles.messageText}>
          Please enable location access to discover historical sites near you.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={openSettings}>
          <Text style={styles.retryButtonText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error && !locations.length) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="error-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => fetchNearbyLocations()}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <BlurView
        intensity={80}
        tint="dark"
        style={styles.headerContainer}
      >
        <View style={styles.headerContent}>
          <BlurView intensity={40} tint="dark" style={styles.pointsBanner}>
            <MaterialIcons name="stars" size={20} color="#fbbf24" />
            <Text style={styles.pointsText}>{userPoints} points</Text>
            <TouchableOpacity
              style={styles.challengesButton}
              onPress={() => {
                setShowChallenges(!showChallenges);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <MaterialIcons
                name={showChallenges ? "expand-less" : "expand-more"}
                size={24}
                color="#fbbf24"
              />
            </TouchableOpacity>
          </BlurView>

          <View style={styles.filterContainer}>
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterButton,
                  selectedFilter === filter.id && styles.filterButtonActive,
                ]}
                onPress={() => {
                  setSelectedFilter(filter.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

          {showChallenges && (
            <View style={styles.challengesContainer}>
              <Text style={styles.challengesTitle}>
                Daily Challenges
              </Text>
              <FlatList
                horizontal
                data={CHALLENGES}
                renderItem={({ item }) => (
                  <ChallengeCard challenge={item} colorScheme={colorScheme} />
                )}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.challengesList}
              />
            </View>
          )}
        </View>
      </BlurView>

      <Animated.FlatList
        ref={flatListRef}
        data={locations}
        renderItem={renderLocationItem}
        keyExtractor={(item) => item.id.toString()}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons
              name="location-off"
              size={48}
              color="rgba(255, 255, 255, 0.6)"
            />
            <Text style={styles.emptyText}>
              No historical sites found
            </Text>
            <Text style={styles.emptySubtext}>
              Try adjusting your filters or exploring a different area
            </Text>
          </View>
        }
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={CARD_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        windowSize={3}
        maxToRenderPerBatch={3}
        removeClippedSubviews={true}
        initialNumToRender={2}
      />

      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.arFab]}
          onPress={() => {
            navigation.navigate('ARView');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <MaterialIcons name="view-in-ar" size={24} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.fab, styles.createFab]}
          onPress={() => {
            navigation.navigate('CreateStory');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <MaterialIcons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: HEADER_HEIGHT,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  pointsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  pointsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  challengesButton: {
    padding: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 4,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  filterButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
  },
  filterText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  challengesContainer: {
    marginTop: 16,
  },
  challengesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  challengesList: {
    paddingRight: 16,
  },
  locationCard: {
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#000',
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
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    justifyContent: 'flex-end',
  },
  locationContent: {
    justifyContent: 'flex-end',
    paddingBottom: 200,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationTitle: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginRight: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  ratingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  descriptionContainer: {
    marginBottom: 16,
  },
  locationDescription: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  aiInsights: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  aiInsightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiInsightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  factsList: {
    gap: 12,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  factText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    flex: 1,
    lineHeight: 20,
  },
  locationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  locationMetrics: {
    borderRadius: 16,
    padding: 12,
  },
  locationDistance: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
    fontWeight: '500',
  },
  visitCount: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  arBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  challengeCard: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
    width: 280,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  challengeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  challengeContent: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  challengeDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
  },
  challengeProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginRight: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  challengeReward: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardText: {
    fontSize: 12,
    color: '#fbbf24',
    marginLeft: 4,
    fontWeight: '500',
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 100 : 80,
    alignItems: 'center',
    gap: 16,
    zIndex: 50,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  arFab: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  createFab: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: SCREEN_HEIGHT - 200,
  },
  emptyText: {
    fontSize: 20,
    color: '#fff',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default ExploreScreen;
