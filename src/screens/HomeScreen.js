import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { kawaii } from '../theme/kawaii';
import { MotiView } from 'moti';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FloatingBubble = ({ delay, scale, translateY, children }) => (
  <MotiView
    from={{
      opacity: 0,
      scale: 0.8,
      translateY: translateY || 0,
    }}
    animate={{
      opacity: 1,
      scale: scale || 1,
      translateY: 0,
    }}
    transition={{
      type: 'timing',
      duration: 1000,
      delay,
    }}
  >
    {children}
  </MotiView>
);

const BackgroundPattern = () => {
  const patterns = Array(8).fill(0).map((_, i) => (
    <MotiView
      key={i}
      from={{
        opacity: 0,
        scale: 0.5,
        translateX: Math.random() * SCREEN_WIDTH,
        translateY: Math.random() * SCREEN_HEIGHT,
      }}
      animate={{
        opacity: 0.1,
        scale: 0.8 + Math.random() * 0.4,
        translateX: Math.random() * SCREEN_WIDTH,
        translateY: Math.random() * SCREEN_HEIGHT,
      }}
      transition={{
        type: 'timing',
        duration: 3000 + Math.random() * 2000,
        delay: i * 200,
        loop: true,
      }}
      style={[
        styles.patternElement,
        {
          backgroundColor: [
            kawaii.pastelPalette.primary,
            kawaii.pastelPalette.secondary,
            kawaii.pastelPalette.accent,
            kawaii.pastelPalette.tertiary,
          ][i % 4],
          borderRadius: Math.random() > 0.5 ? 50 : 8,
          transform: [{ rotate: `${Math.random() * 360}deg` }],
        },
      ]}
    />
  ));

  return <View style={styles.patternContainer}>{patterns}</View>;
};

const Sparkle = ({ delay = 0, size = 4 }) => (
  <MotiView
    style={[styles.sparkle, { width: size, height: size }]}
    from={{
      opacity: 0,
      scale: 0,
      translateX: 0,
      translateY: 0,
    }}
    animate={{
      opacity: [0, 1, 0],
      scale: [0, 1, 0],
      translateX: [-10, 10, -10],
      translateY: [-10, 10, -10],
    }}
    transition={{
      type: 'timing',
      duration: 2000,
      delay,
      loop: true,
    }}
  />
);

const KawaiiButton = ({ onPress, style, gradientColors, icon, label, size = 'normal', sparkles = true }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -2,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 2,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '2deg'],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.95}
      style={[styles.kawaiiButton, size === 'large' && styles.kawaiiButtonLarge, style]}
    >
      <Animated.View 
        style={{ 
          transform: [
            { scale: scaleAnim }, 
            { rotate: rotation },
            { translateY: bounceAnim }
          ] 
        }}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.kawaiiButtonGradient, size === 'large' && styles.kawaiiButtonGradientLarge]}
        >
          <BlurView intensity={80} tint="light" style={styles.kawaiiButtonContent}>
            <View style={styles.kawaiiButtonIconContainer}>
              <MaterialIcons 
                name={icon} 
                size={size === 'large' ? 32 : 24} 
                color={kawaii.pastelPalette.text.primary} 
              />
              {sparkles && (
                <View style={styles.sparklesContainer}>
                  <Sparkle delay={0} />
                  <Sparkle delay={400} size={6} />
                  <Sparkle delay={800} size={3} />
                </View>
              )}
            </View>
            <Text style={[
              styles.kawaiiButtonText,
              size === 'large' && styles.kawaiiButtonTextLarge
            ]}>
              {label}
            </Text>
          </BlurView>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
};

