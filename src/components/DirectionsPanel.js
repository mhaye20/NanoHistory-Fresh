import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDuration, convertDistance } from '../utils/formatters';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DRAG_HANDLE_HEIGHT = 40;

const DirectionsPanel = ({ visible, onClose, route, initialUnit = 'km' }) => {
  console.log('DirectionsPanel received route with duration:', route?.totalDuration);
  const [unit, setUnit] = useState(initialUnit);
  const translateY = useRef(new Animated.Value(0)).current;
  const isClosing = useRef(false);
  const isDraggingHandle = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        // Only handle touches that start in the drag handle area
        const touchY = evt.nativeEvent.locationY;
        isDraggingHandle.current = touchY < DRAG_HANDLE_HEIGHT;
        return isDraggingHandle.current;
      },
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only handle vertical swipes from the drag handle
        return isDraggingHandle.current && gestureState.dy > 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (isDraggingHandle.current && gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!isDraggingHandle.current) return;
        
        if (gestureState.dy > SCREEN_HEIGHT * 0.2) {
          isClosing.current = true;
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            isClosing.current = false;
            isDraggingHandle.current = false;
            onClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
          }).start(() => {
            isDraggingHandle.current = false;
          });
        }
      },
      onPanResponderTerminate: () => {
        isDraggingHandle.current = false;
      },
    })
  ).current;

  useEffect(() => {
    if (visible && !isClosing.current) {
      translateY.setValue(0);
    }
    
    return () => {
      if (!isClosing.current) {
        translateY.setValue(0);
      }
    };
  }, [visible, translateY]);

  if (!visible || !route?.instructions?.length) {
    if (!isClosing.current) {
      translateY.setValue(0);
    }
    return null;
  }

  const toggleUnit = () => {
    setUnit(unit === 'km' ? 'mi' : 'km');
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.animatedContainer,
          {
            transform: [{ translateY }],
          },
        ]}
      >
        <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
          <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>
          <View style={styles.header}>
            <Text style={styles.title}>Directions</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity onPress={toggleUnit} style={styles.unitButton}>
                <Text style={styles.unitButtonText}>{unit.toUpperCase()}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.infoContainer}>
            <View style={styles.infoItem}>
              <MaterialIcons name="directions-walk" size={20} color="#3b82f6" />
              <Text style={styles.infoText}>
                {convertDistance(route.totalDistance, unit)}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <MaterialIcons name="schedule" size={20} color="#3b82f6" />
              <Text style={styles.infoText}>
                {formatDuration(route.totalDuration)}
              </Text>
            </View>
          </View>

          <ScrollView 
            style={styles.instructionsContainer}
            showsVerticalScrollIndicator={true}
          >
            {route.instructions.map((instruction, index) => (
              <View key={index} style={styles.instructionItem}>
                <MaterialIcons
                  name={instruction.maneuver || 'arrow-forward'}
                  size={24}
                  color={index === 0 ? '#3b82f6' : 'rgba(255, 255, 255, 0.6)'}
                  style={styles.instructionIcon}
                />
                <View style={styles.instructionTextContainer}>
                  <Text style={styles.instructionText}>
                    {instruction.text}
                  </Text>
                  {instruction.distance && (
                    <Text style={styles.distanceText}>
                      {convertDistance(instruction.distance_meters || 0, unit)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </BlurView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
    backgroundColor: 'transparent',
  },
  animatedContainer: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  blurContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    paddingBottom: 20,
  },
  dragHandleContainer: {
    height: DRAG_HANDLE_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  unitButton: {
    marginRight: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unitButtonText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  instructionsContainer: {
    padding: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  instructionIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  instructionTextContainer: {
    flex: 1,
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  distanceText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginTop: 4,
  },
});

export default DirectionsPanel;
