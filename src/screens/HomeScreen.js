import React, { useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const HomeScreen = ({ navigation }) => {
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);
  const footerPulseAnim = new Animated.Value(1);

  useEffect(() => {
    // Initial animations
    const initialAnimation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]);

    // Footer pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(footerPulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(footerPulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    initialAnimation.start();
    pulseAnimation.start();

    return () => {
      initialAnimation.stop();
      pulseAnimation.stop();
    };
  }, []);

  const handleNavigateToExplore = useCallback(() => {
    try {
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

  return (
    <GestureDetector gesture={gesture}>
      <LinearGradient
        colors={['#1a0f3d', '#2d1b69', '#1a0f3d']}
        style={styles.background}
      >
        <StatusBar style="light" />
        <SafeAreaView style={styles.container}>
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.headerContainer}>
              <Text style={styles.title}>NanoHistory</Text>
              <Text style={styles.subtitle}>
                Experience History in a New Dimension
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.mainButton}
                onPress={handleNavigateToExplore}
              >
                <LinearGradient
                  colors={['#4f46e5', '#7c3aed']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  <Text style={styles.mainButtonText}>Start Exploring</Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.secondaryButtonsContainer}>
                <TouchableOpacity
                  style={[styles.secondaryButton, { marginRight: 8 }]}
                  onPress={() => navigation.navigate('AIGuide')}
                >
                  <View style={styles.glassBackground}>
                    <Text style={styles.secondaryButtonText}>AI Guide</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate('CreateStory')}
                >
                  <View style={styles.glassBackground}>
                    <Text style={styles.secondaryButtonText}>Share Story</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <Animated.View 
              style={[
                styles.footer,
                {
                  transform: [{ scale: footerPulseAnim }],
                },
              ]}
            >
              <Text style={styles.footerText}>⬆️ Swipe up to explore nearby stories</Text>
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
  headerContainer: {
    marginTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 20,
    color: '#d1d5db',
    marginBottom: 40,
    textAlign: 'center',
    fontWeight: '500',
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 40,
  },
  mainButton: {
    marginBottom: 16,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  gradientButton: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
  },
  mainButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  secondaryButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  glassBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backdropFilter: 'blur(10px)',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default HomeScreen;
