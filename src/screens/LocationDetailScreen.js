import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { getLocationDetails, incrementVisitCount } from '../services/supabase';
import { generateHistoricalStory, generateVoice } from '../services/ai';
import { awardPoints, POINT_VALUES } from '../services/points';
import { supabase } from '../services/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.5;

const LocationDetailScreen = ({ route, navigation }) => {
  const { location } = route.params;
  const isMounted = useRef(true);
  const [details, setDetails] = useState(null);
  const [aiStory, setAiStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [expandedImage, setExpandedImage] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(false);
  const [pointsAnimation, setPointsAnimation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pointsAnim = useRef(new Animated.Value(0)).current;
  const pointsOpacity = useRef(new Animated.Value(0)).current;

  const imageScale = scrollY.interpolate({
    inputRange: [-100, 0, 100],
    outputRange: [1.2, 1, 0.8],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, IMAGE_HEIGHT - 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    fetchLocationDetails();
    getCurrentLocation();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();

    return () => {
      isMounted.current = false;
    };
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Please enable location services to earn points for visiting historical sites.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            }}
          ]
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation(location);
    } catch (err) {
      console.error('Error getting location:', err);
      Alert.alert(
        'Location Error',
        'Unable to get your location. Please make sure location services are enabled.',
        [
          { text: 'Try Again', onPress: getCurrentLocation },
          { text: 'Open Settings', onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          }}
        ]
      );
    }
  };

  const isWithinRange = (userLoc, targetLoc, rangeInMeters = 100) => {
    if (!userLoc || !targetLoc) return false;

    // Calculate distance using Haversine formula
    const R = 6371e3; // Earth's radius in meters
    const φ1 = userLoc.coords.latitude * Math.PI/180;
    const φ2 = targetLoc.latitude * Math.PI/180;
    const Δφ = (targetLoc.latitude - userLoc.coords.latitude) * Math.PI/180;
    const Δλ = (targetLoc.longitude - userLoc.coords.longitude) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const distance = R * c;
    return distance <= rangeInMeters;
  };

  const showPointsAnimation = (points) => {
    setPointsAnimation(points);
    pointsAnim.setValue(0);
    pointsOpacity.setValue(1);

    Animated.sequence([
      Animated.spring(pointsAnim, {
        toValue: -100,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(pointsOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start(() => setPointsAnimation(null));
  };

  const awardVisitPoints = async () => {
    try {
      // Check if user is at the location
      if (!isWithinRange(userLocation, location)) {
        console.log('User not at location, no points awarded');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await incrementVisitCount(location.id);
        await awardPoints(session.user.id, 'FIRST_VISIT', location.id, userLocation);
        showPointsAnimation(POINT_VALUES.FIRST_VISIT);
        setPointsAwarded(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      if (err.message === 'User not at location') {
        console.log('User not at location, no points awarded');
      } else {
        console.error('Error awarding points:', err);
      }
    }
  };

  const fetchLocationDetails = async () => {
    if (!isMounted.current) return;

    try {
      const locationDetails = await getLocationDetails(location.id);
      if (!isMounted.current) return;
      
      setDetails(locationDetails);
      
      if (!locationDetails.aiGeneratedStory) {
        const story = await generateHistoricalStory(locationDetails);
        if (!isMounted.current) return;
        setAiStory(story);
      }

      // Award points for visiting if not already awarded
      if (!pointsAwarded) {
        await awardVisitPoints();
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching location details:', err);
      if (!isMounted.current) return;
      setError('Failed to load location details');
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const handleARView = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // Check if user is at the location
      if (!isWithinRange(userLocation, location)) {
        Alert.alert(
          'Location Required',
          'You need to be at the historical site to earn points for AR photos.'
        );
        navigation.navigate('ARView', { location: details });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await awardPoints(session.user.id, 'AR_PHOTO', location.id, userLocation);
        showPointsAnimation(POINT_VALUES.AR_PHOTO);
      }
    } catch (err) {
      if (err.message === 'User not at location') {
        Alert.alert(
          'Location Required',
          'You need to be at the historical site to earn points for AR photos.'
        );
      } else {
        console.error('Error awarding AR points:', err);
      }
    }
    navigation.navigate('ARView', { location: details });
  };

  const handleAudioNarration = async () => {
    const storyToNarrate = details?.aiGeneratedStory?.story || aiStory?.story;
    if (!storyToNarrate) return;

    try {
      setPlayingAudio(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const audioBlob = await generateVoice(storyToNarrate);
      // Audio playback logic would go here
    } catch (err) {
      console.error('Error generating audio:', err);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to generate audio narration');
      }
    } finally {
      if (isMounted.current) {
        setPlayingAudio(false);
      }
    }
  };

  const handleImagePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedImage(!expandedImage);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading location details...</Text>
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
          onPress={fetchLocationDetails}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const storyImageUrl = details?.aiGeneratedStory?.imageUrl || aiStory?.imageUrl;

  return (
    <SafeAreaView style={styles.container}>
      {pointsAnimation && (
        <Animated.View style={[
          styles.pointsAnimation,
          {
            transform: [{ translateY: pointsAnim }],
            opacity: pointsOpacity,
          }
        ]}>
          <BlurView intensity={80} tint="dark" style={styles.pointsBadge}>
            <MaterialIcons name="stars" size={20} color="#fbbf24" />
            <Text style={styles.pointsText}>+{pointsAnimation} points</Text>
          </BlurView>
        </Animated.View>
      )}

      <Animated.View style={[
        styles.header,
        { opacity: headerOpacity }
      ]}>
        <BlurView intensity={80} tint="dark" style={styles.headerBlur}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {details?.title}
            </Text>
          </View>
        </BlurView>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <TouchableOpacity 
          activeOpacity={0.95}
          onPress={handleImagePress}
        >
          <Animated.View style={[
            styles.imageContainer,
            { transform: [{ scale: imageScale }] }
          ]}>
            <Image
              source={{ uri: storyImageUrl }}
              style={styles.storyMainImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.9)']}
              style={styles.imageGradient}
            />
            <View style={styles.imageOverlay}>
              <Text style={styles.title}>{details?.title}</Text>
              <View style={styles.periodContainer}>
                <MaterialIcons name="history" size={20} color="#fff" />
                <Text style={styles.period}>{details?.period}</Text>
              </View>
            </View>
          </Animated.View>
        </TouchableOpacity>

        <Animated.View style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }}>
          {/* AI Generated Story */}
          {(details?.aiGeneratedStory || aiStory) && (
            <BlurView intensity={20} tint="dark" style={styles.storyContainer}>
              <View style={styles.storyHeader}>
                <MaterialIcons name="psychology" size={24} color="#3b82f6" />
                <Text style={styles.storyHeaderText}>AI Historical Insights</Text>
              </View>
              <Text style={styles.storyText}>
                {details?.aiGeneratedStory?.story || aiStory?.story}
              </Text>
              <View style={styles.factsList}>
                {(details?.aiGeneratedStory?.facts || aiStory?.facts || []).map((fact, index) => (
                  <BlurView
                    key={index}
                    intensity={20}
                    tint="dark"
                    style={styles.factItem}
                  >
                    <MaterialIcons name="lightbulb" size={16} color="#3b82f6" />
                    <Text style={styles.factText}>{fact}</Text>
                  </BlurView>
                ))}
              </View>
            </BlurView>
          )}

          {/* User Stories */}
          {details?.userStories && details.userStories.length > 0 && (
            <View style={styles.userStoriesContainer}>
              <View style={styles.sectionHeader}>
                <MaterialIcons name="history-edu" size={24} color="#10b981" />
                <Text style={styles.sectionHeaderText}>Community Stories</Text>
              </View>
              {details.userStories.map((story, index) => (
                <BlurView
                  key={index}
                  intensity={20}
                  tint="dark"
                  style={styles.userStory}
                >
                  <Text style={styles.userStoryTitle}>{story.title}</Text>
                  <Text style={styles.userStoryContent}>{story.content}</Text>
                  {story.media_urls && story.media_urls.length > 0 && (
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false} 
                      style={styles.mediaScroll}
                    >
                      {story.media_urls.map((url, mediaIndex) => (
                        <TouchableOpacity
                          key={mediaIndex}
                          onPress={() => {/* Handle image preview */}}
                          style={styles.mediaImageContainer}
                        >
                          <Image
                            source={{ uri: url }}
                            style={styles.storyImage}
                          />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                  {story.tags && story.tags.length > 0 && (
                    <View style={styles.tagsContainer}>
                      {story.tags.map((tag, tagIndex) => (
                        <BlurView
                          key={tagIndex}
                          intensity={20}
                          tint="dark"
                          style={styles.tag}
                        >
                          <Text style={styles.tagText}>{tag}</Text>
                        </BlurView>
                      ))}
                    </View>
                  )}
                </BlurView>
              ))}
            </View>
          )}
        </Animated.View>
      </Animated.ScrollView>

      <BlurView intensity={80} tint="dark" style={styles.buttonContainer}>
        <View style={styles.buttonContent}>
          <TouchableOpacity
            style={styles.arButton}
            onPress={handleARView}
          >
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              style={styles.buttonGradient}
            >
              <MaterialIcons name="view-in-ar" size={24} color="#ffffff" />
              <Text style={styles.buttonText}>View in AR</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.audioButton, playingAudio && styles.playingButton]}
            onPress={handleAudioNarration}
            disabled={playingAudio || (!details?.aiGeneratedStory && !aiStory)}
          >
            <LinearGradient
              colors={playingAudio ? ['#1e293b', '#0f172a'] : ['#475569', '#334155']}
              style={styles.buttonGradient}
            >
              <MaterialIcons 
                name={playingAudio ? "pause" : "volume-up"} 
                size={24} 
                color="#ffffff" 
              />
              <Text style={styles.buttonText}>
                {playingAudio ? 'Playing Audio...' : 'Listen to Story'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </BlurView>

      {expandedImage && (
        <Animated.View 
          style={[
            styles.expandedImageContainer,
            { opacity: fadeAnim }
          ]}
        >
          <TouchableOpacity
            style={styles.expandedImageOverlay}
            onPress={handleImagePress}
            activeOpacity={1}
          >
            <Image
              source={{ uri: storyImageUrl }}
              style={styles.expandedImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleImagePress}
            >
              <BlurView intensity={80} tint="dark" style={styles.closeButtonBlur}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </BlurView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerBlur: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: '#000',
  },
  storyMainImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  periodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  period: {
    fontSize: 18,
    color: '#e2e8f0',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  storyContainer: {
    margin: 16,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    overflow: 'hidden',
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  storyHeaderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3b82f6',
    marginLeft: 12,
  },
  storyText: {
    fontSize: 16,
    color: '#e2e8f0',
    lineHeight: 24,
    marginBottom: 20,
  },
  factsList: {
    gap: 12,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    overflow: 'hidden',
  },
  factText: {
    flex: 1,
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 20,
  },
  userStoriesContainer: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#10b981',
    marginLeft: 12,
  },
  userStory: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    overflow: 'hidden',
  },
  userStoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  userStoryContent: {
    fontSize: 16,
    color: '#e2e8f0',
    lineHeight: 24,
    marginBottom: 16,
  },
  mediaScroll: {
    marginBottom: 16,
  },
  mediaImageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
  },
  storyImage: {
    width: 200,
    height: 150,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    overflow: 'hidden',
  },
  tagText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonContent: {
    padding: 16,
    gap: 12,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
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
    color: '#94a3b8',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  expandedImageContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 1000,
  },
  expandedImageOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1001,
  },
  closeButtonBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pointsAnimation: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    zIndex: 1000,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  pointsText: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default LocationDetailScreen;
