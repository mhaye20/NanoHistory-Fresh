import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { getAIResponse, generateVoice } from '../services/ai';
import * as Speech from 'expo-speech';

const Message = ({ message, onAudioPlay }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleAudioPress = async () => {
    if (isPlaying) {
      await Speech.stop();
    } else {
      await Speech.speak(message.text, {
        language: 'en',
        pitch: 1.0,
        rate: 0.9,
        onStart: () => setIsPlaying(true),
        onDone: () => setIsPlaying(false),
        onError: () => setIsPlaying(false),
      });
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <Animated.View 
      style={[
        styles.messageBubble,
        message.isUser ? styles.userBubble : styles.aiBubble,
        { opacity: fadeAnim }
      ]}
    >
      {!message.isUser && (
        <View style={styles.aiHeader}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.aiAvatar}
          />
          <Text style={styles.aiName}>History Guide</Text>
        </View>
      )}
      
      <Text style={[
        styles.messageText,
        message.isUser ? styles.userText : styles.aiText
      ]}>
        {message.text}
      </Text>

      {!message.isUser && message.text && (
        <View style={styles.messageActions}>
          <TouchableOpacity
            style={styles.audioButton}
            onPress={handleAudioPress}
          >
            <MaterialIcons
              name={isPlaying ? "stop" : "volume-up"}
              size={20}
              color="#94a3b8"
            />
          </TouchableOpacity>

          {message.suggestedLocations?.length > 0 && (
            <View style={styles.suggestedLocations}>
              <Text style={styles.suggestedTitle}>Nearby Places:</Text>
              {message.suggestedLocations.map((location, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.locationButton}
                  onPress={() => onLocationPress(location)}
                >
                  <MaterialIcons name="place" size={16} color="#3b82f6" />
                  <Text style={styles.locationText}>{location.title}</Text>
                  <Text style={styles.locationDistance}>{location.distance}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
};

const AIGuideScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: "Hello! I'm your personal history guide. I can help you discover fascinating historical sites, answer questions, and create personalized tours based on your interests. What would you like to explore?",
      isUser: false,
      suggestedLocations: [],
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState({
    interests: [],
    visitedLocations: [],
    preferredLanguage: 'en',
  });
  
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadUserProfile();
    requestPermissions();
  }, []);

  const loadUserProfile = async () => {
    // TODO: Load user profile from storage
  };

  const requestPermissions = async () => {
    try {
      await Audio.requestPermissionsAsync();
    } catch (error) {
      console.warn('Failed to get audio permissions:', error);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await getAIResponse(userMessage.text, {
        previousMessages: messages.slice(-5),
        userProfile,
        currentLocation: null, // TODO: Get current location
        timeOfDay: new Date().getHours(),
      });

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        text: response.text || response,
        isUser: false,
        suggestedLocations: response.suggestedLocations || [],
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const onLocationPress = (location) => {
    navigation.navigate('LocationDetail', { location });
  };

  const renderMessage = ({ item }) => (
    <Message
      message={item}
      onAudioPlay={() => {/* TODO: Implement audio playback */}}
    />
  );

  const renderSuggestions = () => {
    const suggestions = [
      "Tell me about historical sites nearby",
      "What happened here in the past?",
      "Create a personalized history tour",
      "Show me interesting facts about this area",
    ];

    return (
      <View style={styles.suggestionsContainer}>
        <Text style={styles.suggestionsTitle}>Try asking:</Text>
        <View style={styles.suggestionButtons}>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionButton}
              onPress={() => {
                setInputText(suggestion);
                inputRef.current?.focus();
              }}
            >
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onLayout={() => flatListRef.current?.scrollToEnd()}
          ListHeaderComponent={messages.length === 1 ? renderSuggestions : null}
        />

        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about history around you..."
            placeholderTextColor="#64748b"
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendButton, loading && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={loading || !inputText.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <MaterialIcons name="send" size={24} color="#ffffff" />
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
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  userBubble: {
    backgroundColor: '#3b82f6',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#1e293b',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  aiName: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#ffffff',
  },
  aiText: {
    color: '#e2e8f0',
  },
  messageActions: {
    marginTop: 8,
  },
  audioButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    alignSelf: 'flex-start',
  },
  suggestedLocations: {
    marginTop: 12,
  },
  suggestedTitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  locationText: {
    color: '#3b82f6',
    fontSize: 14,
    flex: 1,
    marginLeft: 8,
  },
  locationDistance: {
    color: '#94a3b8',
    fontSize: 12,
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    color: '#ffffff',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#475569',
  },
  suggestionsContainer: {
    marginBottom: 24,
  },
  suggestionsTitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 12,
  },
  suggestionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  suggestionText: {
    color: '#3b82f6',
    fontSize: 14,
  },
});

export default AIGuideScreen;
