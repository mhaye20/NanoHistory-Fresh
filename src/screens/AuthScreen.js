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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ExpoLinking from 'expo-linking';
import { supabase } from '../services/supabase';

// Debug logging function
const logDebug = (context, message, data = null) => {
  console.log(`[${context}] ${message}`, data ? data : '');
};

// Error logging function
const logError = (context, error, additionalInfo = null) => {
  console.error(`[${context}] Error:`, error);
  if (error.message) console.error(`[${context}] Message:`, error.message);
  if (error.status) console.error(`[${context}] Status:`, error.status);
  if (error.statusText) console.error(`[${context}] Status Text:`, error.statusText);
  if (error.data) console.error(`[${context}] Error Data:`, error.data);
  if (additionalInfo) console.error(`[${context}] Additional Info:`, additionalInfo);
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
    logDebug('AuthScreen', 'Component mounted');
    checkAuth();
    setupDeepLinking();
  }, []);

  const setupDeepLinking = () => {
    logDebug('AuthScreen', 'Setting up deep linking');
    const handleUrl = async ({ url }) => {
      logDebug('AuthScreen', 'Deep link URL received', { url });
      if (url) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session && !error) {
          logDebug('AuthScreen', 'Valid session found, navigating back');
          navigation.goBack();
        } else if (error) {
          logError('AuthScreen', error, { url });
        }
      }
    };

    const subscription = ExpoLinking.addEventListener('url', handleUrl);

    ExpoLinking.getInitialURL().then(url => {
      if (url) {
        logDebug('AuthScreen', 'Initial URL found', { url });
        handleUrl({ url });
      }
    });

    return () => {
      logDebug('AuthScreen', 'Cleaning up deep linking listener');
      subscription.remove();
    };
  };

  const checkAuth = async () => {
    try {
      logDebug('AuthScreen', 'Checking authentication status');
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (session) {
        logDebug('AuthScreen', 'Active session found, navigating back');
        navigation.goBack();
      }
    } catch (error) {
      logError('AuthScreen', error);
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
      logDebug('AuthScreen', `Attempting ${isLogin ? 'login' : 'registration'}`, { email });

      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data?.session) {
          logDebug('AuthScreen', 'Login successful');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          navigation.goBack();
        }
      } else {
        // Register new user directly with Supabase
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

        logDebug('AuthScreen', 'Registration response', {
          user: data?.user?.email,
          session: !!data?.session,
        });

        if (data?.user && !data?.session) {
          Alert.alert(
            'Verification Email Sent',
            'Please check your email to verify your account. Click the verification link to complete signup.',
            [{ text: 'OK' }]
          );

          // Clear form
          setEmail('');
          setPassword('');
          setFirstName('');
          setLastName('');
          setPhone('');
        }
      }
    } catch (error) {
      logError('AuthScreen', error, {
        isLogin,
        email,
        firstName: isLogin ? null : firstName,
        lastName: isLogin ? null : lastName,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      logDebug('AuthScreen', 'Attempting Google auth');
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
        logDebug('AuthScreen', 'Google auth successful');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      logError('AuthScreen', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to sign in with Google. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[
      styles.container,
      colorScheme === 'dark' && styles.containerDark
    ]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={[
              styles.title,
              colorScheme === 'dark' && styles.titleDark
            ]}>
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </Text>
            <Text style={[
              styles.subtitle,
              colorScheme === 'dark' && styles.subtitleDark
            ]}>
              {isLogin
                ? 'Sign in to share your historical discoveries'
                : 'Join the community of history enthusiasts'}
            </Text>
          </View>

          <View style={styles.form}>
            {!isLogin && (
              <>
                <TextInput
                  style={[
                    styles.input,
                    colorScheme === 'dark' && styles.inputDark
                  ]}
                  placeholder="First Name"
                  placeholderTextColor="#64748b"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />

                <TextInput
                  style={[
                    styles.input,
                    colorScheme === 'dark' && styles.inputDark
                  ]}
                  placeholder="Last Name"
                  placeholderTextColor="#64748b"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />

                <TextInput
                  style={[
                    styles.input,
                    colorScheme === 'dark' && styles.inputDark
                  ]}
                  placeholder="Phone (optional)"
                  placeholderTextColor="#64748b"
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                />
              </>
            )}

            <TextInput
              style={[
                styles.input,
                colorScheme === 'dark' && styles.inputDark
              ]}
              placeholder="Email"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={[
                styles.input,
                colorScheme === 'dark' && styles.inputDark
              ]}
              placeholder="Password"
              placeholderTextColor="#64748b"
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
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isLogin ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={[
                styles.dividerText,
                colorScheme === 'dark' && styles.dividerTextDark
              ]}>
                or
              </Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleAuth}
            >
              <MaterialIcons name="google" size={24} color="#DB4437" />
              <Text style={styles.googleButtonText}>
                Continue with Google
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsLogin(!isLogin)}
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  containerDark: {
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginVertical: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  titleDark: {
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  subtitleDark: {
    color: '#94a3b8',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#0f172a',
  },
  inputDark: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 14,
  },
  dividerTextDark: {
    color: '#94a3b8',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  googleButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    color: '#3b82f6',
    fontSize: 14,
  },
  switchTextDark: {
    color: '#60a5fa',
  },
});

export default AuthScreen;
