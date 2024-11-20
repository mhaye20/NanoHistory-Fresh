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
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { createStory, supabase } from '../services/supabase';

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
  const pointsAnim = useRef(new Animated.Value(0)).current;
  const colorScheme = useColorScheme();

  useEffect(() => {
    checkAuth();
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

  // Rest of the component remains exactly the same...
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

    if (!currentLocation) {
      Alert.alert('Location Required', 'Unable to get your location. Please enable location services and try again.');
      return;
    }

    // Check if user is still authenticated
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (!session) {
      navigation.navigate('Auth');
      return;
    }

    setLoading(true);

    try {
      // Create story data
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

      // Create the story in Supabase
      const createdStory = await createStory(storyData);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success!',
        `Story submitted successfully! You earned ${points} points.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Pass refresh parameter when navigating back
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
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 600 }}
              style={styles.header}
            >
              <Text style={[
                styles.title,
                colorScheme === 'dark' && styles.titleDark
              ]}>
                Share Your Story
              </Text>
              <BlurView 
                intensity={20} 
                tint={colorScheme} 
                style={styles.pointsContainer}
              >
                <MaterialIcons name="stars" size={24} color="#fbbf24" />
                <Animated.Text style={styles.pointsText}>
                  {points} points
                </Animated.Text>
              </BlurView>
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 600, delay: 100 }}
            >
              <BlurView
                intensity={20}
                tint={colorScheme}
                style={styles.formContainer}
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
              </BlurView>
            </MotiView>

            <AnimatePresence>
              {story.length > 50 && !isAnalyzing && !aiSuggestions && (
                <MotiView
                  from={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  style={styles.analyzeButtonContainer}
                >
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
                </MotiView>
              )}
            </AnimatePresence>

            {isAnalyzing && (
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={styles.analyzingContainer}
              >
                <ActivityIndicator color="#3b82f6" size="large" />
                <Text style={[
                  styles.analyzingText,
                  colorScheme === 'dark' && styles.analyzingTextDark
                ]}>
                  Analyzing your story...
                </Text>
              </MotiView>
            )}

            <AnimatePresence>
              {aiSuggestions && (
                <MotiView
                  from={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <BlurView
                    intensity={20}
                    tint={colorScheme}
                    style={styles.suggestionsContainer}
                  >
                    <View style={styles.accuracyContainer}>
                      <Text style={styles.accuracyLabel}>Historical Accuracy</Text>
                      <View style={styles.accuracyBar}>
                        <MotiView
                          from={{ width: '0%' }}
                          animate={{ width: `${aiSuggestions.historicalAccuracy * 100}%` }}
                          transition={{ type: 'timing', duration: 1000 }}
                          style={styles.accuracyFill}
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
                        <MotiView
                          key={index}
                          from={{ opacity: 0, translateX: -20 }}
                          animate={{ opacity: 1, translateX: 0 }}
                          transition={{ delay: index * 150 }}
                          style={styles.improvementItem}
                        >
                          <MaterialIcons name="lightbulb" size={20} color="#3b82f6" />
                          <Text style={[
                            styles.improvementText,
                            colorScheme === 'dark' && styles.improvementTextDark
                          ]}>
                            {improvement}
                          </Text>
                        </MotiView>
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
                          <MotiView
                            key={index}
                            from={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 100 }}
                          >
                            <TouchableOpacity
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
                          </MotiView>
                        ))}
                      </View>
                    </View>
                  </BlurView>
                </MotiView>
              )}
            </AnimatePresence>

            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 600, delay: 200 }}
            >
              <BlurView
                intensity={20}
                tint={colorScheme}
                style={styles.imagesContainer}
              >
                <Text style={[
                  styles.sectionTitle,
                  colorScheme === 'dark' && styles.sectionTitleDark
                ]}>
                  Photos
                </Text>
                <View style={styles.imageGrid}>
                  {images.map((uri, index) => (
                    <MotiView
                      key={index}
                      from={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', delay: index * 100 }}
                      style={styles.imageWrapper}
                    >
                      <Image source={{ uri }} style={styles.image} />
                      <TouchableOpacity
                        style={styles.removeImage}
                        onPress={() => removeImage(index)}
                      >
                        <BlurView intensity={80} tint="dark" style={styles.removeImageBlur}>
                          <MaterialIcons name="close" size={20} color="#ffffff" />
                        </BlurView>
                      </TouchableOpacity>
                    </MotiView>
                  ))}
                  {images.length < 5 && (
                    <TouchableOpacity style={styles.addImage} onPress={pickImage}>
                      <MaterialIcons name="add-photo-alternate" size={32} color="#3b82f6" />
                      <Text style={styles.addImageText}>Add Photo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </BlurView>

              <BlurView
                intensity={20}
                tint={colorScheme}
                style={styles.tagsContainer}
              >
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
                    <MotiView
                      key={index}
                      from={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', delay: index * 50 }}
                    >
                      <BlurView
                        intensity={20}
                        tint={colorScheme}
                        style={styles.tag}
                      >
                        <Text style={styles.tagText}>{tag}</Text>
                        <TouchableOpacity
                          onPress={() => removeTag(index)}
                          style={styles.removeTag}
                        >
                          <MaterialIcons name="close" size={16} color="#64748b" />
                        </TouchableOpacity>
                      </BlurView>
                    </MotiView>
                  ))}
                </View>
              </BlurView>
            </MotiView>
          </ScrollView>

          <BlurView
            intensity={30}
            tint={colorScheme}
            style={[
              styles.footer,
              colorScheme === 'dark' && styles.footerDark
            ]}
          >
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
          </BlurView>
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleInput: {
    fontSize: 20,
    color: '#0f172a',
    fontWeight: '600',
  },
  titleInputDark: {
    color: '#ffffff',
  },
  storyInput: {
    fontSize: 16,
    color: '#0f172a',
    minHeight: 200,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  storyInputDark: {
    color: '#ffffff',
  },
  analyzeButtonContainer: {
    marginVertical: 8,
  },
  analyzeButton: {
    borderRadius: 16,
    overflow: 'hidden',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  sectionTitleDark: {
    color: '#ffffff',
  },
  imagesContainer: {
    borderRadius: 20,
    padding: 16,
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
  removeImageBlur: {
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
  },
  footerDark: {
    borderTopColor: 'rgba(30, 41, 59, 0.5)',
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
