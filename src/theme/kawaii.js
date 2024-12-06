import { Platform } from 'react-native';

export const colors = {
  // Vibrant, kawaii-style colors inspired by Line and Kakao
  primary: '#FF97C1', // Softer pink
  secondary: '#87E0C5', // Minty fresh
  accent: '#FFD93D', // Cheerful yellow
  tertiary: '#B4A7FF', // Soft purple
  
  // Playful background colors
  background: {
    light: '#FFF5F9', // Super soft pink
    dark: '#F9F0FF', // Soft purple
    mint: '#F0FFF4', // Soft mint
    peach: '#FFF0EA', // Soft peach
  },
  
  // Text colors
  text: {
    primary: '#575366', // Soft purple-grey
    secondary: '#8A8499', // Light purple-grey
    accent: '#FF97C1', // Pink accent
    highlight: '#FFD93D', // Yellow highlight
  },
  
  // Kawaii UI element colors
  ui: {
    card: '#FFFFFF',
    cardBorder: '#FFE2EE', // Softer pink border
    button: '#FF97C1', // Main pink
    buttonSecondary: '#87E0C5', // Mint button
    buttonText: '#FFFFFF',
    input: '#FFF9FB', // Super soft pink input
    inputBorder: '#FFE2EE',
    success: '#A6E4C0', // Soft green
    error: '#FFB5B5', // Soft red
  },
  
  // Expanded pastel gradients
  gradients: {
    pinkLove: ['#FFE2EE', '#FF97C1'],
    mintFresh: ['#E0FFF4', '#87E0C5'],
    skyDream: ['#F7FBFE', '#B4E7FF'],
    purpleMist: ['#F5F0FF', '#B4A7FF'],
    peachSunset: ['#FFE8D6', '#FFBEA3'],
  }
};

export const typography = {
  fontFamily: Platform.select({
    ios: 'Hiragino Sans',
    android: 'Noto Sans JP',
    default: 'Arial'
  }),
  sizes: {
    tiny: 10,
    small: 12,
    medium: 16,
    large: 20,
    xlarge: 24,
    xxlarge: 32,
  },
  weights: {
    light: '300',
    regular: '400',
    medium: '500',
    bold: '600',
    heavy: '700',
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
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  cute: {
    shadowColor: '#FF97C1',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  floating: {
    shadowColor: '#B4A7FF',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  }
};

export const animations = {
  bounce: {
    duration: 600,
    tension: 35,
    friction: 3.5,
    useNativeDriver: true,
  },
  pop: {
    duration: 250,
    toValue: 1.15,
    useNativeDriver: true,
  },
  wobble: {
    duration: 800,
    tension: 20,
    friction: 3,
    useNativeDriver: true,
  },
  float: {
    duration: 1500,
    direction: 'alternate',
    iterations: -1,
    useNativeDriver: true,
  },
  jelly: {
    duration: 400,
    tension: 100,
    friction: 5,
    useNativeDriver: true,
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
    primary: '#FF97C1',
    secondary: '#87E0C5',
    tertiary: '#B4A7FF',
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
  pastelPalette: colors,
  playfulTypography: typography,
  gentleSpacing: spacing,
  bouncyAnimations: animations,
  mascotStyles: mascots,
  decorativeElements: decorations,
  iconSet: icons,
};