const HomeScreen = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const mascotBounceAnim = useRef(new Animated.Value(0)).current;
  const mascotWobbleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.spring(mascotBounceAnim, {
          toValue: -15,
          tension: 50,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(mascotBounceAnim, {
          toValue: 0,
          tension: 50,
          friction: 5,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(mascotWobbleAnim, {
          toValue: -0.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(mascotWobbleAnim, {
          toValue: 0.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(mascotWobbleAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleNavigateToExplore = useCallback((source) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      navigation.navigate('Explore', { source });
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [navigation]);

  const gesture = Gesture.Pan()
    .runOnJS(true)
    .onEnd((event) => {
      if (event.velocityY < -1000 || event.translationY < -100) {
        handleNavigateToExplore('swipe');
      }
    });

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container}>
        <LinearGradient
          colors={[
            kawaii.pastelPalette.background.light,
            kawaii.pastelPalette.background.mint,
            kawaii.pastelPalette.background.peach,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        
        <BackgroundPattern />

        <StatusBar style="dark" />
        <SafeAreaView style={styles.safeArea}>
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.mascotSection}>
              <BlurView intensity={40} tint="light" style={styles.mascotBlur}>
                <Animated.View
                  style={[
                    styles.mascotContainer,
                    {
                      transform: [
                        { translateY: mascotBounceAnim },
                        { rotate: mascotWobbleAnim.interpolate({
                          inputRange: [-1, 1],
                          outputRange: ['-15deg', '15deg']
                        })},
                      ],
                    },
                  ]}
                >
                  <Image
                    source={require('../assets/mascots/mascot.png')}
                    style={styles.mascot}
                    resizeMode="contain"
                  />
                </Animated.View>
                <Text style={styles.title}>TaleTrail</Text>
                <Text style={styles.subtitle}>Where Every Place Has a Story</Text>
              </BlurView>
            </View>

            <View style={styles.buttonContainer}>
              <KawaiiButton
                style={styles.mainButton}
                gradientColors={kawaii.pastelPalette.gradients.pinkLove}
                icon="explore"
                label="Discover Stories"
                size="large"
                onPress={() => handleNavigateToExplore('button')}
              />

              <View style={styles.secondaryButtonsContainer}>
                <KawaiiButton
                  style={[styles.secondaryButton, { marginRight: 8 }]}
                  gradientColors={kawaii.pastelPalette.gradients.purpleMist}
                  icon="psychology"
                  label="History Guide"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('AIGuide');
                  }}
                />

                <KawaiiButton
                  style={[styles.secondaryButton, { marginRight: 8 }]}
                  gradientColors={kawaii.pastelPalette.gradients.mintFresh}
                  icon="add-photo-alternate"
                  label="Share Story"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('CreateStory');
                  }}
                />

                <KawaiiButton
                  style={styles.secondaryButton}
                  gradientColors={kawaii.pastelPalette.gradients.peachSunset}
                  icon="map"
                  label="Tour Guide"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    navigation.navigate('TourGuide');
                  }}
                />
              </View>
            </View>

            <BlurView intensity={40} tint="light" style={styles.footer}>
              <LinearGradient
                colors={kawaii.pastelPalette.gradients.skyDream}
                style={styles.footerGradient}
              >
                <MaterialIcons
                  name="swipe-up"
                  size={24}
                  color={kawaii.pastelPalette.text.primary}
                  style={styles.footerIcon}
                />
                <Text style={styles.footerText}>Swipe up to explore history around you</Text>
              </LinearGradient>
            </BlurView>
          </Animated.View>
        </SafeAreaView>
      </View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: kawaii.gentleSpacing.large,
    justifyContent: 'space-between',
  },
  patternContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patternElement: {
    position: 'absolute',
    width: 60,
    height: 60,
  },
  mascotSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    marginTop: kawaii.gentleSpacing.xlarge,
  },
  mascotBlur: {
    borderRadius: kawaii.cornerRadius * 2,
    overflow: 'hidden',
    padding: kawaii.gentleSpacing.large,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    ...kawaii.softShadow,
  },
  mascotContainer: {
    width: kawaii.mascotStyles.size.xlarge * 1.2,
    height: kawaii.mascotStyles.size.xlarge * 1.2,
    marginBottom: kawaii.gentleSpacing.medium,
    alignSelf: 'center',
  },
  mascot: {
    width: '100%',
    height: '100%',
    borderRadius: kawaii.cornerRadius * 2,
  },
  title: {
    fontSize: kawaii.playfulTypography.sizes.xxlarge,
    fontFamily: kawaii.playfulTypography.fontFamily,
    fontWeight: kawaii.playfulTypography.weights.bold,
    color: kawaii.pastelPalette.text.primary,
    marginVertical: kawaii.gentleSpacing.medium,
    textAlign: 'center',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: kawaii.playfulTypography.sizes.large,
    color: kawaii.pastelPalette.text.secondary,
    textAlign: 'center',
    fontWeight: kawaii.playfulTypography.weights.medium,
    letterSpacing: 0.5,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: kawaii.gentleSpacing.medium,
    marginBottom: kawaii.gentleSpacing.xlarge,
  },
  mainButton: {
    marginBottom: kawaii.gentleSpacing.large,
  },
  secondaryButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryButton: {
    flex: 1,
  },
  kawaiiButton: {
    borderRadius: kawaii.cornerRadius * 2,
    overflow: 'hidden',
    ...kawaii.cuteShadow,
  },
  kawaiiButtonLarge: {
    borderRadius: kawaii.cornerRadius * 2.5,
  },
  kawaiiButtonGradient: {
    borderRadius: kawaii.cornerRadius * 2,
    padding: 2,
  },
  kawaiiButtonGradientLarge: {
    borderRadius: kawaii.cornerRadius * 2.5,
  },
  kawaiiButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kawaii.gentleSpacing.small,
    paddingVertical: kawaii.gentleSpacing.medium,
    paddingHorizontal: kawaii.gentleSpacing.large,
    borderRadius: kawaii.cornerRadius * 2 - 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  kawaiiButtonIconContainer: {
    position: 'relative',
  },
  kawaiiButtonText: {
    color: kawaii.pastelPalette.text.primary,
    fontSize: kawaii.playfulTypography.sizes.medium,
    fontWeight: kawaii.playfulTypography.weights.bold,
    letterSpacing: 0.5,
  },
  kawaiiButtonTextLarge: {
    fontSize: kawaii.playfulTypography.sizes.large,
  },
  sparkle: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: 2,
  },
  sparklesContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  footer: {
    borderRadius: kawaii.cornerRadius * 2,
    overflow: 'hidden',
    marginBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  footerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: kawaii.gentleSpacing.medium,
    paddingHorizontal: kawaii.gentleSpacing.large,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  footerIcon: {
    marginRight: kawaii.gentleSpacing.small,
  },
  footerText: {
    color: kawaii.pastelPalette.text.primary,
    fontSize: kawaii.playfulTypography.sizes.medium,
    fontWeight: kawaii.playfulTypography.weights.medium,
    letterSpacing: 0.5,
  },
});

export default HomeScreen;