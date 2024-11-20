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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { createStory, supabase } from '../services/supabase';
import { awardPoints, POINT_VALUES } from '../services/points';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = (SCREEN_WIDTH - 48) / 3;

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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const accuracyAnim = useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme();

  useEffect(() => {
    checkAuth();
    requestPermissions();
    getCurrentLocation();

    // Initial animations
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
  }, []);

  useEffect(() => {
    if (aiSuggestions) {
      Animated.timing(accuracyAnim, {
        toValue: aiSuggestions.historicalAccuracy,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }
  }, [aiSuggestions]);

  // Keep all the existing functions (checkAuth, requestPermissions, getCurrentLocation, etc.)
  // but remove their implementation from this snippet to save space since they remain unchanged
  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!session) {
        navigation.navigate('Auth');
        return;
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      navigation.navigate('Auth');
    }
  };

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
    totalPoints += Math.min(Math.floor(story.length / 50), 20) * 5;
    if (story.length > 200) totalPoints += 20;
    if (story.includes('historical') || story.includes('history')) totalPoints += 10;
    totalPoints += images.length * 15;
    totalPoints += tags.length * 10;
    if (title.length > 0) totalPoints += 15;
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

    if (!currentLocation) {
      Alert.alert('Location Required', 'Unable to get your location. Please enable location services and try again.');
      return;
    }

    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (!session) {
      navigation.navigate('Auth');
      return;
    }

    setLoading(true);

    try {
      const storyData = {
        title: title.trim(),
        content: story.trim(),
        media_urls: images,
        tags: tags,
        accuracy_score: accuracy,
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        author_id: session.user.id
      };

      // Create the story
      const createdStory = await createStory(storyData);

      // Award points for sharing a story
      try {
        await awardPoints(session.user.id, 'STORY_SHARE', createdStory.location_id);
      } catch (pointsError) {
        console.error('Error awarding points:', pointsError);
        // Don't block the story submission if points fail
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success!',
        `Story submitted successfully! You earned ${POINT_VALUES.STORY_SHARE} points.`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('Explore', { refresh: true });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting story:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackStyle.Error);
      Alert.alert(
        'Error',
        'Failed to submit your story. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={colorScheme === 'dark' 
        ? ['#0f172a', '#1e293b']
        : ['#ffffff', '#f8fafc']
      }
      style={styles.container}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.header,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <Text style={[
                styles.title,
                colorScheme === 'dark' && styles.titleDark
              ]}>
                Share Your Story
              </Text>
              <View style={styles.pointsContainer}>
                <MaterialIcons name="stars" size={24} color="#fbbf24" />
                <Text style={styles.pointsText}>
                  {points} points
                </Text>
              </View>
            </Animated.View>

            <Animated.View
              style={[
                styles.formContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
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
            </Animated.View>

            {story.length > 50 && !isAnalyzing && !aiSuggestions && (
              <TouchableOpacity
                style={styles.analyzeButton}
                onPress={analyzeContent}
              >
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.analyzeGradient}
                >
                  <MaterialIcons name="psychology" size={24} color="#ffffff" />
                  <Text style={styles.analyzeButtonText}>
                    Analyze with AI
                  </Text>
                </LinearGradient>
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
                    <Animated.View
                      style={[
                        styles.accuracyFill,
                        {
                          width: accuracyAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%']
                          })
                        }
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
              </View>
            )}

            <View style={styles.imagesContainer}>
              <Text style={[
                styles.sectionTitle,
                colorScheme === 'dark' && styles.sectionTitleDark
              ]}>
                Photos
              </Text>
              <View style={styles.imageGrid}>
                {images.map((uri, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image source={{ uri }} style={styles.image} />
                    <TouchableOpacity
                      style={styles.removeImage}
                      onPress={() => removeImage(index)}
                    >
                      <LinearGradient
                        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.7)']}
                        style={styles.removeImageGradient}
                      >
                        <MaterialIcons name="close" size={20} color="#ffffff" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < 5 && (
                  <TouchableOpacity style={styles.addImage} onPress={pickImage}>
                    <MaterialIcons name="add-photo-alternate" size={32} color="#3b82f6" />
                    <Text style={styles.addImageText}>Add Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.tagsContainer}>
              <Text style={[
                styles.sectionTitle,
                colorScheme === 'dark' && styles.sectionTitleDark
              ]}>
                Tags
              </Text>
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
                  style={[
                    styles.addTagButton,
                    !tagInput.trim() && styles.addTagButtonDisabled
                  ]}
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
              <LinearGradient
                colors={loading ? ['#94a3b8', '#64748b'] : ['#3b82f6', '#2563eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={24} color="#ffffff" />
                    <Text style={styles.submitButtonText}>Share Story</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  titleDark: {
    color: '#ffffff',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  pointsText: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  formContainer: {
    borderRadius: 20,
    padding: 16,
    gap: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleInput: {
    fontSize: 20,
    color: '#0f172a',
    fontWeight: '600',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 12,
  },
  titleInputDark: {
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  storyInput: {
    fontSize: 16,
    color: '#0f172a',
    minHeight: 200,
    textAlignVertical: 'top',
    lineHeight: 24,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 12,
  },
  storyInputDark: {
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  analyzeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 8,
  },
  analyzeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  analyzeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  analyzingContainer: {
    alignItems: 'center',
    padding: 24,
  },
  analyzingText: {
    color: '#0f172a',
    fontSize: 16,
    marginTop: 12,
  },
  analyzingTextDark: {
    color: '#e2e8f0',
  },
  suggestionsContainer: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  accuracyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  accuracyLabel: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 12,
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
    borderRadius: 4,
  },
  accuracyValue: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  improvementsList: {
    marginTop: 16,
  },
  improvementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 12,
    borderRadius: 12,
  },
  improvementText: {
    color: '#0f172a',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  improvementTextDark: {
    color: '#e2e8f0',
  },
  suggestedTags: {
    marginTop: 16,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  suggestionsTitleDark: {
    color: '#e2e8f0',
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  suggestedTagText: {
    color: '#3b82f6',
    fontSize: 14,
    marginLeft: 4,
  },
  imagesContainer: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  imageWrapper: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeImage: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  removeImageGradient: {
    borderRadius: 12,
    padding: 4,
  },
  addImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  tagsContainer: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tagInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginBottom: 12,
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
  addTagButtonDisabled: {
    opacity: 0.5,
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
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
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
    borderTopColor: 'rgba(226, 232, 240, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  footerDark: {
    borderTopColor: 'rgba(30, 41, 59, 0.5)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default CreateStoryScreen;
