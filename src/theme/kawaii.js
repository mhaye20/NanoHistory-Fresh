import { Platform } from 'react-native';

export const colors = {
  // Nature-inspired kawaii colors
  primary: '#4ECDC4', // Soft teal
  secondary: '#45B7D1', // Gentle blue
  accent: '#FFD93D', // Cheerful yellow (keeping this)
  tertiary: '#A8DADC', // Light blue
  
  // Soft, calming background colors
  background: {
    light: '#F1FAEE', // Soft mint green
    dark: '#E9F5F9', // Pale blue
    mint: '#E8F5E9', // Light sage
    peach: '#E6F3FF', // Soft sky blue
  },
  
  // Text colors
  text: {
    primary: '#2C3E50', // Deep blue-grey
    secondary: '#34495E', // Soft grey-blue
    accent: '#4ECDC4', // Teal accent
    highlight: '#FFD93D', // Yellow highlight (keeping this)
  },
  
  // Kawaii UI element colors
  ui: {
    card: '#FFFFFF',
    cardBorder: '#A8DADC', // Light blue border
    button: '#4ECDC4', // Teal button
    buttonSecondary: '#45B7D1', // Soft blue button
    buttonText: '#FFFFFF',
    input: '#F1FAEE', // Soft mint input
    inputBorder: '#A8DADC',
    success: '#2ECC71', // Bright green
    error: '#E74C3C', // Soft red
  },
  
  // Expanded soft gradients
  gradients: {
    oceanBreeze: ['#E6F3FF', '#4ECDC4'],
    skyDream: ['#F1FAEE', '#45B7D1'],
    greenWhisper: ['#E8F5E9', '#2ECC71'],
    sunsetGlow: ['#FFE8D6', '#FFD93D'],
    serenity: ['#E9F5F9', '#A8DADC'],
    pinkLove: ['#E6F3FF', '#4ECDC4'], // Replaced pink with teal
    purpleMist: ['#F1FAEE', '#45B7D1'], // Replaced purple with blue
    mintFresh: ['#E8F5E9', '#2ECC71'],
    peachSunset: ['#FFE8D6', '#FFD93D'],
  }
};

export const pastelPalette = {
  primary: '#4ECDC4',
  secondary: '#45B7D1',
  accent: '#FFD93D',
  tertiary: '#A8DADC',
  
  background: {
    light: '#F1FAEE',
    dark: '#E9F5F9',
    mint: '#E8F5E9',
    peach: '#E6F3FF',
  },
  
  text: {
    primary: '#2C3E50',
    secondary: '#34495E',
    accent: '#4ECDC4',
    highlight: '#FFD93D',
  },
  
  ui: {
    card: '#FFFFFF',
    cardBorder: '#A8DADC',
    button: '#4ECDC4',
    buttonSecondary: '#45B7D1',
    buttonText: '#FFFFFF',
    input: '#F1FAEE',
    inputBorder: '#A8DADC',
    success: '#2ECC71',
    error: '#E74C3C',
  },
  
  gradients: {
    oceanBreeze: ['#E6F3FF', '#4ECDC4'],
    skyDream: ['#F1FAEE', '#45B7D1'],
    greenWhisper: ['#E8F5E9', '#2ECC71'],
    sunsetGlow: ['#FFE8D6', '#FFD93D'],
    serenity: ['#E9F5F9', '#A8DADC'],
    pinkLove: ['#E6F3FF', '#4ECDC4'],
    purpleMist: ['#F1FAEE', '#45B7D1'],
    mintFresh: ['#E8F5E9', '#2ECC71'],
    peachSunset: ['#FFE8D6', '#FFD93D'],
  }
};

export const typography = {
  fontFamily: Platform.select({
    ios: 'Kawaii-Desu', // Custom kawaii font
    android: 'Cute-Sans',
    default: 'Arial'
  }),
  sizes: {
    tiny: 10,
    small: 12,
    medium: 16,
    large: 20,
    xlarge: 24,
    xxlarge: 32,
    kawaii: 36, // Extra cute size
  },
  weights: {
    light: '300',
    regular: '400',
    medium: '500',
    bold: '600',
    heavy: '700',
    kawaii: '500', // Soft, playful weight
  }
};

