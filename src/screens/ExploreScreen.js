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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';
import { getNearbyLocations } from '../services/supabase';
import { generateHistoricalStory } from '../services/ai';

const LocationCard = ({ location, onPress, onARPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

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

  return (
    <Animated.View style={[styles.locationCard, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={onPress}
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
            <Text style={styles.locationTitle}>{location.title}</Text>
            {location.rating && (
              <View style={styles.ratingContainer}>
                <MaterialIcons name="star" size={16} color="#fbbf24" />
                <Text style={styles.ratingText}>{location.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>

          <Text style={styles.locationDescription} numberOfLines={2}>
            {location.description}
          </Text>

          <View style={styles.locationFooter}>
            <View style={styles.locationMetrics}>
              <Text style={styles.locationDistance}>
                {location.distance ? `${(location.distance / 1000).toFixed(1)} km away` : ''}
              </Text>
              {location.visitCount > 0 && (
                <Text style={styles.visitCount}>
                  {location.visitCount} {location.visitCount === 1 ? 'visit' : 'visits'}
                </Text>
              )}
            </View>

            <View style={styles.badgeContainer}>
              {location.hasStories && (
                <View style={styles.badge}>
                  <MaterialIcons name="history-edu" size={14} color="#3b82f6" />
                  <Text style={styles.badgeText}>Stories</Text>
                </View>
              )}
              {location.hasAR && (
                <TouchableOpacity
                  style={[styles.badge, styles.arBadge]}
                  onPress={() => onARPress(location)}
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

const ExploreScreen = ({ navigation }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [permissionStatus, setPermissionStatus] = useState(null);

  const filters = [
    { id: 'all', label: 'All', icon: 'public' },
    { id: 'nearby', label: 'Nearby', icon: 'near-me' },
    { id: 'popular', label: 'Popular', icon: 'trending-up' },
    { id: 'stories', label: 'Stories', icon: 'history-edu' },
  ];

  useEffect(() => {
    checkLocationPermission();
    loadUserPoints();
  }, []);

  useEffect(() => {
    if (permissionStatus === 'granted' || permissionStatus === 'denied') {
      fetchNearbyLocations(permissionStatus === 'denied');
    }
  }, [permissionStatus, selectedFilter]);

  const loadUserPoints = async () => {
    // TODO: Load from persistent storage
    setUserPoints(150);
  };

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status);
      
      if (status !== 'granted') {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(newStatus);
      }
    } catch (err) {
      console.error('Error checking location permission:', err);
      setError('Failed to check location permissions');
      setLoading(false);
    }
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const handlePermissionDenied = () => {
    Alert.alert(
      'Location Permission Required',
      'NanoHistory needs access to your location to show you nearby historical sites. Would you like to enable location access?',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => {
            // Load non-location based content
            fetchNearbyLocations(true);
          },
        },
        {
          text: 'Open Settings',
          onPress: openSettings,
        },
      ],
      { cancelable: false }
    );
  };

  const fetchNearbyLocations = async (skipLocation = false) => {
    try {
      setRefreshing(true);
      let locationData = null;

      if (!skipLocation && permissionStatus === 'granted') {
        locationData = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      let nearbyLocations;
      if (locationData) {
        nearbyLocations = await getNearbyLocations(
          locationData.coords.latitude,
          locationData.coords.longitude,
          selectedFilter
        );
      } else {
        // Fetch general locations without proximity sorting
        nearbyLocations = await getNearbyLocations(
          null,
          null,
          selectedFilter
        );
      }

      // Enhance locations with AI-generated content
      nearbyLocations = await Promise.all(
        nearbyLocations.map(async (loc) => {
          try {
            const story = await generateHistoricalStory(loc, {
              interests: ['history', 'architecture'], // TODO: Get from user preferences
            });
            return {
              ...loc,
              aiGeneratedStory: story,
            };
          } catch (err) {
            console.warn('Failed to generate story for location:', err);
            return loc;
          }
        })
      );

      setLocations(nearbyLocations);
      setError(null);
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError('Failed to fetch locations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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
    />
  );

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
            onPress={() => setSelectedFilter(filter.id)}
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
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <MaterialIcons name="explore" size={48} color="#3b82f6" />
        <Text style={styles.messageText}>Finding nearby historical sites...</Text>
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
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchNearbyLocations()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.pointsBanner}>
        <MaterialIcons name="stars" size={20} color="#fbbf24" />
        <Text style={styles.pointsText}>{userPoints} points</Text>
      </View>

      <FlatList
        data={locations}
        renderItem={renderLocationItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="location-off" size={48} color="#64748b" />
            <Text style={styles.messageText}>No historical sites found</Text>
            <Text style={styles.submessageText}>
              Try adjusting your filters or exploring a different area
            </Text>
          </View>
        }
        refreshing={refreshing}
        onRefresh={() => fetchNearbyLocations()}
      />

      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.arFab]}
          onPress={() => navigation.navigate('ARView')}
        >
          <MaterialIcons name="view-in-ar" size={24} color="#ffffff" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.fab, styles.createFab]}
          onPress={() => navigation.navigate('CreateStory')}
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
  pointsText: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
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
  listContainer: {
    padding: 16,
  },
  locationCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
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
    color: '#ffffff',
    marginRight: 8,
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
    color: '#94a3b8',
    marginBottom: 12,
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
  visitCount: {
    fontSize: 12,
    color: '#64748b',
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
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  messageText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 16,
  },
  submessageText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
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
});

export default ExploreScreen;
