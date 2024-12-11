import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Animated,
  ScrollView as RNScrollView,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { kawaii } from '../theme/kawaii';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BlurView } from 'expo-blur';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

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

const DAILY_HISTORY_FACTS = [
  {
    id: '1',
    fact: 'The Great Wall of China is over 13,000 miles long and took more than 2,000 years to build.',
    icon: 'terrain',
    color: kawaii.pastelPalette.gradients.skyDream[0],
  },
  {
    id: '2',
    fact: 'The first computer programmer was Ada Lovelace, who wrote algorithms for Charles Babbage\'s Analytical Engine in the 1840s.',
    icon: 'computer',
    color: kawaii.pastelPalette.gradients.mintFresh[0],
  },
  {
    id: '3',
    fact: 'The Rosetta Stone, discovered in 1799, was key to deciphering Egyptian hieroglyphs by providing the same text in three different scripts.',
    icon: 'language',
    color: kawaii.pastelPalette.gradients.lavenderDream[0],
  },
  {
    id: '4',
    fact: 'The shortest war in history was between Britain and Zanzibar in 1896, lasting just 38 minutes.',
    icon: 'timer',
    color: kawaii.pastelPalette.gradients.sunsetGlow[0],
  },
];

const HistoryFactCard = ({ fact, icon, color }) => {
  const handlePress = useCallback(() => {
    try {
      console.log('History Fact Pressed:', fact);
      Alert.alert('History Fact', fact, [{ text: 'Close' }]);
    } catch (error) {
      console.error('Error handling history fact press:', error);
    }
  }, [fact]);

  return (
    <TouchableOpacity 
      activeOpacity={0.8}
      onPress={handlePress}
    >
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: 500 }}
        style={styles.historyFactCard}
      >
        <LinearGradient
          colors={[color, color + '80']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.historyFactCardGradient}
        >
          <MaterialIcons 
            name={icon} 
            size={32} 
            color={kawaii.pastelPalette.text.primary} 
            style={styles.historyFactIcon}
          />
          <Text style={styles.historyFactText}>{fact}</Text>
        </LinearGradient>
      </MotiView>
    </TouchableOpacity>
  );
};

const HistoryFactCarousel = ({ facts }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % facts.length;
      flatListRef.current?.scrollToIndex({ 
        index: nextIndex, 
        animated: true,
        viewPosition: 0.5 
      });
      setCurrentIndex(nextIndex);
    }, 5000); // Change fact every 5 seconds

    return () => clearInterval(interval);
  }, [currentIndex, facts.length]);

  const renderPaginationDots = () => {
    return facts.map((_, index) => {
      const inputRange = [
        (index - 1) * SCREEN_WIDTH,
        index * SCREEN_WIDTH,
        (index + 1) * SCREEN_WIDTH
      ];
      const opacity = scrollX.interpolate({
        inputRange,
        outputRange: [0.3, 1, 0.3],
        extrapolate: 'clamp'
      });

      return (
        <Animated.View
          key={index}
          style={[
            styles.historyFactDot,
            { 
              opacity,
              backgroundColor: index === currentIndex 
                ? kawaii.pastelPalette.text.primary 
                : kawaii.pastelPalette.text.secondary
            }
          ]}
        />
      );
    });
  };

  return (
    <View style={styles.historyFactCarouselContainer}>
      <Text style={styles.historyFactTitle}>Daily History Fact</Text>
      <View style={styles.historyFactSwiperWrapper}>
        <Animated.FlatList
          ref={flatListRef}
          data={facts}
          horizontal
          pagingEnabled
          snapToAlignment="center"
          snapToInterval={SCREEN_WIDTH * 0.9}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.historyFactListContainer}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, index }) => (
            <View 
              style={[
                styles.historyFactSlide, 
                { 
                  opacity: index === currentIndex ? 1 : 0.1,
                  width: SCREEN_WIDTH * 0.9 
                }
              ]}
            >
              <HistoryFactCard 
                fact={item.fact} 
                icon={item.icon} 
                color={item.color} 
              />
            </View>
          )}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          getItemLayout={(data, index) => ({
            length: SCREEN_WIDTH * 0.9,
            offset: SCREEN_WIDTH * 0.9 * index,
            index,
          })}
        />
        <View style={styles.historyFactPagination}>
          {renderPaginationDots()}
        </View>
      </View>
    </View>
  );
};

