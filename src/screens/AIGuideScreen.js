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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { getAIResponse, generateVoice } from '../services/ai';
import * as Location from 'expo-location';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    <Animated.View style={[
      styles.messageBubble,
      message.isUser ? styles.userBubble : styles.aiBubble,
      colorScheme === 'dark' && (message.isUser ? styles.userBubbleDark : styles.aiBubbleDark),
      { opacity: fadeAnim }
    ]}>
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
        onPress={() => {
          setIsExpanded(!isExpanded);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.messageText,
          message.isUser ? styles.userText : styles.aiText,
          colorScheme === 'dark' && (message.isUser ? styles.userTextDark : styles.aiTextDark),
          !isExpanded && message.text.length > 150 && styles.truncatedText
        ]}>
          {isExpanded ? message.text : message.text.slice(0, 150)}
          {!isExpanded && message.text.length > 150 && (
            <Text style={styles.readMoreText}>... tap to read more</Text>
          )}
        </Text>
      </TouchableOpacity>

      {!message.isUser && (
        <View style={styles.messageActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.audioButton]}
            onPress={handleAudioPress}
          >
            <View style={styles.audioButtonBackground}>
              <MaterialIcons
                name={isPlaying ? "stop" : "volume-up"}
                size={20}
                color={colorScheme === 'dark' ? '#e2e8f0' : '#64748b'}
              />
            </View>
          </TouchableOpacity>

          {message.suggestedActions?.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.actionButton, styles.suggestedAction]}
              onPress={() => handleActionPress(action)}
            >
              <LinearGradient
                colors={['rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.2)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionGradient}
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
              </LinearGradient>
            </TouchableOpacity>
          ))}

          {message.relatedLocations?.length > 0 && (
            <View style={styles.relatedLocations}>
              <Text style={[
                styles.relatedTitle,
                colorScheme === 'dark' && styles.relatedTitleDark
              ]}>
                Nearby Places:
              </Text>
              {message.relatedLocations.map((location, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.locationButton,
                    colorScheme === 'dark' && styles.locationButtonDark
                  ]}
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
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
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
              style={[
                styles.suggestionButton,
                colorScheme === 'dark' && styles.suggestionButtonDark
              ]}
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
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            onLayout={() => flatListRef.current?.scrollToEnd()}
            ListHeaderComponent={messages.length === 1 ? renderSuggestions : null}
            showsVerticalScrollIndicator={false}
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
              <LinearGradient
                colors={loading ? ['#94a3b8', '#64748b'] : ['#3b82f6', '#2563eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <MaterialIcons name="send" size={24} color="#ffffff" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
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
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
    backgroundColor: '#3b82f6',
  },
  userBubbleDark: {
    backgroundColor: '#2563eb',
  },
  aiBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    backgroundColor: 'rgba(241, 245, 249, 0.95)',
  },
  aiBubbleDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderRadius: 16,
    padding: 8,
    backgroundColor: 'rgba(241, 245, 249, 0.5)',
  },
  aiAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  aiName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  aiNameDark: {
    color: '#94a3b8',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
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
  readMoreText: {
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic',
  },
  messageActions: {
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  audioButton: {
    alignSelf: 'flex-start',
  },
  audioButtonBackground: {
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
  },
  suggestedAction: {
    backgroundColor: 'transparent',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
  },
  actionText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  pointsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
  },
  pointsText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  relatedLocations: {
    marginTop: 12,
  },
  relatedTitle: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  relatedTitleDark: {
    color: '#94a3b8',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 12,
    borderRadius: 16,
    marginBottom: 6,
  },
  locationButtonDark: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  locationText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
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
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  inputContainerDark: {
    borderTopColor: 'rgba(30, 41, 59, 0.5)',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(241, 245, 249, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    color: '#0f172a',
    fontSize: 16,
    maxHeight: 100,
  },
  inputDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    color: '#ffffff',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsContainer: {
    marginBottom: 24,
  },
  suggestionsTitle: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  suggestionButtonDark: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default AIGuideScreen;
