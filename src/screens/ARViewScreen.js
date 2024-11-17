import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Vibration,
} from 'react-native';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { GLView } from 'expo-gl';
import { Accelerometer } from 'expo-sensors';
import { generateARContent } from '../services/ai';
import { MaterialIcons } from '@expo/vector-icons';

const ARViewScreen = ({ route, navigation }) => {
  const { location, userContext } = route.params || {};
  const [hasPermission, setHasPermission] = useState(null);
  const [arContent, setArContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activePoint, setActivePoint] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [deviceOrientation, setDeviceOrientation] = useState({ x: 0, y: 0, z: 0 });
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const soundObjects = useRef({}).current;
  const subscription = useRef(null);

  useEffect(() => {
    setupAR();
    return () => cleanup();
  }, []);

  const setupAR = async () => {
    try {
      await requestPermissions();
      if (location) {
        await Promise.all([
          fetchARContent(),
          setupAccelerometer(),
          setupAudio(),
        ]);
      }
    } catch (err) {
      console.error('Error setting up AR:', err);
      setError('Failed to initialize AR experience');
      setLoading(false);
    }
  };

  const requestPermissions = async () => {
    try {
      const [cameraPermission, locationPermission, audioPermission] = await Promise.all([
        Camera.requestCameraPermissionsAsync(),
        Location.requestForegroundPermissionsAsync(),
        Audio.requestPermissionsAsync(),
      ]);

      setHasPermission(
        cameraPermission.status === 'granted' && 
        locationPermission.status === 'granted' &&
        audioPermission.status === 'granted'
      );
    } catch (err) {
      console.error('Error requesting permissions:', err);
      setError('Failed to get required permissions');
      setLoading(false);
    }
  };

  const setupAccelerometer = async () => {
    subscription.current = Accelerometer.addListener(data => {
      setDeviceOrientation(data);
    });
    await Accelerometer.setUpdateInterval(16); // ~60fps
  };

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (err) {
      console.error('Error setting up audio:', err);
    }
  };

  const fetchARContent = async () => {
    try {
      const content = await generateARContent(location, {
        deviceCapabilities: {
          hasGyroscope: true,
          hasAccelerometer: true,
          screenSize: {
            width: Platform.OS === 'web' ? window.innerWidth : Dimensions.get('window').width,
            height: Platform.OS === 'web' ? window.innerHeight : Dimensions.get('window').height,
          },
        },
        previousInteractions: [], // TODO: Fetch from local storage
        timeOfDay: new Date().getHours(),
      });
      
      setArContent(content);
      loadAmbientSounds(content.ambient_sounds);
      setLoading(false);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.error('Error generating AR content:', err);
      setError('Failed to generate AR content');
      setLoading(false);
    }
  };

  const loadAmbientSounds = async (sounds) => {
    if (!sounds || !audioEnabled) return;

    try {
      for (const sound of sounds) {
        const { sound: audioObject } = await Audio.Sound.createAsync(
          { uri: sound.url },
          { volume: sound.volume, isLooping: true }
        );
        soundObjects[sound.id] = audioObject;
        await audioObject.playAsync();
      }
    } catch (err) {
      console.error('Error loading ambient sounds:', err);
    }
  };

  const cleanup = () => {
    if (subscription.current) {
      subscription.current.remove();
    }
    Object.values(soundObjects).forEach(async (sound) => {
      try {
        await sound.unloadAsync();
      } catch (err) {
        console.error('Error unloading sound:', err);
      }
    });
  };

  const handlePoiPress = (poi) => {
    setActivePoint(poi);
    Vibration.vibrate(50); // Haptic feedback
    
    // Trigger animation if available
    if (poi.animations?.length > 0) {
      // TODO: Implement 3D model animation
    }
  };

  const renderARScene = () => {
    return (
      <GLView
        style={StyleSheet.absoluteFill}
        onContextCreate={async (gl) => {
          // TODO: Implement Three.js scene setup
        }}
      />
    );
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
          Camera, location, and audio permissions are required for AR features.
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
        <Text style={styles.messageText}>Preparing immersive AR experience...</Text>
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
        {renderARScene()}
        
        <Animated.View 
          style={[
            styles.overlay,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          {arContent?.points_of_interest.map((poi) => (
            <TouchableOpacity
              key={poi.id}
              style={[
                styles.poiMarker,
                activePoint?.id === poi.id && styles.activePoi,
                {
                  transform: [
                    { translateX: poi.position.x * 100 },
                    { translateY: poi.position.y * 100 },
                    { scale: activePoint?.id === poi.id ? 1.1 : 1 },
                  ],
                },
              ]}
              onPress={() => handlePoiPress(poi)}
            >
              <Text style={styles.poiTitle}>{poi.title}</Text>
              {activePoint?.id === poi.id && (
                <View style={styles.poiContent}>
                  <Text style={styles.poiDescription}>{poi.description}</Text>
                  {poi.interactionPoints?.map((point, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.interactionPoint}
                      onPress={() => {
                        // TODO: Handle interaction point action
                      }}
                    >
                      <MaterialIcons name="touch-app" size={24} color="#ffffff" />
                      <Text style={styles.interactionText}>{point.content}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </Animated.View>

        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.audioButton}
            onPress={() => {
              setAudioEnabled(!audioEnabled);
              Object.values(soundObjects).forEach(sound => {
                audioEnabled ? sound.pauseAsync() : sound.playAsync();
              });
            }}
          >
            <MaterialIcons
              name={audioEnabled ? "volume-up" : "volume-off"}
              size={24}
              color="#ffffff"
            />
          </TouchableOpacity>

          <View style={styles.infoPanel}>
            <Text style={styles.infoTitle}>{location?.title}</Text>
            <Text style={styles.infoText}>
              {activePoint
                ? "Tap interaction points to learn more"
                : "Point your camera at the location to see historical details"}
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
    maxWidth: 250,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activePoi: {
    backgroundColor: 'rgba(59, 130, 246, 0.95)',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  poiTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  poiContent: {
    marginTop: 8,
  },
  poiDescription: {
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 8,
  },
  interactionPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  interactionText: {
    color: '#ffffff',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
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
  audioButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 8,
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