const HomeScreen = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const mascotBounceAnim = useRef(new Animated.Value(0)).current;
  const mascotWobbleAnim = useRef(new Animated.Value(0)).current;
  const [currentFactIndex, setCurrentFactIndex] = useState(0);

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
          style={styles.gradient}
        >
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
                            outputRange: ['-15deg', '15deg'],
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
                  gradientColors={kawaii.pastelPalette.gradients.skyDream}
                  icon="explore"
                  label="Discover Stories"
                  size="large"
                  onPress={() => handleNavigateToExplore('button')}
                />

                <View style={styles.secondaryButtonsContainer}>
                  <KawaiiButton
                    style={[styles.secondaryButton, { marginRight: 8 }]}
                    gradientColors={kawaii.pastelPalette.gradients.mintFresh}
                    icon="psychology"
                    label="History Guide"
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      navigation.navigate('AIGuide');
                    }}
                  />

                  <KawaiiButton
                    style={[styles.secondaryButton, { marginRight: 8 }]}
                    gradientColors={kawaii.pastelPalette.gradients.peachSunset}
                    icon="add-photo-alternate"
                    label="Share Story"
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      navigation.navigate('CreateStory');
                    }}
                  />

                  <KawaiiButton
                    style={styles.secondaryButton}
                    gradientColors={kawaii.pastelPalette.gradients.lavenderDream}
                    icon="map"
                    label="Tour Guide"
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      navigation.navigate('TourGuide');
                    }}
                  />
                </View>
              </View>

              <HistoryFactCarousel facts={DAILY_HISTORY_FACTS} />

              <BlurView 
                intensity={0} 
                tint="light" 
                style={styles.footer}
              >
                <LinearGradient
                  colors={['transparent', 'transparent']}
                  style={styles.footerGradient}
                >
                  <MaterialIcons
                    name="swipe-up"
                    size={16}
                    color={kawaii.pastelPalette.text.primary}
                    style={styles.footerIcon}
                  />
                  <Text style={styles.footerText}>
                    Swipe up to explore history around you
                  </Text>
                </LinearGradient>
              </BlurView>
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>
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
    overflow: 'hidden',
    ...kawaii.cuteShadow,
  },
  kawaiiButtonLarge: {
    borderRadius: kawaii.cornerRadius * 2.5,
  },
  kawaiiButtonGradient: {
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
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  footerGradient: {
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerIcon: {
    width: 16,
    height: 16,
    tintColor: kawaii.pastelPalette.text.primary,
    opacity: 0.2,
    marginRight: 4,
  },
  footerText: {
    color: kawaii.pastelPalette.text.primary,
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.5,
    opacity: 0.3,
    textAlign: 'center',
    includeFontPadding: false,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  historyFactCarouselContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: kawaii.gentleSpacing.xlarge,
  },
  historyFactSwiperWrapper: {
    width: SCREEN_WIDTH * 0.9,
    height: Math.round(SCREEN_HEIGHT * 0.15),
    borderRadius: kawaii.cornerRadius,
    overflow: 'hidden',
  },
  historyFactSlide: {
    width: SCREEN_WIDTH * 0.9,
    height: Math.round(SCREEN_HEIGHT * 0.15),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: kawaii.gentleSpacing.small,
  },
  historyFactListContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyFactTitle: {
    fontSize: kawaii.playfulTypography.sizes.medium,
    color: kawaii.pastelPalette.text.primary,
    fontWeight: kawaii.playfulTypography.weights.bold,
    marginBottom: kawaii.gentleSpacing.small,
  },
  historyFactCard: {
    width: '100%',
    height: '100%',
    borderRadius: kawaii.cornerRadius,
    overflow: 'hidden',
  },
  historyFactCardGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: kawaii.gentleSpacing.large,
  },
  historyFactIcon: {
    marginBottom: kawaii.gentleSpacing.small,
  },
  historyFactText: {
    fontSize: kawaii.playfulTypography.sizes.small,
    color: kawaii.pastelPalette.text.primary,
    textAlign: 'center',
  },
  historyFactPagination: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyFactDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: kawaii.pastelPalette.text.secondary,
  },
});

export default HomeScreen;