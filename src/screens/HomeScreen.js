import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const HomeScreen = ({ navigation }) => {
  return (
    <ImageBackground
      source={require('../../assets/splash-icon.png')}
      style={styles.background}
      blurRadius={2}
    >
      <StatusBar style="light" />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>NanoHistory</Text>
          <Text style={styles.subtitle}>
            Discover the hidden stories around you
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate('Explore')}
            >
              <Text style={styles.buttonText}>Start Exploring</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => navigation.navigate('AIGuide')}
            >
              <Text style={styles.buttonText}>AI Guide</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.outlineButton]}
              onPress={() => navigation.navigate('CreateStory')}
            >
              <Text style={[styles.buttonText, styles.outlineButtonText]}>
                Share Your Story
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#94a3b8',
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 300,
    gap: 16,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  secondaryButton: {
    backgroundColor: '#475569',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButtonText: {
    color: '#3b82f6',
  },
});

export default HomeScreen;