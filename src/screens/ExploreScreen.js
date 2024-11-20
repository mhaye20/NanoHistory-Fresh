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
import { getUserPointsAndLevel, getUserAchievements } from '../services/points';
import { supabase } from '../services/supabase';

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
          colors={['transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.9)']}
          style={styles.gradient}
        >
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={styles.titleContainer}>
                <Text style={styles.locationTitle}>{location.title}</Text>
                {location.hasStories && (
                  <BlurView intensity={30} tint="dark" style={styles.storiesIndicator}>
                    <MaterialIcons name="history-edu" size={16} color="#10b981" />
                    <Text style={styles.storiesText}>Stories</Text>
                  </BlurView>
                )}
              </View>
              <BlurView intensity={30} tint="dark" style={styles.ratingContainer}>
                <MaterialIcons name="star" size={16} color="#fbbf24" />
                <Text style={styles.ratingText}>
                  {location.rating ? location.rating.toFixed(1) : '4.5'}
                </Text>
              </BlurView>
            </View>

            <View style={styles.perksContainer}>
              <BlurView intensity={20} tint="dark" style={styles.perkBadge}>
                <MaterialIcons name="place" size={16} color="#fbbf24" />
                <Text style={styles.perkText}>+100 First Visit</Text>
              </BlurView>
              <BlurView intensity={20} tint="dark" style={styles.perkBadge}>
                <MaterialIcons name="camera-alt" size={16} color="#fbbf24" />
                <Text style={styles.perkText}>+200 AR Photo</Text>
              </BlurView>
              <BlurView intensity={20} tint="dark" style={styles.perkBadge}>
                <MaterialIcons name="history-edu" size={16} color="#fbbf24" />
                <Text style={styles.perkText}>+300 Story Share</Text>
              </BlurView>
            </View>

            <Text style={styles.locationDescription} numberOfLines={3}>
              {location.description}
            </Text>

            {location.aiGeneratedStory && location.aiGeneratedStory.facts && (
              <View style={styles.factsContainer}>
                <BlurView intensity={20} tint="dark" style={styles.factItem}>
                  <MaterialIcons name="lightbulb" size={16} color="#3b82f6" />
                  <Text style={styles.factText}>
                    {location.aiGeneratedStory.facts[0]}
                  </Text>
                </BlurView>
              </View>
            )}

            <View style={styles.cardFooter}>
              <View style={styles.locationInfo}>
                <BlurView intensity={20} tint="dark" style={styles.distanceContainer}>
                  <MaterialIcons name="place" size={16} color="#fff" />
                  <Text style={styles.distanceText}>
                    {location.distance ? `${(location.distance / 1000).toFixed(1)} km` : '2.5 km'}
                  </Text>
                </BlurView>

                {location.period && (
                  <BlurView intensity={20} tint="dark" style={styles.periodContainer}>
                    <MaterialIcons name="history" size={16} color="#fff" />
                    <Text style={styles.periodText}>{location.period}</Text>
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

const ExploreScreen = ({ navigation }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [userLevel, setUserLevel] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [recentAchievement, setRecentAchievement] = useState(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const achievementAnim = useRef(new Animated.Value(0)).current;

  const filters = [
    { id: 'all', label: 'All', icon: 'public' },
    { id: 'nearby', label: 'Nearby', icon: 'near-me' },
    { id: 'popular', label: 'Popular', icon: 'trending-up' },
    { id: 'stories', label: 'Stories', icon: 'history-edu' },
  ];

  useEffect(() => {
    checkLocationPermission();
    loadUserData();
  }, []);

  useEffect(() => {
    if (permissionStatus === 'granted' || permissionStatus === 'denied') {
      fetchNearbyLocations(permissionStatus === 'denied');
    }
  }, [permissionStatus, selectedFilter]);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const pointsData = await getUserPointsAndLevel(user.id);
        const achievementsData = await getUserAchievements(user.id);
        
        setUserPoints(pointsData.points);
        setUserLevel(pointsData);
        setAchievements(achievementsData);

        // Check for most recent achievement
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

  const fetchNearbyLocations = async (skipLocation = false) => {
    setLoading(true);
    try {
      let locationData = null;
      if (!skipLocation) {
        locationData = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      const result = await getNearbyLocations(
        locationData?.coords.latitude,
        locationData?.coords.longitude,
        selectedFilter,
        5000
      );

      if (result?.locations) {
        setLocations(result.locations);
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
          <BlurView intensity={30} tint="dark" style={styles.pointsBanner}>
            <View style={styles.levelBadge}>
              <MaterialIcons name="military-tech" size={20} color="#fbbf24" />
              <Text style={styles.levelText}>Level {userLevel?.level}</Text>
            </View>
            <View style={styles.pointsInfo}>
              <Text style={styles.pointsTitle}>{userLevel?.title}</Text>
              <View style={styles.pointsProgress}>
                <Text style={styles.pointsText}>{userPoints} points</Text>
                <Text style={styles.nextLevelText}>
                  {userLevel?.nextLevel ? 
                    `${userLevel.nextLevel.minPoints - userPoints} points to Level ${userLevel.nextLevel.level}` :
                    'Max Level Achieved!'
                  }
                </Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
                </View>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.achievementsButton}
              onPress={() => {
                // Show achievements modal/screen
              }}
            >
              <MaterialIcons name="emoji-events" size={24} color="#fbbf24" />
              <Text style={styles.achievementsCount}>{achievements.length}</Text>
            </TouchableOpacity>
          </BlurView>
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

      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.createFab]}
          onPress={() => {
            navigation.navigate('CreateStory');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <LinearGradient
            colors={['#10b981', '#059669']}
            style={styles.fabGradient}
          >
            <MaterialIcons name="add" size={24} color="#fff" />
          </LinearGradient>
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
  pointsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
  },
  levelText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
  },
  pointsInfo: {
    flex: 1,
    marginLeft: 12,
  },
  pointsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  pointsProgress: {
    gap: 4,
  },
  pointsText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '500',
  },
  nextLevelText: {
    color: 'rgba(251, 191, 36, 0.8)',
    fontSize: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fbbf24',
    borderRadius: 2,
  },
  achievementsButton: {
    alignItems: 'center',
    marginLeft: 12,
  },
  achievementsCount: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
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
  filterContainer: {
    flexDirection: 'row',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  locationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  storiesIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  storiesText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  perksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  perkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  perkText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
  },
  ratingText: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  locationDescription: {
    fontSize: 16,
    color: '#e2e8f0',
    marginBottom: 16,
    lineHeight: 24,
  },
  factsContainer: {
    marginBottom: 16,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    gap: 8,
  },
  factText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  locationInfo: {
    gap: 8,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 4,
  },
  distanceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  periodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 4,
  },
  periodText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 40 : 20,
  },
  fab: {
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
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
});

export default ExploreScreen;
