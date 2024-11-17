import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLocationDetails } from '../services/supabase';
import { generateHistoricalStory, generateVoice } from '../services/ai';

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
      
      // Generate AI story after getting location details
      const story = await generateHistoricalStory(locationDetails);
      setAiStory(story);
      
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
    if (!aiStory) return;

    try {
      setPlayingAudio(true);
      const audioBlob = await generateVoice(aiStory.story);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>{details?.title}</Text>
          <Text style={styles.period}>{details?.period}</Text>
        </View>

        {aiStory && (
          <View style={styles.storyContainer}>
            <Text style={styles.storyText}>{aiStory.story}</Text>
            <View style={styles.factsList}>
              {aiStory.facts.map((fact, index) => (
                <View key={index} style={styles.factItem}>
                  <Text style={styles.factText}>• {fact}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.arButton}
            onPress={handleARView}
          >
            <Text style={styles.buttonText}>View in AR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.audioButton, playingAudio && styles.playingButton]}
            onPress={handleAudioNarration}
            disabled={playingAudio || !aiStory}
          >
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
  storyContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  storyText: {
    fontSize: 16,
    color: '#e2e8f0',
    lineHeight: 24,
    marginBottom: 16,
  },
  factsList: {
    marginTop: 16,
  },
  factItem: {
    marginBottom: 8,
  },
  factText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 12,
  },
  arButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  audioButton: {
    backgroundColor: '#475569',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
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