export const spacing = {
  micro: 2,
  tiny: 4,
  small: 8,
  medium: 12,
  large: 16,
  xlarge: 24,
  xxlarge: 32,
  huge: 48,
};

export const borderRadius = {
  small: 12, // Increased roundness
  medium: 16,
  large: 24,
  xlarge: 32,
  rounded: 999, // Perfect circle
  bubble: {
    topLeft: 24,
    topRight: 24,
    bottomLeft: 4,
    bottomRight: 24,
  }
};

export const shadows = {
  soft: {
    shadowColor: '#FFB5D3',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  cute: {
    shadowColor: '#FF97C1',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.20,
    shadowRadius: 6,
    elevation: 3,
  },
  floating: {
    shadowColor: '#B4A7FF',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  dreamy: {
    shadowColor: '#FF97C1',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    backgroundColor: 'rgba(255, 151, 193, 0.05)',
  },
  pastel: {
    shadowColor: '#87E0C5',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
    backgroundColor: 'rgba(135, 224, 197, 0.03)',
  }
};

export const animations = {
  bounce: {
    duration: 400, // Slightly faster
    tension: 40,   // More playful
    friction: 3,   // More bouncy
    useNativeDriver: true,
    type: 'spring',
    damping: 2.5,  // More exaggerated
    stiffness: 350,
  },
  pop: {
    duration: 200, // Quicker pop
    toValue: 1.2,  // More pronounced scale
    useNativeDriver: true,
    type: 'spring',
    damping: 1.5,  // More dramatic
    stiffness: 600,
  },
  wobble: {
    duration: 800,
    tension: 20,
    friction: 3,
    useNativeDriver: true,
    type: 'spring',
    damping: 4,
    stiffness: 200,
  },
  float: {
    duration: 1500,
    direction: 'alternate',
    iterations: -1,
    useNativeDriver: true,
    type: 'timing',
    easing: 'easeInOutQuad',
  },
  jelly: {
    duration: 400,
    tension: 100,
    friction: 5,
    useNativeDriver: true,
    type: 'spring',
    damping: 1,
    stiffness: 800,
  },
  wiggle: {
    duration: 300,
    useNativeDriver: true,
    type: 'spring',
    damping: 2,
    stiffness: 600,
  },
  heartBeat: {
    duration: 500,
    useNativeDriver: true,
    type: 'spring',
    damping: 1,
    stiffness: 500,
    iterations: -1,
  }
};

export const icons = {
  size: {
    tiny: 12,
    small: 16,
    medium: 24,
    large: 32,
    xlarge: 48,
  },
  colors: {
    primary: '#4ECDC4',
    secondary: '#45B7D1',
    tertiary: '#A8DADC',
    white: '#FFFFFF',
  }
};

export const mascots = {
  size: {
    tiny: 32,
    small: 48,
    medium: 64,
    large: 96,
    xlarge: 128,
  },
  position: {
    topRight: {
      top: 0,
      right: 0,
    },
    bottomLeft: {
      bottom: 0,
      left: 0,
    },
    center: {
      alignSelf: 'center',
    }
  }
};

export const decorations = {
  patterns: {
    dots: {
      backgroundColor: 'rgba(255, 151, 193, 0.1)',
      borderRadius: 999,
    },
    stripes: {
      backgroundColor: 'rgba(183, 167, 255, 0.1)',
      transform: [{ rotate: '45deg' }],
    },
    confetti: {
      opacity: 0.06,
      transform: [{ scale: 0.5 }],
    }
  },
  stickers: {
    size: {
      small: 24,
      medium: 32,
      large: 48,
    },
    rotation: {
      slight: '5deg',
      medium: '15deg',
      strong: '30deg',
    }
  }
};

export const kawaii = {
  cornerRadius: borderRadius.large,
  softShadow: shadows.soft,
  cuteShadow: shadows.cute,
  floatingShadow: shadows.floating,
  pastelPalette: pastelPalette,
  playfulTypography: typography,
  gentleSpacing: spacing,
  bouncyAnimations: animations,
  mascotStyles: mascots,
  decorativeElements: decorations,
  iconSet: icons,
};