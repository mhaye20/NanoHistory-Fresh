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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { createStory, supabase, adminClient, getNearbyLocations } from '../services/supabase';
import { awardPoints, POINT_VALUES } from '../services/points';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = (SCREEN_WIDTH - 48) / 3;

const CreateStoryScreen = ({ route, navigation }) => {
  const [story, setStory] = useState('');
  const [title, setTitle] = useState('');
  const [images, setImages] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [points, setPoints] = useState(0);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [nearbyLocations, setNearbyLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(route.params?.location || null);
  const [showLocationSelect, setShowLocationSelect] = useState(false);
  
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
    if (!selectedLocation) {
      fetchNearbyLocations();
    }
  }, [currentLocation]);

  useEffect(() => {
    if (aiSuggestions) {
      Animated.timing(accuracyAnim, {
        toValue: aiSuggestions.historicalAccuracy,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }
  }, [aiSuggestions]);

  const fetchNearbyLocations = async () => {
    if (!currentLocation) return;

    try {
      const { locations } = await getNearbyLocations(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude,
        'all',
        100 // 100 meter radius
      );

      // Filter to only show locations with AI stories
      const historicLocations = locations.filter(loc => loc.aiGeneratedStory);
      setNearbyLocations(historicLocations);
    } catch (error) {
      console.error('Error fetching nearby locations:', error);
    }
  };

  const isWithinRange = (userLoc, targetLoc, rangeInMeters = 100) => {
    if (!userLoc || !targetLoc) return false;

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

  const handleLocationSelect = (location) => {
    if (!currentLocation) {
      Alert.alert('Location Required', 'Please enable location services to continue.');
      return;
    }

    if (!isWithinRange(currentLocation, location)) {
      Alert.alert(
        'Too Far Away',
        'You need to be at the historical site to share a story about it. Please get closer to the location.'
      );
      return;
    }

    setSelectedLocation(location);
    setShowLocationSelect(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

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

  const openSettings = async () => {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      console.error('Error opening settings:', error);
    }
  };

  const showLocationPermissionAlert = () => {
    Alert.alert(
      'Location Access Required',
      'TaleTrail needs your location to verify historical sites and award points. Please enable location access in Settings.',
      [
        { 
          text: 'Not Now',
          style: 'cancel',
          onPress: () => {
            Alert.alert(
              'Location Required',
              'You need to enable location services to share stories and earn points. You can enable this later in Settings.'
            );
          }
        },
        { 
          text: 'Open Settings',
          style: 'default',
          onPress: openSettings
        }
      ],
      { cancelable: false }
    );
  };

  const requestLocationPermission = async () => {
    try {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      
      if (existingStatus === 'granted') {
        return true;
      }

      if (existingStatus === 'denied' && Platform.OS === 'ios') {
        showLocationPermissionAlert();
        return false;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showLocationPermissionAlert();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  };

  const requestPermissions = async () => {
    try {
      const [imagePermission, locationGranted] = await Promise.all([
        ImagePicker.requestMediaLibraryPermissionsAsync(),
        requestLocationPermission(),
      ]);

      if (!imagePermission.granted) {
        Alert.alert(
          'Photo Library Access Required',
          'Please allow access to your photo library to share photos with your story.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openSettings }
          ]
        );
        return false;
      }

      return locationGranted;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  };

  const getCurrentLocation = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
      });
      setCurrentLocation(location);
      setUserLocation(location);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        'Location Required',
        'Unable to get your location. Please make sure location services are enabled and you have a clear view of the sky.',
        [
          { text: 'Try Again', onPress: getCurrentLocation },
          { text: 'Open Settings', onPress: openSettings }
        ]
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

    if (!selectedLocation) {
      Alert.alert('Location Required', 'Please select a historical location for your story.');
      return;
    }

    if (!isWithinRange(currentLocation, selectedLocation)) {
      Alert.alert(
        'Too Far Away',
        'You need to be at the historical site to share a story about it. Please get closer to the location.'
      );
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
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        author_id: session.user.id,
        location_id: selectedLocation.id
      };

      // Create the story
      const createdStory = await createStory(storyData);
      console.log('Created story:', createdStory);

      try {
        const pointsResult = await awardPoints(
          session.user.id,
          'STORY_SHARE',
          selectedLocation.id,
          currentLocation
        );
        
        console.log('Points awarded result:', pointsResult);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Success!',
          `Story submitted successfully! You earned ${POINT_VALUES.STORY_SHARE} points for sharing at this historic location.`,
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('Explore', { refresh: true });
              },
            },
          ]
        );
      } catch (pointsError) {
        console.error('Points error:', pointsError);
        Alert.alert(
          'Story Shared',
          'Your story was shared successfully, but there was an error awarding points.'
        );
        navigation.navigate('Explore', { refresh: true });
      }
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

  const LocationSelectModal = () => (
    <BlurView
      intensity={80}
      tint="dark"
      style={styles.locationSelectModal}
    >
      <View style={styles.locationSelectHeader}>
        <Text style={styles.locationSelectTitle}>Select Historical Location</Text>
        <TouchableOpacity
          onPress={() => setShowLocationSelect(false)}
          style={styles.closeButton}
        >
          <MaterialIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.locationsList}>
        {nearbyLocations.map((location) => (
          <TouchableOpacity
            key={location.id}
            style={styles.locationItem}
            onPress={() => handleLocationSelect(location)}
          >
            <View style={styles.locationInfo}>
              <Text style={styles.locationTitle}>{location.title}</Text>
              <Text style={styles.locationDistance}>
                {Math.round(location.distance)} meters away
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={24}
              color="#64748b"
            />
          </TouchableOpacity>
        ))}
        {nearbyLocations.length === 0 && (
          <Text style={styles.noLocationsText}>
            No historical locations found nearby. Please get closer to a historical site to share your story.
          </Text>
        )}
      </ScrollView>
    </BlurView>
  );

  const LocationButton = () => (
    <TouchableOpacity
      style={styles.locationButton}
      onPress={() => setShowLocationSelect(true)}
    >
      <View style={styles.locationButtonContent}>
        <MaterialIcons
          name="location-on"
          size={24}
          color={selectedLocation ? '#10b981' : '#64748b'}
        />
        <Text style={[
          styles.locationButtonText,
          selectedLocation && styles.locationButtonTextSelected
        ]}>
          {selectedLocation ? selectedLocation.title : 'Select Historical Location'}
        </Text>
      </View>
      <MaterialIcons
        name="chevron-right"
        size={24}
        color="#64748b"
      />
    </TouchableOpacity>
  );

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

              <LocationButton />

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
      {showLocationSelect && <LocationSelectModal />}
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
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  locationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationButtonText: {
    fontSize: 16,
    color: '#64748b',
  },
  locationButtonTextSelected: {
    color: '#10b981',
    fontWeight: '600',
  },
  locationSelectModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
  },
  locationSelectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  locationSelectTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  closeButton: {
    padding: 8,
  },
  locationsList: {
    flex: 1,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginBottom: 12,
  },
  locationInfo: {
    flex: 1,
    marginRight: 12,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  locationDistance: {
    fontSize: 14,
    color: '#64748b',
  },
  noLocationsText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 20,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  sectionTitleDark: {
    color: '#ffffff',
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
