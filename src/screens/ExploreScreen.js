import React, { useState, useEffect, useRef } from 'react';
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
import { getNearbyLocations } from '../services/supabase';
import { generateHistoricalStory } from '../services/ai';

const CHALLENGES = [
  {
    id: 'daily',
    title: 'Daily Explorer',
    description: 'Visit 3 new historical sites today',
    points: 100,
    icon: 'explore',
    progress: 0,
    target: 3,
  },
  {
    id: 'photographer',
    title: 'History Photographer',
    description: 'Share 5 photos of historical landmarks',
    points: 150,
    icon: 'camera-alt',
    progress: 2,
    target: 5,
  },
  {
    id: 'storyteller',
    title: 'Local Storyteller',
    description: 'Submit 2 historical stories',
    points: 200,
    icon: 'history-edu',
    progress: 0,
    target: 2,
  },
];

const LocationCard = ({ location, onPress, onARPress, colorScheme }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const handleARPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onARPress(location);
  };

  return (
    <Animated.View 
      style={[
        styles.locationCard,
        colorScheme === 'dark' && styles.locationCardDark,
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        {location.imageUrl && (
          <Image
            source={{ uri: location.imageUrl }}
            style={styles.locationImage}
            resizeMode="cover"
          />
        )}
        <View style={styles.locationContent}>
          <View style={styles.locationHeader}>
            <Text style={[
              styles.locationTitle,
              colorScheme === 'dark' && styles.locationTitleDark
            ]}>
              {location.title}
            </Text>
            {location.rating && (
              <View style={styles.ratingContainer}>
                <MaterialIcons name="star" size={16} color="#fbbf24" />
                <Text style={styles.ratingText}>{location.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
            <Text 
              style={[
                styles.locationDescription,
                colorScheme === 'dark' && styles.locationDescriptionDark,
                !isExpanded && styles.truncatedText
              ]}
              numberOfLines={isExpanded ? undefined : 2}
            >
              {location.description}
            </Text>
          </TouchableOpacity>

          {location.aiGeneratedStory && location.aiGeneratedStory.facts && (
            <View style={styles.aiInsights}>
              <Text style={[
                styles.aiInsightsTitle,
                colorScheme === 'dark' && styles.aiInsightsTitleDark
              ]}>
                AI Insights
              </Text>
              <View style={styles.factsList}>
                {location.aiGeneratedStory.facts.slice(0, 2).map((fact, index) => (
                  <View key={index} style={styles.factItem}>
                    <MaterialIcons name="lightbulb" size={16} color="#3b82f6" />
                    <Text style={[
                      styles.factText,
                      colorScheme === 'dark' && styles.factTextDark
                    ]}>
                      {fact}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.locationFooter}>
            <View style={styles.locationMetrics}>
              <Text style={[
                styles.locationDistance,
                colorScheme === 'dark' && styles.locationDistanceDark
              ]}>
                {location.distance ? `${(location.distance / 1000).toFixed(1)} km away` : ''}
              </Text>
              {location.visitCount > 0 && (
                <Text style={[
                  styles.visitCount,
                  colorScheme === 'dark' && styles.visitCountDark
                ]}>
                  {location.visitCount} {location.visitCount === 1 ? 'visit' : 'visits'}
                </Text>
              )}
            </View>

            <View style={styles.badgeContainer}>
              {location.hasStories && (
                <TouchableOpacity
                  style={styles.badge}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onPress();
                  }}
                >
                  <MaterialIcons name="history-edu" size={14} color="#3b82f6" />
                  <Text style={styles.badgeText}>Stories</Text>
                </TouchableOpacity>
              )}
              {location.hasAR && (
                <TouchableOpacity
                  style={[styles.badge, styles.arBadge]}
                  onPress={handleARPress}
                >
                  <MaterialIcons name="view-in-ar" size={14} color="#3b82f6" />
                  <Text style={styles.badgeText}>AR</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ChallengeCard = ({ challenge, colorScheme }) => (
  <View style={[
    styles.challengeCard,
    colorScheme === 'dark' && styles.challengeCardDark
  ]}>
    <View style={styles.challengeIcon}>
      <MaterialIcons name={challenge.icon} size={24} color="#3b82f6" />
    </View>
    <View style={styles.challengeContent}>
      <Text style={[
        styles.challengeTitle,
        colorScheme === 'dark' && styles.challengeTitleDark
      ]}>
        {challenge.title}
      </Text>
      <Text style={[
        styles.challengeDescription,
        colorScheme === 'dark' && styles.challengeDescriptionDark
      ]}>
        {challenge.description}
      </Text>
      <View style={styles.challengeProgress}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { width: `${(challenge.progress / challenge.target) * 100}%` }
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
  </View>
);

const ExploreScreen = ({ navigation, route }) => {
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

  useEffect(() => {
    console.log('ExploreScreen mounted');
    checkLocationPermission();
    loadUserPoints();
  }, []);

  // Add effect to handle refresh parameter
  useEffect(() => {
    if (route.params?.refresh) {
      // Clear the refresh parameter
      navigation.setParams({ refresh: undefined });
      // Refresh the locations
      handleRefresh();
    }
  }, [route.params?.refresh]);

  useEffect(() => {
    console.log('Permission status or filter changed:', { permissionStatus, selectedFilter });
    if (permissionStatus === 'granted' || permissionStatus === 'denied') {
      // Reset pagination when filter changes
      setPage(1);
      setLocations([]);
      setHasMore(true);
      fetchNearbyLocations(permissionStatus === 'denied', 1);
    }
  }, [permissionStatus, selectedFilter]);

  const loadUserPoints = async () => {
    // TODO: Load from persistent storage
    setUserPoints(150);
  };

  const checkLocationPermission = async () => {
    try {
      console.log('Checking location permission...');
      const { status } = await Location.getForegroundPermissionsAsync();
      console.log('Initial permission status:', status);
      setPermissionStatus(status);
      
      if (status !== 'granted') {
        console.log('Requesting location permission...');
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        console.log('New permission status:', newStatus);
        setPermissionStatus(newStatus);
      }
    } catch (err) {
      console.error('Error checking location permission:', err);
      setError('Failed to check location permissions');
      setLoading(false);
    }
  };

  const fetchNearbyLocations = async (skipLocation = false, currentPage = page) => {
    try {
      const isFirstPage = currentPage === 1;
      if (isFirstPage) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      let locationData = null;

      if (!skipLocation && permissionStatus === 'granted') {
        console.log('Getting current position...');
        locationData = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        console.log('Current position:', locationData);
      }

      let result;
      if (locationData) {
        console.log('Fetching locations with coordinates:', {
          lat: locationData.coords.latitude,
          lng: locationData.coords.longitude,
          page: currentPage
        });
        result = await getNearbyLocations(
          locationData.coords.latitude,
          locationData.coords.longitude,
          selectedFilter,
          5000,
          currentPage
        );
      } else {
        console.log('Fetching locations without coordinates');
        result = await getNearbyLocations(
          null,
          null,
          selectedFilter,
          5000,
          currentPage
        );
      }

      console.log('Fetched locations:', result);

      setLocations(prev => 
        currentPage === 1 ? result.locations : [...prev, ...result.locations]
      );
      setHasMore(result.hasMore);
      setError(null);
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError('Failed to fetch locations');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
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

  const handleLocationPress = (location) => {
    navigation.navigate('LocationDetail', { 
      location: {
        ...location,
        aiGeneratedStory: location.aiGeneratedStory,
      }
    });
  };

  const handleARPress = (location) => {
    navigation.navigate('ARView', { location });
  };

  const renderLocationItem = ({ item }) => (
    <LocationCard
      location={item}
      onPress={() => handleLocationPress(item)}
      onARPress={() => handleARPress(item)}
      colorScheme={colorScheme}
    />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#3b82f6" />
        <Text style={styles.loadingMoreText}>Loading more locations...</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
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
              color={selectedFilter === filter.id ? '#3b82f6' : '#64748b'}
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
          <Text style={[
            styles.challengesTitle,
            colorScheme === 'dark' && styles.challengesTitleDark
          ]}>
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
  );

  if (loading && !refreshing) {
    return (
      <View style={[
        styles.centerContainer,
        colorScheme === 'dark' && styles.centerContainerDark
      ]}>
        <MaterialIcons name="explore" size={48} color="#3b82f6" />
        <Text style={[
          styles.messageText,
          colorScheme === 'dark' && styles.messageTextDark
        ]}>
          Finding nearby historical sites...
        </Text>
      </View>
    );
  }

  if (permissionStatus === 'denied' && !locations.length) {
    return (
      <View style={[
        styles.centerContainer,
        colorScheme === 'dark' && styles.centerContainerDark
      ]}>
        <MaterialIcons name="location-off" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Location access is required</Text>
        <Text style={[
          styles.messageText,
          colorScheme === 'dark' && styles.messageTextDark
        ]}>
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
      <View style={[
        styles.centerContainer,
        colorScheme === 'dark' && styles.centerContainerDark
      ]}>
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
    <SafeAreaView style={[
      styles.container,
      colorScheme === 'dark' && styles.containerDark
    ]}>
      <View style={[
        styles.pointsBanner,
        colorScheme === 'dark' && styles.pointsBannerDark
      ]}>
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
      </View>

      <FlatList
        data={locations}
        renderItem={renderLocationItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons
              name="location-off"
              size={48}
              color={colorScheme === 'dark' ? '#64748b' : '#94a3b8'}
            />
            <Text style={[
              styles.messageText,
              colorScheme === 'dark' && styles.messageTextDark
            ]}>
              No historical sites found
            </Text>
            <Text style={[
              styles.submessageText,
              colorScheme === 'dark' && styles.submessageTextDark
            ]}>
              Try adjusting your filters or exploring a different area
            </Text>
          </View>
        }
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />

      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.arFab]}
          onPress={() => {
            navigation.navigate('ARView');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <MaterialIcons name="view-in-ar" size={24} color="#ffffff" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.fab, styles.createFab]}
          onPress={() => {
            navigation.navigate('CreateStory');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <MaterialIcons name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  containerDark: {
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  pointsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pointsBannerDark: {
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
  },
  pointsText: {
    color: '#fbbf24',
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
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  filterText: {
    color: '#64748b',
    fontSize: 14,
    marginLeft: 4,
  },
  filterTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  challengesContainer: {
    marginTop: 16,
  },
  challengesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  challengesTitleDark: {
    color: '#ffffff',
  },
  challengesList: {
    paddingRight: 16,
  },
  challengeCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 280,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  challengeCardDark: {
    backgroundColor: '#1e293b',
  },
  challengeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
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
    color: '#0f172a',
    marginBottom: 4,
  },
  challengeTitleDark: {
    color: '#ffffff',
  },
  challengeDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  challengeDescriptionDark: {
    color: '#94a3b8',
  },
  challengeProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 2,
    marginRight: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  progressText: {
    fontSize: 12,
    color: '#64748b',
  },
  challengeReward: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardText: {
    fontSize: 12,
    color: '#fbbf24',
    marginLeft: 4,
  },
  listContainer: {
    padding: 16,
  },
  locationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  locationCardDark: {
    backgroundColor: '#1e293b',
  },
  locationImage: {
    width: '100%',
    height: 200,
  },
  locationContent: {
    padding: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginRight: 8,
  },
  locationTitleDark: {
    color: '#ffffff',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  locationDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  locationDescriptionDark: {
    color: '#94a3b8',
  },
  truncatedText: {
    marginBottom: 4,
  },
  aiInsights: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  aiInsightsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  aiInsightsTitleDark: {
    color: '#ffffff',
  },
  factsList: {
    gap: 8,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  factText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 8,
    flex: 1,
  },
  factTextDark: {
    color: '#94a3b8',
  },
  locationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationMetrics: {
    flexDirection: 'column',
  },
  locationDistance: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  locationDistanceDark: {
    color: '#94a3b8',
  },
  visitCount: {
    fontSize: 12,
    color: '#64748b',
  },
  visitCountDark: {
    color: '#94a3b8',
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  arBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  badgeText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    gap: 16,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#3b82f6',
  },
  createFab: {
    backgroundColor: '#10b981',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
  },
  centerContainerDark: {
    backgroundColor: '#0f172a',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  messageText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 16,
  },
  messageTextDark: {
    color: '#94a3b8',
  },
  submessageText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
  submessageTextDark: {
    color: '#64748b',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#64748b',
  },
});

export default ExploreScreen;
