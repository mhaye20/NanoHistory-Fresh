import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getLocationDetails } from '../services/supabase';
import { generateHistoricalStory, generateVoice } from '../services/ai';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_WIDTH * 0.75; // 4:3 aspect ratio

const LocationDetailScreen = ({ route, navigation }) => {
  const { location } = route.params;
  const [details, setDetails] = useState(null);
  const [aiStory, setAiStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playingAudio, setPlayingAudio] = useState(false);

  useEffect(() => {
    fetchLocationDetails();
  }, []);

  const fetchLocationDetails = async () => {
    try {
      const locationDetails = await getLocationDetails(location.id);
      setDetails(locationDetails);
      
      if (!locationDetails.aiGeneratedStory) {
        // Generate AI story if it doesn't exist
        const story = await generateHistoricalStory(locationDetails);
        setAiStory(story);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching location details:', err);
      setError('Failed to load location details');
      setLoading(false);
    }
  };

  const handleARView = () => {
    navigation.navigate('ARView', { location: details });
  };

  const handleAudioNarration = async () => {
    const storyToNarrate = details?.aiGeneratedStory?.story || aiStory?.story;
    if (!storyToNarrate) return;

    try {
      setPlayingAudio(true);
      const audioBlob = await generateVoice(storyToNarrate);
      // Audio playback logic would go here
      setPlayingAudio(false);
    } catch (err) {
      console.error('Error generating audio:', err);
      setPlayingAudio(false);
    }
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
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchLocationDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Get the image URL from either the cached story or newly generated story
  const storyImageUrl = details?.aiGeneratedStory?.imageUrl || aiStory?.imageUrl;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>{details?.title}</Text>
          <Text style={styles.period}>{details?.period}</Text>
        </View>

        {/* AI Generated Story */}
        {(details?.aiGeneratedStory || aiStory) && (
          <View style={styles.storyContainer}>
            {storyImageUrl && (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: storyImageUrl }}
                  style={styles.storyMainImage}
                  resizeMode="cover"
                />
                <LinearGradient
                  colors={['rgba(15, 23, 42, 0)', 'rgba(15, 23, 42, 0.8)']}
                  style={styles.imageGradient}
                />
              </View>
            )}
            
            <View style={styles.storyHeader}>
              <MaterialIcons name="psychology" size={24} color="#3b82f6" />
              <Text style={styles.storyHeaderText}>AI Historical Insights</Text>
            </View>
            <Text style={styles.storyText}>
              {details?.aiGeneratedStory?.story || aiStory?.story}
            </Text>
            <View style={styles.factsList}>
              {(details?.aiGeneratedStory?.facts || aiStory?.facts || []).map((fact, index) => (
                <View key={index} style={styles.factItem}>
                  <MaterialIcons name="lightbulb" size={16} color="#3b82f6" />
                  <Text style={styles.factText}>{fact}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* User Stories */}
        {details?.userStories && details.userStories.length > 0 && (
          <View style={styles.userStoriesContainer}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="history-edu" size={24} color="#10b981" />
              <Text style={styles.sectionHeaderText}>Community Stories</Text>
            </View>
            {details.userStories.map((story, index) => (
              <View key={index} style={styles.userStory}>
                <Text style={styles.userStoryTitle}>{story.title}</Text>
                <Text style={styles.userStoryContent}>{story.content}</Text>
                {story.media_urls && story.media_urls.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
                    {story.media_urls.map((url, mediaIndex) => (
                      <Image
                        key={mediaIndex}
                        source={{ uri: url }}
                        style={styles.storyImage}
                      />
                    ))}
                  </ScrollView>
                )}
                {story.tags && story.tags.length > 0 && (
                  <View style={styles.tagsContainer}>
                    {story.tags.map((tag, tagIndex) => (
                      <View key={tagIndex} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.buttonContainer}>
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
            <MaterialIcons name={playingAudio ? "pause" : "volume-up"} size={24} color="#ffffff" />
            <Text style={styles.buttonText}>
              {playingAudio ? 'Playing Audio...' : 'Listen to Story'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  period: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 16,
  },
  imageContainer: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  storyMainImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  storyContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  storyHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3b82f6',
    marginLeft: 8,
  },
  storyText: {
    fontSize: 16,
    color: '#e2e8f0',
    lineHeight: 24,
    marginBottom: 16,
  },
  factsList: {
    marginTop: 16,
    gap: 12,
  },
  factItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  factText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    flex: 1,
  },
  userStoriesContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10b981',
    marginLeft: 8,
  },
  userStory: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  storyImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginRight: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  tagText: {
    color: '#10b981',
    fontSize: 14,
  },
  buttonContainer: {
    gap: 12,
  },
  arButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  audioButton: {
    backgroundColor: '#475569',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#94a3b8',
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
});

export default LocationDetailScreen;
