import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { generateARContent } from '../services/ai';

const ARViewScreen = ({ route, navigation }) => {
  const { location } = route.params || {};
  const [hasPermission, setHasPermission] = useState(null);
  const [arContent, setArContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    requestPermissions();
    if (location) {
      fetchARContent();
    }
  }, []);

  const requestPermissions = async () => {
    try {
      const [cameraPermission, locationPermission] = await Promise.all([
        Camera.requestCameraPermissionsAsync(),
        Location.requestForegroundPermissionsAsync(),
      ]);

      setHasPermission(
        cameraPermission.status === 'granted' && 
        locationPermission.status === 'granted'
      );
    } catch (err) {
      console.error('Error requesting permissions:', err);
      setError('Failed to get required permissions');
      setLoading(false);
    }
  };

  const fetchARContent = async () => {
    try {
      const content = await generateARContent(location);
      setArContent(content);
      setLoading(false);
    } catch (err) {
      console.error('Error generating AR content:', err);
      setError('Failed to generate AR content');
      setLoading(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.messageText}>Requesting permissions...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          Camera and location permissions are required for AR features.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermissions}>
          <Text style={styles.buttonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.messageText}>Preparing AR experience...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera style={styles.camera}>
        {arContent && (
          <View style={styles.overlay}>
            {arContent.points_of_interest.map((poi, index) => (
              <View
                key={index}
                style={[
                  styles.poiMarker,
                  {
                    transform: [
                      { translateX: poi.position.x * 100 },
                      { translateY: poi.position.y * 100 },
                      { translateZ: poi.position.z * 100 },
                    ],
                  },
                ]}
              >
                <Text style={styles.poiTitle}>{poi.title}</Text>
                <Text style={styles.poiDescription}>{poi.description}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.infoPanel}>
            <Text style={styles.infoTitle}>{location?.title}</Text>
            <Text style={styles.infoText}>
              Point your camera at the location to see historical details
            </Text>
          </View>
        </View>
      </Camera>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  poiMarker: {
    position: 'absolute',
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    padding: 12,
    borderRadius: 8,
    maxWidth: 200,
  },
  poiTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  poiDescription: {
    color: '#ffffff',
    fontSize: 14,
  },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  closeButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  infoPanel: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  infoTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: '#e2e8f0',
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 20,
  },
  messageText: {
    color: '#e2e8f0',
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ARViewScreen;