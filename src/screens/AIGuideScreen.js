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
import { kawaii } from '../theme/kawaii';
import { ScrollView } from 'react-native-gesture-handler';

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
      { opacity: fadeAnim }
    ]}>
      {!message.isUser && (
        <View style={styles.aiHeader}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.aiAvatar}
          />
          <Text style={styles.aiName}>
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
                color={kawaii.pastelPalette.text.primary}
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
                colors={kawaii.pastelPalette.gradients.skyDream}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionGradient}
              >
                <MaterialIcons
                  name={getActionIcon(action.type)}
                  size={20}
                  color={kawaii.pastelPalette.text.primary}
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
              <Text style={styles.relatedTitle}>
                Nearby Places:
              </Text>
              {message.relatedLocations.map((location, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.locationButton}
                  onPress={() => handleActionPress({
                    type: 'visit',
                    location,
                  })}
                >
                  <MaterialIcons name="place" size={16} color={kawaii.pastelPalette.text.primary} />
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
        gradient: kawaii.pastelPalette.gradients.oceanBreeze,
      },
      {
        text: "What happened here in the past?",
        icon: "history",
        gradient: kawaii.pastelPalette.gradients.skyDream,
      },
      {
        text: "Create a personalized history tour",
        icon: "map",
        gradient: kawaii.pastelPalette.gradients.greenWhisper,
      },
      {
        text: "Show me interesting facts about this area",
        icon: "info",
        gradient: kawaii.pastelPalette.gradients.sunsetGlow,
      },
    ];

    return (
      <View style={styles.suggestionsContainer}>
        <Text style={[styles.suggestionsTitle, { color: kawaii.pastelPalette.text.accent }]}>
          What would you like to explore?
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.suggestionsScrollView}
        >
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.suggestionCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setInputText(suggestion.text);
              }}
            >
              <LinearGradient
                colors={suggestion.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.suggestionGradient}
              >
                <MaterialIcons 
                  name={suggestion.icon} 
                  size={24} 
                  color={kawaii.pastelPalette.text.primary} 
                />
                <Text style={styles.suggestionText}>
                  {suggestion.text}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={[
        kawaii.pastelPalette.background.light,
        kawaii.pastelPalette.background.mint,
        kawaii.pastelPalette.background.peach,
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.content}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesContainer}
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
              placeholder="Ask me about history..."
              placeholderTextColor={kawaii.pastelPalette.text.secondary}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
              disabled={loading}
            >
              <LinearGradient
                colors={kawaii.pastelPalette.gradients.skyDream}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator 
                    size="small" 
                    color={kawaii.pastelPalette.text.primary} 
                  />
                ) : (
                  <MaterialIcons
                    name="send"
                    size={24}
                    color={kawaii.pastelPalette.text.primary}
                  />
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
    backgroundColor: kawaii.pastelPalette.background.light,
    paddingTop: kawaii.spacing.medium,
  },
  content: {
    flex: 1,
    paddingHorizontal: kawaii.spacing.medium,
  },
  messagesContainer: {
    flex: 1,
    paddingBottom: kawaii.spacing.large,
  },
  messageBubble: {
    marginBottom: kawaii.spacing.small,
    borderRadius: kawaii.borderRadius.medium,
    padding: kawaii.spacing.medium,
    ...kawaii.shadows.soft,
  },
  userBubble: {
    backgroundColor: kawaii.pastelPalette.ui.input,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  aiBubble: {
    backgroundColor: kawaii.pastelPalette.ui.card,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  messageText: {
    fontFamily: kawaii.typography.fontFamily,
    fontSize: kawaii.typography.sizes.medium,
    color: kawaii.pastelPalette.text.primary,
  },
  userText: {
    textAlign: 'right',
  },
  aiText: {
    textAlign: 'left',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kawaii.pastelPalette.ui.input,
    borderRadius: kawaii.borderRadius.large,
    paddingHorizontal: kawaii.spacing.medium,
    paddingVertical: kawaii.spacing.small,
    marginBottom: kawaii.spacing.medium,
    ...kawaii.shadows.cute,
  },
  input: {
    flex: 1,
    fontFamily: kawaii.typography.fontFamily,
    fontSize: kawaii.typography.sizes.medium,
    color: kawaii.pastelPalette.text.primary,
    marginRight: kawaii.spacing.small,
  },
  sendButton: {
    backgroundColor: kawaii.pastelPalette.ui.button,
    borderRadius: kawaii.borderRadius.rounded,
    padding: kawaii.spacing.tiny,
  },
  sendButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: kawaii.spacing.small,
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: kawaii.borderRadius.rounded,
    marginRight: kawaii.spacing.small,
  },
  aiName: {
    fontFamily: kawaii.typography.fontFamily,
    fontSize: kawaii.typography.sizes.medium,
    fontWeight: kawaii.typography.weights.medium,
    color: kawaii.pastelPalette.text.accent,
  },
  actionButton: {
    marginTop: kawaii.spacing.small,
    borderRadius: kawaii.borderRadius.medium,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: kawaii.spacing.small,
    justifyContent: 'space-between',
  },
  actionText: {
    fontFamily: kawaii.typography.fontFamily,
    fontSize: kawaii.typography.sizes.small,
    color: kawaii.pastelPalette.text.primary,
    marginLeft: kawaii.spacing.tiny,
  },
  pointsBadge: {
    backgroundColor: kawaii.pastelPalette.accent,
    borderRadius: kawaii.borderRadius.rounded,
    paddingHorizontal: kawaii.spacing.tiny,
    paddingVertical: kawaii.spacing.micro,
  },
  pointsText: {
    fontFamily: kawaii.typography.fontFamily,
    fontSize: kawaii.typography.sizes.tiny,
    color: kawaii.pastelPalette.text.primary,
  },
  suggestedAction: {
    marginBottom: kawaii.spacing.tiny,
  },
  relatedLocations: {
    marginTop: kawaii.spacing.small,
    backgroundColor: kawaii.pastelPalette.background.mint,
    borderRadius: kawaii.borderRadius.medium,
    padding: kawaii.spacing.small,
    ...kawaii.shadows.dreamy,
  },
  relatedTitle: {
    fontFamily: kawaii.typography.fontFamily,
    fontSize: kawaii.typography.sizes.small,
    color: kawaii.pastelPalette.text.accent,
    marginBottom: kawaii.spacing.tiny,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: kawaii.spacing.tiny,
  },
  locationText: {
    fontFamily: kawaii.typography.fontFamily,
    fontSize: kawaii.typography.sizes.small,
    color: kawaii.pastelPalette.text.primary,
    marginLeft: kawaii.spacing.tiny,
  },
  locationDistance: {
    fontFamily: kawaii.typography.fontFamily,
    fontSize: kawaii.typography.sizes.tiny,
    color: kawaii.pastelPalette.text.secondary,
    marginLeft: 'auto',
  },
  truncatedText: {
    maxHeight: 100,
  },
  readMoreText: {
    color: kawaii.pastelPalette.text.accent,
    fontStyle: 'italic',
  },
  audioButton: {
    marginBottom: kawaii.spacing.tiny,
  },
  audioButtonBackground: {
    backgroundColor: kawaii.pastelPalette.ui.input,
    borderRadius: kawaii.borderRadius.rounded,
    padding: kawaii.spacing.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionsContainer: {
    marginBottom: kawaii.spacing.large,
    paddingHorizontal: kawaii.spacing.small,
  },
  suggestionsTitle: {
    fontFamily: kawaii.typography.fontFamily,
    fontSize: kawaii.typography.sizes.medium,
    color: kawaii.pastelPalette.text.accent,
    marginBottom: kawaii.spacing.small,
  },
  suggestionsScrollView: {
    paddingVertical: kawaii.spacing.small,
  },
  suggestionCard: {
    marginRight: kawaii.spacing.medium,
    backgroundColor: kawaii.pastelPalette.background.light,
    borderRadius: kawaii.borderRadius.medium,
    ...kawaii.shadows.cute,
  },
  suggestionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: kawaii.spacing.small,
    borderRadius: kawaii.borderRadius.medium,
  },
  suggestionText: {
    fontFamily: kawaii.typography.fontFamily,
    fontSize: kawaii.typography.sizes.small,
    color: kawaii.pastelPalette.text.primary,
    marginLeft: kawaii.spacing.small,
    maxWidth: 200,
  },
});

export default AIGuideScreen;
