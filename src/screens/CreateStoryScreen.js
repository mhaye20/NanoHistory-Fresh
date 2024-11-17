import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { submitUserContent } from '../services/ai';

const CreateStoryScreen = ({ navigation }) => {
  const [story, setStory] = useState('');
  const [title, setTitle] = useState('');
  const [images, setImages] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [points, setPoints] = useState(0);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  
  const scrollViewRef = useRef(null);
  const pointsAnim = useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme();

  useEffect(() => {
    requestPermissions();
    getCurrentLocation();
  }, []);

  useEffect(() => {
    // Animate points change
    Animated.spring(pointsAnim, {
      toValue: points,
      useNativeDriver: true,
      friction: 7,
      tension: 40,
    }).start();
  }, [points]);

  const requestPermissions = async () => {
    try {
      const [imagePermission, locationPermission] = await Promise.all([
        ImagePicker.requestMediaLibraryPermissionsAsync(),
        Location.requestForegroundPermissionsAsync(),
      ]);

      if (!imagePermission.granted || !locationPermission.granted) {
        Alert.alert(
          'Permissions Required',
          'Please grant camera and location permissions to share your story.'
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(location);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please try again.'
      );
    }
  };

  const pickImage = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit Reached', 'You can only add up to 5 images.');
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImages([...images, result.assets[0].uri]);
        calculatePoints();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
    calculatePoints();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    if (tags.length >= 5) {
      Alert.alert('Limit Reached', 'You can only add up to 5 tags.');
      return;
    }
    if (!tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      calculatePoints();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setTagInput('');
  };

  const removeTag = (index) => {
    setTags(tags.filter((_, i) => i !== index));
    calculatePoints();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const calculatePoints = () => {
    let totalPoints = 0;
    
    // Base points for story length
    totalPoints += Math.min(Math.floor(story.length / 50), 20) * 5;
    
    // Points for quality content
    if (story.length > 200) totalPoints += 20;
    if (story.includes('historical') || story.includes('history')) totalPoints += 10;
    
    // Points for media
    totalPoints += images.length * 15;
    
    // Points for metadata
    totalPoints += tags.length * 10;
    if (title.length > 0) totalPoints += 15;
    
    // Bonus points for accuracy
    totalPoints += Math.floor(accuracy * 50);
    
    setPoints(totalPoints);
  };

  const analyzeContent = async () => {
    if (!story.trim()) return;
    
    setIsAnalyzing(true);
    try {
      // Simulate AI analysis
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const suggestions = {
        historicalAccuracy: 0.85,
        suggestedTags: ['architecture', '19th-century', 'local-history'],
        improvements: [
          'Consider adding the specific year or time period',
          'Mention any architectural details you observed',
          'Include any known historical figures connected to this location',
        ],
        relatedStories: [
          {
            title: 'The Great Fire of 1892',
            relevance: 0.75,
          },
          {
            title: 'Victorian Era Architecture',
            relevance: 0.82,
          },
        ],
      };
      
      setAiSuggestions(suggestions);
      setAccuracy(suggestions.historicalAccuracy);
      calculatePoints();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error analyzing content:', error);
      Alert.alert('Error', 'Failed to analyze content. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !story.trim()) {
      Alert.alert('Missing Information', 'Please provide a title and story.');
      return;
    }

    if (!currentLocation) {
      await getCurrentLocation();
    }

    setLoading(true);

    try {
      const content = {
        locationId: currentLocation ? `${currentLocation.coords.latitude},${currentLocation.coords.longitude}` : null,
        userId: 'user123', // TODO: Get from auth
        contentType: 'story',
        title: title.trim(),
        text: story.trim(),
        media: images,
        tags,
        accuracy,
        aiSuggestions,
      };

      await submitUserContent(content);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success!',
        `Story submitted successfully! You earned ${points} points.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting story:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        'Failed to submit your story. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[
      styles.container,
      colorScheme === 'dark' && styles.containerDark
    ]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.header}>
            <Text style={[
              styles.title,
              colorScheme === 'dark' && styles.titleDark
            ]}>
              Share Your Story
            </Text>
            <View style={styles.pointsContainer}>
              <MaterialIcons name="stars" size={24} color="#fbbf24" />
              <Animated.Text style={styles.pointsText}>
                {points} points
              </Animated.Text>
            </View>
          </View>

          <TextInput
            style={[
              styles.titleInput,
              colorScheme === 'dark' && styles.titleInputDark
            ]}
            placeholder="Give your story a title..."
            placeholderTextColor="#64748b"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              calculatePoints();
            }}
            maxLength={100}
          />

          <TextInput
            style={[
              styles.storyInput,
              colorScheme === 'dark' && styles.storyInputDark
            ]}
            placeholder="Share your historical discovery or local story..."
            placeholderTextColor="#64748b"
            value={story}
            onChangeText={(text) => {
              setStory(text);
              calculatePoints();
            }}
            multiline
            maxLength={2000}
          />

          {story.length > 50 && !isAnalyzing && !aiSuggestions && (
            <TouchableOpacity
              style={styles.analyzeButton}
              onPress={analyzeContent}
            >
              <MaterialIcons name="psychology" size={24} color="#ffffff" />
              <Text style={styles.analyzeButtonText}>
                Analyze with AI
              </Text>
            </TouchableOpacity>
          )}

          {isAnalyzing && (
            <View style={styles.analyzingContainer}>
              <ActivityIndicator color="#3b82f6" size="large" />
              <Text style={[
                styles.analyzingText,
                colorScheme === 'dark' && styles.analyzingTextDark
              ]}>
                Analyzing your story...
              </Text>
            </View>
          )}

          {aiSuggestions && (
            <View style={styles.suggestionsContainer}>
              <View style={styles.accuracyContainer}>
                <Text style={styles.accuracyLabel}>Historical Accuracy</Text>
                <View style={styles.accuracyBar}>
                  <View
                    style={[
                      styles.accuracyFill,
                      { width: `${aiSuggestions.historicalAccuracy * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.accuracyValue}>
                  {Math.round(aiSuggestions.historicalAccuracy * 100)}%
                </Text>
              </View>

              <View style={styles.improvementsList}>
                <Text style={[
                  styles.suggestionsTitle,
                  colorScheme === 'dark' && styles.suggestionsTitleDark
                ]}>
                  Suggested Improvements
                </Text>
                {aiSuggestions.improvements.map((improvement, index) => (
                  <View key={index} style={styles.improvementItem}>
                    <MaterialIcons name="lightbulb" size={20} color="#3b82f6" />
                    <Text style={[
                      styles.improvementText,
                      colorScheme === 'dark' && styles.improvementTextDark
                    ]}>
                      {improvement}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.suggestedTags}>
                <Text style={[
                  styles.suggestionsTitle,
                  colorScheme === 'dark' && styles.suggestionsTitleDark
                ]}>
                  Suggested Tags
                </Text>
                <View style={styles.tagsList}>
                  {aiSuggestions.suggestedTags.map((tag, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestedTag}
                      onPress={() => {
                        if (!tags.includes(tag)) {
                          setTags([...tags, tag]);
                          calculatePoints();
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                      }}
                    >
                      <MaterialIcons name="add" size={20} color="#3b82f6" />
                      <Text style={styles.suggestedTagText}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {aiSuggestions.relatedStories.length > 0 && (
                <View style={styles.relatedStories}>
                  <Text style={[
                    styles.suggestionsTitle,
                    colorScheme === 'dark' && styles.suggestionsTitleDark
                  ]}>
                    Related Stories
                  </Text>
                  {aiSuggestions.relatedStories.map((relatedStory, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.relatedStoryItem}
                      onPress={() => {
                        // TODO: Navigate to related story
                      }}
                    >
                      <MaterialIcons name="history-edu" size={20} color="#3b82f6" />
                      <Text style={[
                        styles.relatedStoryText,
                        colorScheme === 'dark' && styles.relatedStoryTextDark
                      ]}>
                        {relatedStory.title}
                      </Text>
                      <Text style={styles.relevanceText}>
                        {Math.round(relatedStory.relevance * 100)}% match
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.imagesContainer}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeImage}
                  onPress={() => removeImage(index)}
                >
                  <MaterialIcons name="close" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 5 && (
              <TouchableOpacity style={styles.addImage} onPress={pickImage}>
                <MaterialIcons name="add-photo-alternate" size={32} color="#3b82f6" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.tagsContainer}>
            <View style={styles.tagInput}>
              <TextInput
                style={[
                  styles.tagTextInput,
                  colorScheme === 'dark' && styles.tagTextInputDark
                ]}
                placeholder="Add tags (e.g., architecture, 1800s)..."
                placeholderTextColor="#64748b"
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                maxLength={20}
              />
              <TouchableOpacity
                style={styles.addTagButton}
                onPress={addTag}
                disabled={!tagInput.trim()}
              >
                <MaterialIcons
                  name="add"
                  size={24}
                  color={tagInput.trim() ? '#3b82f6' : '#64748b'}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.tags}>
              {tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                  <TouchableOpacity
                    onPress={() => removeTag(index)}
                    style={styles.removeTag}
                  >
                    <MaterialIcons name="close" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={[
          styles.footer,
          colorScheme === 'dark' && styles.footerDark
        ]}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              loading && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={loading || !title.trim() || !story.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <MaterialIcons name="send" size={24} color="#ffffff" />
                <Text style={styles.submitButtonText}>Share Story</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  containerDark: {
    backgroundColor: '#0f172a',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  titleDark: {
    color: '#ffffff',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pointsText: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  titleInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    color: '#0f172a',
    fontSize: 18,
    marginBottom: 16,
  },
  titleInputDark: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
  },
  storyInput: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    color: '#0f172a',
    fontSize: 16,
    minHeight: 200,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  storyInputDark: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  analyzeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  analyzingContainer: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
  },
  analyzingText: {
    color: '#0f172a',
    fontSize: 16,
    marginTop: 8,
  },
  analyzingTextDark: {
    color: '#e2e8f0',
  },
  suggestionsContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  accuracyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  accuracyLabel: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  accuracyBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  accuracyFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  accuracyValue: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  improvementsList: {
    marginBottom: 16,
  },
  suggestionsTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  suggestionsTitleDark: {
    color: '#e2e8f0',
  },
  improvementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  improvementText: {
    color: '#0f172a',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  improvementTextDark: {
    color: '#e2e8f0',
  },
  suggestedTags: {
    marginBottom: 16,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  suggestedTagText: {
    color: '#3b82f6',
    fontSize: 14,
    marginLeft: 4,
  },
  relatedStories: {
    marginTop: 8,
  },
  relatedStoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  relatedStoryText: {
    color: '#0f172a',
    fontSize: 14,
    flex: 1,
    marginLeft: 8,
  },
  relatedStoryTextDark: {
    color: '#e2e8f0',
  },
  relevanceText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '500',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeImage: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 4,
  },
  addImage: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagsContainer: {
    marginBottom: 16,
  },
  tagInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    marginBottom: 8,
  },
  tagTextInput: {
    flex: 1,
    padding: 12,
    color: '#0f172a',
    fontSize: 16,
  },
  tagTextInputDark: {
    color: '#ffffff',
  },
  addTagButton: {
    padding: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tagText: {
    color: '#3b82f6',
    fontSize: 14,
    marginRight: 4,
  },
  removeTag: {
    padding: 2,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  footerDark: {
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default CreateStoryScreen;
