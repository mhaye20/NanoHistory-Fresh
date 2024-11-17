import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
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

  const scrollViewRef = useRef(null);

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
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
    calculatePoints();
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
    }
    setTagInput('');
  };

  const removeTag = (index) => {
    setTags(tags.filter((_, i) => i !== index));
    calculatePoints();
  };

  const calculatePoints = () => {
    let totalPoints = 0;
    
    // Points for story length
    totalPoints += Math.min(Math.floor(story.length / 50), 20) * 5;
    
    // Points for images
    totalPoints += images.length * 10;
    
    // Points for tags
    totalPoints += tags.length * 5;
    
    // Points for title
    if (title.length > 0) totalPoints += 10;
    
    setPoints(totalPoints);
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
      };

      await submitUserContent(content);

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
      Alert.alert(
        'Error',
        'Failed to submit your story. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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
            <Text style={styles.title}>Share Your Story</Text>
            <View style={styles.pointsContainer}>
              <MaterialIcons name="stars" size={24} color="#fbbf24" />
              <Text style={styles.pointsText}>{points} points</Text>
            </View>
          </View>

          <TextInput
            style={styles.titleInput}
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
            style={styles.storyInput}
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
                style={styles.tagTextInput}
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

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
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
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 18,
    marginBottom: 16,
  },
  storyInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    minHeight: 200,
    textAlignVertical: 'top',
    marginBottom: 16,
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
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginBottom: 8,
  },
  tagTextInput: {
    flex: 1,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
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
    borderTopColor: '#1e293b',
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
    backgroundColor: '#475569',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default CreateStoryScreen;
