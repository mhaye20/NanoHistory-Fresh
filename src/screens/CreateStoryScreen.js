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
import { colors, typography, spacing, borderRadius, shadows } from '../theme/kawaii';

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
      style={styles.modalContainer}
    >
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Select Historical Location</Text>
        <ScrollView style={styles.locationsList}>
          {nearbyLocations.map((location) => (
            <TouchableOpacity
              key={location.id}
              style={styles.locationListItem}
              onPress={() => handleLocationSelect(location)}
            >
              <Text style={styles.locationListItemText}>{location.title}</Text>
            </TouchableOpacity>
          ))}
          {nearbyLocations.length === 0 && (
            <Text style={styles.noLocationsText}>
              No historical locations found nearby. Please get closer to a historical site to share your story.
            </Text>
          )}
        </ScrollView>
      </View>
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
          color={selectedLocation ? colors.accent : colors.text.secondary}
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
        color={colors.text.secondary}
      />
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.light,
      paddingHorizontal: spacing.medium,
    },
    keyboardAvoid: {
      flex: 1,
    },
    scrollContainer: {
      flexGrow: 1,
      paddingBottom: spacing.xlarge,
    },
    scrollContent: {
      padding: spacing.medium,
      gap: spacing.medium,
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.large,
      marginBottom: spacing.medium,
    },
    headerText: {
      fontSize: typography.sizes.xlarge,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
      marginLeft: spacing.small,
    },
    pointsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.accent + '20',
      borderWidth: 1,
      borderColor: colors.accent + '40',
    },
    pointsText: {
      color: colors.accent,
      fontSize: typography.sizes.small,
      fontWeight: typography.weights.semiBold,
      marginLeft: spacing.small,
    },
    inputContainer: {
      marginBottom: spacing.medium,
    },
    label: {
      fontSize: typography.sizes.small,
      color: colors.text.secondary,
      marginBottom: spacing.tiny,
    },
    input: {
      backgroundColor: colors.ui.input,
      borderColor: colors.ui.inputBorder,
      borderWidth: 1,
      borderRadius: borderRadius.medium,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.small,
      fontSize: typography.sizes.medium,
      color: colors.text.primary,
      ...shadows.soft,
    },
    titleInput: {
      fontSize: typography.sizes.large,
      fontWeight: typography.weights.medium,
    },
    storyInput: {
      minHeight: 120,
      textAlignVertical: 'top',
    },
    tagContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.medium,
    },
    tagInput: {
      flex: 1,
      marginRight: spacing.small,
    },
    tag: {
      backgroundColor: colors.tertiary,
      borderRadius: borderRadius.rounded,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tiny,
      marginRight: spacing.tiny,
      marginBottom: spacing.tiny,
      flexDirection: 'row',
      alignItems: 'center',
    },
    tagText: {
      color: colors.text.primary,
      fontSize: typography.sizes.small,
    },
    imagePickerContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.medium,
    },
    imagePickerButton: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      backgroundColor: colors.ui.input,
      borderRadius: borderRadius.medium,
      justifyContent: 'center',
      alignItems: 'center',
      margin: spacing.tiny,
      ...shadows.cute,
    },
    selectedImage: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: borderRadius.medium,
      margin: spacing.tiny,
    },
    locationContainer: {
      backgroundColor: colors.background.mint,
      borderRadius: borderRadius.medium,
      padding: spacing.medium,
      marginBottom: spacing.medium,
      ...shadows.pastel,
    },
    locationText: {
      fontSize: typography.sizes.medium,
      color: colors.text.primary,
    },
    locationSubtext: {
      fontSize: typography.sizes.small,
      color: colors.text.secondary,
    },
    submitButton: {
      backgroundColor: colors.ui.button,
      borderRadius: borderRadius.medium,
      paddingVertical: spacing.medium,
      alignItems: 'center',
      marginTop: spacing.large,
      ...shadows.floating,
    },
    submitButtonText: {
      color: colors.ui.buttonText,
      fontSize: typography.sizes.large,
      fontWeight: typography.weights.bold,
    },
    loadingIndicator: {
      marginTop: spacing.medium,
    },
    errorText: {
      color: colors.ui.error,
      fontSize: typography.sizes.small,
      marginTop: spacing.tiny,
    },
    aiSuggestionsContainer: {
      backgroundColor: colors.background.mint,
      borderRadius: borderRadius.medium,
      padding: spacing.medium,
      marginTop: spacing.medium,
      ...shadows.dreamy,
    },
    aiSuggestionsTitle: {
      fontSize: typography.sizes.medium,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
      marginBottom: spacing.small,
    },
    accuracyContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.small,
    },
    accuracyText: {
      fontSize: typography.sizes.small,
      color: colors.text.secondary,
      marginLeft: spacing.tiny,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.ui.card,
      borderTopLeftRadius: borderRadius.large,
      borderTopRightRadius: borderRadius.large,
      padding: spacing.large,
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: typography.sizes.large,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
      marginBottom: spacing.medium,
      textAlign: 'center',
    },
    locationListItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.small,
      borderBottomWidth: 1,
      borderBottomColor: colors.ui.inputBorder,
    },
    locationListItemText: {
      fontSize: typography.sizes.medium,
      color: colors.text.primary,
      marginLeft: spacing.small,
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.ui.card,
      borderRadius: borderRadius.medium,
      padding: spacing.small,
      marginTop: spacing.small,
    },
    locationButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    locationButtonText: {
      fontSize: typography.sizes.small,
      color: colors.text.secondary,
    },
    locationButtonTextSelected: {
      color: colors.accent,
      fontWeight: typography.weights.semiBold,
    },
    analyzeButton: {
      borderRadius: borderRadius.medium,
      overflow: 'hidden',
      marginVertical: spacing.small,
    },
    analyzeGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.medium,
      gap: spacing.small,
    },
    analyzeButtonText: {
      color: colors.text.primary,
      fontSize: typography.sizes.small,
      fontWeight: typography.weights.semiBold,
    },
    analyzingContainer: {
      alignItems: 'center',
      padding: spacing.large,
    },
    analyzingText: {
      color: colors.text.primary,
      fontSize: typography.sizes.small,
      marginTop: spacing.small,
    },
    improvementsList: {
      marginTop: spacing.small,
    },
    improvementItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.small,
      backgroundColor: colors.ui.card,
      padding: spacing.small,
      borderRadius: borderRadius.medium,
    },
    improvementItemTitle: {
      fontSize: typography.sizes.small,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
      marginBottom: spacing.small,
    },
    improvementText: {
      color: colors.text.primary,
      fontSize: typography.sizes.small,
      marginLeft: spacing.small,
      flex: 1,
    },
    suggestedTags: {
      marginTop: spacing.small,
    },
    suggestedTagsTitle: {
      fontSize: typography.sizes.small,
      fontWeight: typography.weights.bold,
      color: colors.text.primary,
      marginBottom: spacing.small,
    },
    tagsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
    },
    suggestedTag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.ui.card,
      borderRadius: borderRadius.medium,
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.small,
      marginRight: spacing.tiny,
      marginBottom: spacing.tiny,
    },
    suggestedTagText: {
      color: colors.accent,
      fontSize: typography.sizes.small,
      marginLeft: spacing.small,
    },
    imagesContainer: {
      borderRadius: borderRadius.medium,
      padding: spacing.medium,
      backgroundColor: colors.ui.card,
      borderWidth: 1,
      borderColor: colors.ui.inputBorder,
    },
    sectionTitle: {
      fontSize: typography.sizes.small,
      fontWeight: typography.weights.semiBold,
      color: colors.text.primary,
      marginBottom: spacing.small,
    },
    imageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
    },
    imageWrapper: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      borderRadius: borderRadius.medium,
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    removeImage: {
      position: 'absolute',
      top: spacing.small,
      right: spacing.small,
    },
    removeImageGradient: {
      borderRadius: borderRadius.medium,
      padding: spacing.small,
    },
    addImage: {
      width: IMAGE_SIZE,
      height: IMAGE_SIZE,
      backgroundColor: colors.ui.card,
      borderRadius: borderRadius.medium,
      borderWidth: 2,
      borderColor: colors.accent,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
    },
    addImageText: {
      color: colors.accent,
      fontSize: typography.sizes.small,
      fontWeight: typography.weights.semiBold,
      marginTop: spacing.small,
    },
    tagsContainer: {
      borderRadius: borderRadius.medium,
      padding: spacing.medium,
      backgroundColor: colors.ui.card,
      borderWidth: 1,
      borderColor: colors.ui.inputBorder,
    },
    tagInput: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.ui.card,
      borderRadius: borderRadius.medium,
      marginBottom: spacing.small,
    },
    tagTextInput: {
      flex: 1,
      padding: spacing.small,
      color: colors.text.primary,
      fontSize: typography.sizes.small,
    },
    addTagButton: {
      padding: spacing.small,
    },
    addTagButtonDisabled: {
      opacity: 0.5,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.tertiary,
      borderRadius: borderRadius.rounded,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tiny,
      marginRight: spacing.tiny,
      marginBottom: spacing.tiny,
      borderWidth: 1,
      borderColor: colors.accent + '30',
    },
    tagText: {
      color: colors.accent,
      fontSize: typography.sizes.small,
      marginRight: spacing.small,
    },
    removeTag: {
      padding: spacing.small,
    },
    footer: {
      padding: spacing.medium,
      borderTopWidth: 1,
      borderTopColor: colors.accent + '10',
      backgroundColor: colors.background.light,
    },
    submitButton: {
      borderRadius: borderRadius.medium,
      overflow: 'hidden',
    },
    submitButtonText: {
      color: colors.text.primary,
      fontSize: typography.sizes.medium,
      fontWeight: typography.weights.bold,
    },
    submitGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.medium,
      gap: spacing.small,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
  });

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerContainer}>
              <Text style={styles.headerText}>Share Your Story</Text>
              <View style={styles.pointsContainer}>
                <MaterialIcons name="stars" size={24} color={colors.accent} />
                <Text style={styles.pointsText}>
                  {points} points
                </Text>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.titleInput
                ]}
                placeholder="Give your story a title..."
                placeholderTextColor={colors.text.secondary}
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  calculatePoints();
                }}
                maxLength={100}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Story</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.storyInput
                ]}
                placeholder="Share your historical discovery or local story..."
                placeholderTextColor={colors.text.secondary}
                value={story}
                onChangeText={(text) => {
                  setStory(text);
                  calculatePoints();
                }}
                multiline
                maxLength={2000}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Location</Text>
              <LocationButton />
            </View>

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
                <ActivityIndicator color={colors.accent} size="large" />
                <Text style={styles.analyzingText}>
                  Analyzing your story...
                </Text>
              </View>
            )}

            {aiSuggestions && (
              <View style={styles.aiSuggestionsContainer}>
                <Text style={styles.aiSuggestionsTitle}>AI Suggestions</Text>
                <View style={styles.accuracyContainer}>
                  <Text style={styles.accuracyText}>Historical Accuracy: {Math.round(aiSuggestions.historicalAccuracy * 100)}%</Text>
                </View>
                <View style={styles.improvementsList}>
                  <Text style={styles.improvementItemTitle}>Suggested Improvements</Text>
                  {aiSuggestions.improvements.map((improvement, index) => (
                    <View key={index} style={styles.improvementItem}>
                      <MaterialIcons name="lightbulb" size={20} color={colors.accent} />
                      <Text style={styles.improvementText}>{improvement}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.suggestedTags}>
                  <Text style={styles.suggestedTagsTitle}>Suggested Tags</Text>
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
                        <MaterialIcons name="add" size={20} color={colors.accent} />
                        <Text style={styles.suggestedTagText}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            <View style={styles.imagesContainer}>
              <Text style={styles.sectionTitle}>Photos</Text>
              <View style={styles.imagePickerContainer}>
                {images.map((uri, index) => (
                  <Image
                    key={index}
                    source={{ uri }}
                    style={styles.selectedImage}
                  />
                ))}
                {images.length < 5 && (
                  <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                    <MaterialIcons name="add-photo-alternate" size={32} color={colors.accent} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.tagsContainer}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagInput}>
                <TextInput
                  style={[
                    styles.input,
                    styles.tagInput
                  ]}
                  placeholder="Add tags (e.g., architecture, 1800s)..."
                  placeholderTextColor={colors.text.secondary}
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
                    color={tagInput.trim() ? colors.accent : colors.text.secondary}
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
                      <MaterialIcons name="close" size={16} color={colors.text.secondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
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
    </View>
  );
};

export default CreateStoryScreen;
