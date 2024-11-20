import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ExpoLinking from 'expo-linking';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, MotiText } from 'moti';
import { supabase } from '../services/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FormInput = ({ icon, ...props }) => {
  const colorScheme = useColorScheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <MotiView
      animate={{
        borderColor: isFocused 
          ? colorScheme === 'dark' ? '#3b82f6' : '#2563eb'
          : colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }}
      style={[
        styles.inputContainer,
        colorScheme === 'dark' && styles.inputContainerDark,
      ]}
    >
      <MaterialIcons
        name={icon}
        size={20}
        color={isFocused 
          ? colorScheme === 'dark' ? '#3b82f6' : '#2563eb'
          : colorScheme === 'dark' ? '#64748b' : '#94a3b8'
        }
        style={styles.inputIcon}
      />
      <TextInput
        {...props}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholderTextColor={colorScheme === 'dark' ? '#64748b' : '#94a3b8'}
        style={[
          styles.input,
          colorScheme === 'dark' && styles.inputDark,
        ]}
      />
    </MotiView>
  );
};

const AuthScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const colorScheme = useColorScheme();

  useEffect(() => {
    checkAuth();
    setupDeepLinking();
  }, []);

  const setupDeepLinking = () => {
    const handleUrl = async ({ url }) => {
      if (url) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session && !error) {
          navigation.goBack();
        }
      }
    };

    const subscription = ExpoLinking.addEventListener('url', handleUrl);
    ExpoLinking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });

    return () => subscription.remove();
  };

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (session) navigation.goBack();
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

  const formatPhoneNumber = (text) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 0) {
      if (cleaned.length <= 3) {
        formatted = `(${cleaned}`;
      } else if (cleaned.length <= 6) {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
      } else {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
      }
    }
    return formatted;
  };

  const handlePhoneChange = (text) => {
    setPhone(formatPhoneNumber(text));
  };

  const handleEmailAuth = async () => {
    if (isLogin) {
      if (!email || !password) {
        Alert.alert('Missing Fields', 'Please fill in all fields.');
        return;
      }
    } else {
      if (!email || !password || !firstName || !lastName) {
        Alert.alert('Missing Fields', 'Please fill in all required fields.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data?.session) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          navigation.goBack();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              phone: phone || null,
            },
            emailRedirectTo: ExpoLinking.createURL('auth/callback')
          }
        });

        if (error) throw error;

        if (data?.user && !data?.session) {
          Alert.alert(
            'Verification Email Sent',
            'Please check your email to verify your account. Click the verification link to complete signup.',
            [{ text: 'OK' }]
          );

          setEmail('');
          setPassword('');
          setFirstName('');
          setLastName('');
          setPhone('');
        }
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: ExpoLinking.createURL('auth/callback'),
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;

      if (data) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to sign in with Google. Please try again.');
    }
  };

  return (
    <LinearGradient
      colors={colorScheme === 'dark' 
        ? ['#0f172a', '#1e293b']
        : ['#ffffff', '#f1f5f9']
      }
      style={styles.container}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 600 }}
              style={styles.header}
            >
              <MaterialIcons
                name="history-edu"
                size={48}
                color={colorScheme === 'dark' ? '#3b82f6' : '#2563eb'}
              />
              <MotiText
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 200 }}
                style={[
                  styles.title,
                  colorScheme === 'dark' && styles.titleDark
                ]}
              >
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </MotiText>
              <MotiText
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 300 }}
                style={[
                  styles.subtitle,
                  colorScheme === 'dark' && styles.subtitleDark
                ]}
              >
                {isLogin
                  ? 'Sign in to share your historical discoveries'
                  : 'Join the community of history enthusiasts'}
              </MotiText>
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ delay: 400 }}
              style={styles.form}
            >
              {!isLogin && (
                <>
                  <FormInput
                    icon="person"
                    placeholder="First Name"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                  <FormInput
                    icon="person-outline"
                    placeholder="Last Name"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                  <FormInput
                    icon="phone"
                    placeholder="Phone (optional)"
                    value={phone}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                  />
                </>
              )}

              <FormInput
                icon="email"
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <FormInput
                icon="lock"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <TouchableOpacity
                style={[
                  styles.button,
                  loading && styles.buttonDisabled
                ]}
                onPress={handleEmailAuth}
                disabled={loading}
              >
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.buttonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.buttonText}>
                      {isLogin ? 'Sign In' : 'Create Account'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={[
                  styles.dividerLine,
                  colorScheme === 'dark' && styles.dividerLineDark
                ]} />
                <Text style={[
                  styles.dividerText,
                  colorScheme === 'dark' && styles.dividerTextDark
                ]}>
                  or
                </Text>
                <View style={[
                  styles.dividerLine,
                  colorScheme === 'dark' && styles.dividerLineDark
                ]} />
              </View>

              <TouchableOpacity
                style={[
                  styles.googleButton,
                  colorScheme === 'dark' && styles.googleButtonDark
                ]}
                onPress={handleGoogleAuth}
              >
                <MaterialIcons name="google" size={24} color="#DB4437" />
                <Text style={[
                  styles.googleButtonText,
                  colorScheme === 'dark' && styles.googleButtonTextDark
                ]}>
                  Continue with Google
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsLogin(!isLogin);
                }}
              >
                <Text style={[
                  styles.switchText,
                  colorScheme === 'dark' && styles.switchTextDark
                ]}>
                  {isLogin
                    ? "Don't have an account? Sign Up"
                    : 'Already have an account? Sign In'}
                </Text>
              </TouchableOpacity>
            </MotiView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginVertical: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 24,
    marginBottom: 8,
  },
  titleDark: {
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: SCREEN_WIDTH * 0.8,
  },
  subtitleDark: {
    color: '#94a3b8',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  inputContainerDark: {
    backgroundColor: '#1e293b',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputIcon: {
    padding: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    paddingVertical: 16,
    paddingRight: 16,
  },
  inputDark: {
    color: '#ffffff',
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerLineDark: {
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  dividerTextDark: {
    color: '#94a3b8',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  googleButtonDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  googleButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButtonTextDark: {
    color: '#ffffff',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  switchText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  switchTextDark: {
    color: '#60a5fa',
  },
});

export default AuthScreen;
