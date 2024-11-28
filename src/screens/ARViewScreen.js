import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { GLView } from 'expo-gl';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, AnimatePresence } from 'moti';
import { Renderer } from 'expo-three';
import { AmbientLight, PerspectiveCamera, PointLight, Scene } from 'three';
import { Asset } from 'expo-asset';
import { generateARContent } from '../services/ai';
import { MaterialIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  const scene = useRef(null);
  const camera = useRef(null);
  const renderer = useRef(null);
  const animationFrameId = useRef(null);

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
      if (camera.current) {
        camera.current.rotation.x = data.x * Math.PI / 2;
        camera.current.rotation.y = data.y * Math.PI / 2;
      }
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
            width: Dimensions.get('window').width,
            height: Dimensions.get('window').height,
          },
        },
        previousInteractions: [], // TODO: Load from storage
        timeOfDay: new Date().getHours(),
      });
      
      setArContent(content);
      loadAmbientSounds(content.audio?.ambient);
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

  const loadAmbientSounds = async (ambient) => {
    if (!ambient || !audioEnabled) return;

    try {
      const { sound: audioObject } = await Audio.Sound.createAsync(
        { uri: ambient.url },
        { volume: ambient.volume, isLooping: true }
      );
      soundObjects.ambient = audioObject;
      await audioObject.playAsync();
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
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    if (renderer.current) {
      renderer.current.dispose();
    }
  };

  const handlePoiPress = (poi) => {
    setActivePoint(poi);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const onContextCreate = async (gl) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

    // Create renderer
    renderer.current = new Renderer({ gl });
    renderer.current.setSize(width, height);
    renderer.current.setClearColor(0x000000, 0);

    // Create scene
    scene.current = new Scene();

    // Create and setup camera
    camera.current = new PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.current.position.z = 5;

    // Add lighting
    const ambientLight = new AmbientLight(0xffffff, 0.5);
    scene.current.add(ambientLight);

    const pointLight = new PointLight(0xffffff, 0.8);
    pointLight.position.set(0, 1, 5);
    scene.current.add(pointLight);

    // Start render loop
    const render = () => {
      animationFrameId.current = requestAnimationFrame(render);
      
      if (camera.current && scene.current && renderer.current) {
        renderer.current.render(scene.current, camera.current);
      }
      
      gl.endFrameEXP();
    };
    render();
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 600 }}
        >
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.messageText}>Requesting permissions...</Text>
        </MotiView>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 600 }}
        >
          <MaterialIcons name="error-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>
            Camera, location, and audio permissions are required for AR features.
          </Text>
          <TouchableOpacity 
            style={styles.button}
            onPress={requestPermissions}
          >
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Grant Permissions</Text>
            </LinearGradient>
          </TouchableOpacity>
        </MotiView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 600 }}
        >
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.messageText}>Preparing immersive AR experience...</Text>
        </MotiView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 600 }}
        >
          <MaterialIcons name="error-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.button}
            onPress={() => navigation.goBack()}
          >
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Go Back</Text>
            </LinearGradient>
          </TouchableOpacity>
        </MotiView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera style={styles.camera}>
        <GLView
          style={StyleSheet.absoluteFill}
          onContextCreate={onContextCreate}
        />
        
        <Animated.View 
          style={[
            styles.overlay,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <AnimatePresence>
            {arContent?.models?.map((model) => (
              <MotiView
                key={model.id}
                from={{ opacity: 0, scale: 0.5 }}
                animate={{ 
                  opacity: 1,
                  scale: activePoint?.id === model.id ? 1.1 : 1,
                }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ 
                  type: 'spring',
                  damping: 15,
                }}
                style={[
                  styles.poiMarker,
                  {
                    transform: [
                      { translateX: model.position.x * 100 },
                      { translateY: model.position.y * 100 },
                    ],
                  },
                ]}
              >
                <BlurView intensity={80} tint="dark" style={styles.poiContent}>
                  <TouchableOpacity
                    onPress={() => handlePoiPress(model)}
                    style={styles.poiTouchable}
                  >
                    <MaterialIcons 
                      name="place"
                      size={24}
                      color="#ffffff"
                      style={styles.poiIcon}
                    />
                    <Text style={styles.poiTitle}>{model.title}</Text>
                    
                    <AnimatePresence>
                      {activePoint?.id === model.id && (
                        <MotiView
                          from={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ type: 'timing', duration: 300 }}
                          style={styles.poiDetails}
                        >
                          <Text style={styles.poiDescription}>
                            {model.description}
                          </Text>
                        </MotiView>
                      )}
                    </AnimatePresence>
                  </TouchableOpacity>
                </BlurView>
              </MotiView>
            ))}
          </AnimatePresence>
        </Animated.View>

        <BlurView
          intensity={30}
          tint="dark"
          style={styles.controls}
        >
          <View style={styles.controlButtons}>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                navigation.goBack();
              }}
            >
              <MaterialIcons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => {
                setAudioEnabled(!audioEnabled);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          </View>

          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', delay: 300 }}
          >
            <BlurView
              intensity={40}
              tint="dark"
              style={styles.infoPanel}
            >
              <Text style={styles.infoTitle}>{location?.title}</Text>
              <Text style={styles.infoText}>
                {activePoint
                  ? activePoint.description
                  : "Point your camera at the location to see historical details"}
              </Text>
            </BlurView>
          </MotiView>
        </BlurView>
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
    maxWidth: 300,
    borderRadius: 16,
    overflow: 'hidden',
  },
  poiContent: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  poiTouchable: {
    padding: 16,
  },
  poiIcon: {
    marginBottom: 8,
  },
  poiTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  poiDetails: {
    overflow: 'hidden',
  },
  poiDescription: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoPanel: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
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
    marginTop: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 16,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
  },
  buttonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ARViewScreen;
