import React, { useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(rotateAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleNavigateToExplore = useCallback(() => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      navigation.navigate('Explore');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [navigation]);

  const gesture = Gesture.Pan()
    .runOnJS(true)
    .onEnd((event) => {
      if (event.velocityY < -1000 || event.translationY < -100) {
        handleNavigateToExplore();
      }
    });

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <GestureDetector gesture={gesture}>
      <LinearGradient
        colors={['#000000', '#1a1a2e', '#16213e']}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <StatusBar style="light" />
        <SafeAreaView style={styles.container}>
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim },
                ],
              },
            ]}
          >
            <BlurView intensity={20} tint="dark" style={styles.headerBlur}>
              <View style={styles.headerContainer}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <MaterialIcons name="history-edu" size={48} color="#fff" />
                </Animated.View>
                <Text style={styles.title}>NanoHistory</Text>
                <Text style={styles.subtitle}>
                  Where Every Place Has a Story
                </Text>
              </View>
            </BlurView>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.mainButton}
                onPress={handleNavigateToExplore}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#4f46e5', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <MaterialIcons name="explore" size={32} color="#fff" />
                  </Animated.View>
                  <Text style={styles.mainButtonText}>Discover Stories</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.secondaryButtonsContainer}>
                <TouchableOpacity
                  style={[styles.secondaryButton, { marginRight: 8 }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('AIGuide');
                  }}
                  activeOpacity={0.8}
                >
                  <BlurView intensity={30} tint="dark" style={styles.glassBackground}>
                    <MaterialIcons name="psychology" size={24} color="#60a5fa" />
                    <Text style={styles.secondaryButtonText}>History Guide</Text>
                  </BlurView>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('CreateStory');
                  }}
                  activeOpacity={0.8}
                >
                  <BlurView intensity={30} tint="dark" style={styles.glassBackground}>
                    <MaterialIcons name="add-photo-alternate" size={24} color="#10b981" />
                    <Text style={styles.secondaryButtonText}>Share Story</Text>
                  </BlurView>
                </TouchableOpacity>
              </View>
            </View>

            <Animated.View 
              style={[
                styles.footer,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <BlurView intensity={20} tint="dark" style={styles.footerBlur}>
                <MaterialIcons name="swipe-up" size={24} color="#fff" style={styles.footerIcon} />
                <Text style={styles.footerText}>Swipe up to explore history around you</Text>
              </BlurView>
            </Animated.View>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  headerBlur: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContainer: {
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: '#ffffff',
    marginVertical: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 20,
    color: '#d1d5db',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 28,
    letterSpacing: 0.5,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 40,
  },
  mainButton: {
    marginBottom: 16,
    borderRadius: 24,
    elevation: 8,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  gradientButton: {
    paddingVertical: 20,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  mainButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  secondaryButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  glassBackground: {
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  footerBlur: {
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerIcon: {
    marginRight: 8,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});

export default HomeScreen;
