import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { createStory, uploadImage } from '../services/supabase';
import { generateHistoricalStory } from '../services/ai';

const CreateStoryScreen = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [period, setPeriod] = useState('');
  const [image, setImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to add your story.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLocation(location.coords);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get location. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!title || !description || !location) {
      Alert.alert('Missing Information', 'Please fill in all required fields and add a location.');
      return;
    }

    setLoading(true);

    try {
      let imageUrl = null;
      if (image) {
        const fileName = `${Date.now()}-story-image.jpg`;
        const response = await fetch(image);
        const blob = await response.blob();
        const { data: uploadData, error: uploadError } = await uploadImage(fileName, blob);
        
        if (uploadError) throw uploadError;
        imageUrl = uploadData.path;
      }

      // Generate AI-enhanced content
      const aiContent = await generateHistoricalStory({
        title,
        description,
        period,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
      });

      const storyData = {
        title,
        description: aiContent ? aiContent.story : description,
        period,
        image_url: imageUrl,
        latitude: location.latitude,
        longitude: location.longitude,
        ai_generated_facts: aiContent ? aiContent.facts : [],
        status: 'pending',
      };

      const { data: story, error } = await createStory(storyData);
      if (error) throw error;

      Alert.alert(
        'Success',
        'Your story has been submitted for review!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error creating story:', error);
      Alert.alert('Error', 'Failed to submit story. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Share Your Historical Story</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter story title"
            placeholderTextColor="#64748b"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Tell your story..."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={6}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Historical Period</Text>
          <TextInput
            style={styles.input}
            value={period}
            onChangeText={setPeriod}
            placeholder="e.g., Victorian Era, 1960s"
            placeholderTextColor="#64748b"
          />
        </View>

        <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
          <Text style={styles.buttonText}>
            {image ? 'Change Image' : 'Add Image'}
          </Text>
        </TouchableOpacity>

        {image && (
          <Image source={{ uri: image }} style={styles.previewImage} />
        )}

        <TouchableOpacity 
          style={[styles.locationButton, location && styles.locationActive]}
          onPress={getCurrentLocation}
        >
          <Text style={styles.buttonText}>
            {location ? 'Location Added ✓' : 'Add Current Location'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Story</Text>
          )}
        </TouchableOpacity>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  imageButton: {
    backgroundColor: '#475569',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationButton: {
    backgroundColor: '#475569',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  locationActive: {
    backgroundColor: '#059669',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#64748b',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default CreateStoryScreen;