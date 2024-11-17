import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { getNearbyLocations } from '../services/supabase';

const ExploreScreen = ({ navigation }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchNearbyLocations();
  }, []);

  const fetchNearbyLocations = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access location was denied');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const nearbyLocations = await getNearbyLocations(
        location.coords.latitude,
        location.coords.longitude
      );

      setLocations(nearbyLocations);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError('Failed to fetch nearby locations');
      setLoading(false);
    }
  };

  const renderLocationItem = ({ item }) => (
    <TouchableOpacity
      style={styles.locationCard}
      onPress={() => navigation.navigate('LocationDetail', { location: item })}
    >
      <View style={styles.locationInfo}>
        <Text style={styles.locationTitle}>{item.title}</Text>
        <Text style={styles.locationDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={styles.locationDistance}>
          {item.distance ? `${(item.distance / 1000).toFixed(1)} km away` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.messageText}>Finding nearby historical sites...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchNearbyLocations}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={locations}
        renderItem={renderLocationItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.centerContainer}>
            <Text style={styles.messageText}>No historical sites found nearby</Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.arButton}
        onPress={() => navigation.navigate('ARView')}
      >
        <Text style={styles.arButtonText}>View in AR</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  listContainer: {
    padding: 16,
  },
  locationCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  locationInfo: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  locationDescription: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  locationDistance: {
    fontSize: 12,
    color: '#64748b',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  messageText: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  arButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  arButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ExploreScreen;