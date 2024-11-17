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
  Vibration,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { getAIResponse, generateVoice } from '../services/ai';
import * as Location from 'expo-location';

const Message = ({ message, onAudioPlay, onActionPress, colorScheme }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const handleActionPress = (action) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onActionPress(action);
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
          <Text style={[
            styles.aiName,
            colorScheme === 'dark' && styles.aiNameDark
          ]}>
            History Guide
          </Text>
        </View>
      )}
      
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.messageText,
          message.isUser ? styles.userText : styles.aiText,
          colorScheme === 'dark' && (message.isUser ? styles.userTextDark : styles.aiTextDark),
          !isExpanded && message.text.length > 150 && styles.truncatedText
        ]}>
          {isExpanded ? message.text : message.text.slice(0, 150)}
          {!isExpanded && message.text.length > 150 && '... (tap to read more)'}
        </Text>
      </TouchableOpacity>

      {!message.isUser && (
        <View style={styles.messageActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.audioButton]}
            onPress={handleAudioPress}
          >
            <MaterialIcons
              name={isPlaying ? "stop" : "volume-up"}
              size={20}
              color="#94a3b8"
            />
          </TouchableOpacity>

          {message.suggestedActions?.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.actionButton, styles.suggestedAction]}
              onPress={() => handleActionPress(action)}
            >
              <MaterialIcons
                name={getActionIcon(action.type)}
                size={20}
                color="#3b82f6"
              />
              <Text style={styles.actionText}>{action.title}</Text>
              <View style={styles.pointsBadge}>
                <Text style={styles.pointsText}>+{action.points}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {message.relatedLocations?.length > 0 && (
            <View style={styles.relatedLocations}>
              <Text style={styles.relatedTitle}>Nearby Places:</Text>
              {message.relatedLocations.map((location, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.locationButton}
                  onPress={() => handleActionPress({
                    type: 'visit',
                    location,
                  })}
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
      suggestedActions: [
        {
          type: 'discover',
          title: 'Discover Nearby History',
          points: 50,
        },
        {
          type: 'tour',
          title: 'Create Custom Tour',
          points: 100,
        },
      ],
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState({
    interests: [],
    visitedLocations: [],
    preferredLanguage: 'en',
    accessibility: {
      visualAid: false,
      hearingAid: false,
      mobilityAid: false,
    },
  });
  const [currentLocation, setCurrentLocation] = useState(null);
  
  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const colorScheme = useColorScheme();

  useEffect(() => {
    loadUserProfile();
    requestPermissions();
    getCurrentLocation();
  }, []);

  const loadUserProfile = async () => {
    // TODO: Load from AsyncStorage
    // For now using mock data
    setUserProfile({
      interests: ['history', 'architecture', 'culture'],
      visitedLocations: [],
      preferredLanguage: 'en',
      accessibility: {
        visualAid: false,
        hearingAid: false,
        mobilityAid: false,
      },
    });
  };

  const requestPermissions = async () => {
    try {
      await Promise.all([
        Audio.requestPermissionsAsync(),
        Location.requestForegroundPermissionsAsync(),
      ]);
    } catch (error) {
      console.warn('Failed to get permissions:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(location);
      }
    } catch (error) {
      console.warn('Error getting location:', error);
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
        currentLocation,
        timeOfDay: new Date().getHours(),
      });

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        text: response.text,
        isUser: false,
        suggestedActions: response.suggestedActions,
        relatedLocations: response.relatedLocations,
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Haptic feedback for response
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Auto-play response for accessibility
      if (userProfile.accessibility.visualAid) {
        Speech.speak(aiMessage.text, {
          language: userProfile.preferredLanguage,
          pitch: 1.0,
          rate: 0.9,
        });
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
      };
      setMessages(prev => [...prev, errorMessage]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleActionPress = (action) => {
    switch (action.type) {
      case 'visit':
        navigation.navigate('LocationDetail', { location: action.location });
        break;
      case 'ar_view':
        navigation.navigate('ARView', { location: action.location });
        break;
      case 'tour':
        // TODO: Implement custom tour creation
        break;
      case 'discover':
        navigation.navigate('Explore');
        break;
      default:
        console.warn('Unknown action type:', action.type);
    }
  };

  const renderMessage = ({ item }) => (
    <Message
      message={item}
      onAudioPlay={() => {/* TODO: Implement audio playback */}}
      onActionPress={handleActionPress}
      colorScheme={colorScheme}
    />
  );

  const renderSuggestions = () => {
    const suggestions = [
      {
        text: "Tell me about historical sites nearby",
        icon: "place",
      },
      {
        text: "What happened here in the past?",
        icon: "history",
      },
      {
        text: "Create a personalized history tour",
        icon: "map",
      },
      {
        text: "Show me interesting facts about this area",
        icon: "info",
      },
    ];

    return (
      <View style={styles.suggestionsContainer}>
        <Text style={[
          styles.suggestionsTitle,
          colorScheme === 'dark' && styles.suggestionsTextDark
        ]}>
          Try asking:
        </Text>
        <View style={styles.suggestionButtons}>
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionButton}
              onPress={() => {
                setInputText(suggestion.text);
                inputRef.current?.focus();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <MaterialIcons
                name={suggestion.icon}
                size={20}
                color="#3b82f6"
                style={styles.suggestionIcon}
              />
              <Text style={styles.suggestionText}>{suggestion.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
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

        <View style={[
          styles.inputContainer,
          colorScheme === 'dark' && styles.inputContainerDark
        ]}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              colorScheme === 'dark' && styles.inputDark
            ]}
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
            style={[
              styles.sendButton,
              loading && styles.sendButtonDisabled
            ]}
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

const getActionIcon = (type) => {
  switch (type) {
    case 'visit': return 'place';
    case 'ar_view': return 'view-in-ar';
    case 'tour': return 'map';
    case 'discover': return 'explore';
    default: return 'arrow-forward';
  }
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
    backgroundColor: '#f1f5f9',
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
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  aiNameDark: {
    color: '#94a3b8',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#ffffff',
  },
  aiText: {
    color: '#0f172a',
  },
  userTextDark: {
    color: '#ffffff',
  },
  aiTextDark: {
    color: '#e2e8f0',
  },
  truncatedText: {
    marginBottom: 4,
  },
  messageActions: {
    marginTop: 8,
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  audioButton: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: 20,
  },
  suggestedAction: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'space-between',
  },
  actionText: {
    color: '#3b82f6',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  pointsBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pointsText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  relatedLocations: {
    marginTop: 8,
  },
  relatedTitle: {
    color: '#64748b',
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
    color: '#64748b',
    fontSize: 12,
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  inputContainerDark: {
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    color: '#0f172a',
    fontSize: 16,
    maxHeight: 100,
  },
  inputDark: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
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
    backgroundColor: '#94a3b8',
  },
  suggestionsContainer: {
    marginBottom: 24,
  },
  suggestionsTitle: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 12,
  },
  suggestionsTextDark: {
    color: '#94a3b8',
  },
  suggestionButtons: {
    gap: 8,
  },
  suggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  suggestionIcon: {
    marginRight: 8,
  },
  suggestionText: {
    color: '#3b82f6',
    fontSize: 14,
  },
});

export default AIGuideScreen;
