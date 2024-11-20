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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { MotiView, AnimatePresence } from 'moti';
import { getLocationDetails } from '../services/supabase';
import { generateHistoricalStory, generateVoice } from '../services/ai';

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

  const scrollY = useRef(new Animated.Value(0)).current;
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
    return () => {
      isMounted.current = false;
    };
  }, []);

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

  const handleARView = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      <MotiView 
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={styles.centerContainer}
      >
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading location details...</Text>
      </MotiView>
    );
  }

  if (error) {
    return (
      <MotiView 
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        style={styles.centerContainer}
      >
        <MaterialIcons name="error-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton} 
          onPress={fetchLocationDetails}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </MotiView>
    );
  }

  const storyImageUrl = details?.aiGeneratedStory?.imageUrl || aiStory?.imageUrl;

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[
        styles.header,
        { opacity: headerOpacity }
      ]}>
        <BlurView intensity={80} tint="dark" style={styles.headerBlur}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {details?.title}
          </Text>
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
              colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.8)']}
              style={styles.imageGradient}
            />
            <View style={styles.imageOverlay}>
              <Text style={styles.title}>{details?.title}</Text>
              <Text style={styles.period}>{details?.period}</Text>
            </View>
          </Animated.View>
        </TouchableOpacity>

        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600 }}
        >
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
                  <MotiView
                    key={index}
                    from={{ opacity: 0, translateX: -20 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    transition={{ delay: index * 150 }}
                    style={styles.factItem}
                  >
                    <MaterialIcons name="lightbulb" size={16} color="#3b82f6" />
                    <Text style={styles.factText}>{fact}</Text>
                  </MotiView>
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
                <MotiView
                  key={index}
                  from={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 150 }}
                >
                  <BlurView intensity={20} tint="dark" style={styles.userStory}>
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
                </MotiView>
              ))}
            </View>
          )}
        </MotiView>
      </Animated.ScrollView>

      <BlurView intensity={30} tint="dark" style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.arButton}
          onPress={handleARView}
        >
          <MaterialIcons name="view-in-ar" size={24} color="#ffffff" />
          <Text style={styles.buttonText}>View in AR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.audioButton, playingAudio && styles.playingButton]}
          onPress={handleAudioNarration}
          disabled={playingAudio || (!details?.aiGeneratedStory && !aiStory)}
        >
          <MaterialIcons 
            name={playingAudio ? "pause" : "volume-up"} 
            size={24} 
            color="#ffffff" 
          />
          <Text style={styles.buttonText}>
            {playingAudio ? 'Playing Audio...' : 'Listen to Story'}
          </Text>
        </TouchableOpacity>
      </BlurView>

      <AnimatePresence>
        {expandedImage && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={styles.expandedImageContainer}
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
            </TouchableOpacity>
          </MotiView>
        )}
      </AnimatePresence>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerBlur: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  headerTitle: {
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
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
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
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
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
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 12,
    borderRadius: 12,
    gap: 12,
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
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
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
    borderRadius: 12,
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
    padding: 16,
    gap: 12,
  },
  arButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  audioButton: {
    backgroundColor: '#475569',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  playingButton: {
    backgroundColor: '#1e293b',
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
    backgroundColor: '#0f172a',
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
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  expandedImageContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
});

export default LocationDetailScreen;
