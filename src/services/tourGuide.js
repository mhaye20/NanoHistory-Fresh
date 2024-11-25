import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { supabase } from './supabase';
import env from '../config/env';
import { generateVoice } from './ai';

class TourGuideService {
  constructor() {
    this.sound = null;
    this.locationSubscription = null;
    this.currentRoute = null;
    this.isNavigating = false;
    this.lastAnnouncedWaypoint = null;
    this.announcementTimeout = null;
  }

  async requestLocationPermissions() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }
  }

  async getCurrentLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      return location;
    } catch (error) {
      console.error('Error getting location:', error);
      throw error;
    }
  }

  async generateTourRoute(startLocation, endLocation, selectedTypes) {
    try {
      // Get historical points between start and end locations
      const { data: historicalPoints, error } = await supabase
        .from('locations')
        .select(`
          *,
          ai_generated_stories (
            content,
            story_types
          )
        `);

      if (error) throw error;

      // Filter points by story types
      const filteredPoints = historicalPoints.filter(location => {
        const aiStory = location.ai_generated_stories?.[0];
        const storyTypes = aiStory?.story_types || [];
        
        return selectedTypes.includes('all') || 
          storyTypes.some(type => selectedTypes.includes(type));
      });

      // Filter points along the route
      const routePoints = this.filterPointsAlongRoute(
        startLocation,
        endLocation,
        filteredPoints
      );

      // Get route directions from Google Maps API
      const waypointsParam = routePoints.length > 0 ? 
        `&waypoints=${routePoints.map(point => `${point.latitude},${point.longitude}`).join('|')}` : '';

      const directionsResponse = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${
          startLocation.latitude
        },${startLocation.longitude}&destination=${
          endLocation.latitude
        },${endLocation.longitude}${waypointsParam}&mode=walking&units=metric&optimizeWaypoints=true&key=${env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );

      const directionsData = await directionsResponse.json();

      if (directionsData.status !== 'OK') {
        throw new Error('Failed to get route directions');
      }

      // Extract route coordinates and instructions from directions response
      let routeCoordinates = [];
      const instructions = [];
      const waypointOrder = directionsData.routes[0].waypoint_order;
      
      // Process each leg of the journey
      directionsData.routes[0].legs.forEach(leg => {
        // Process each step in the leg
        leg.steps.forEach(step => {
          if (step.polyline) {
            // Decode and add the polyline points for this step
            const decodedPoints = this.decodePolyline(step.polyline.points);
            
            // Add points to create a continuous path
            if (routeCoordinates.length === 0) {
              routeCoordinates.push(...decodedPoints);
            } else {
              // Skip first point if it's the same as the last point of previous step
              const startIndex = (
                decodedPoints[0].latitude === routeCoordinates[routeCoordinates.length - 1].latitude &&
                decodedPoints[0].longitude === routeCoordinates[routeCoordinates.length - 1].longitude
              ) ? 1 : 0;
              routeCoordinates.push(...decodedPoints.slice(startIndex));
            }
          }
          
          instructions.push({
            text: step.html_instructions.replace(/<[^>]*>/g, ''),
            distance: step.distance.text,
            duration: step.duration.text,
            maneuver: step.maneuver,
          });
        });
      });

      // Transform points to include story content and generate audio
      // Reorder waypoints according to the optimized order from Google Maps
      const orderedRoutePoints = waypointOrder.map(index => routePoints[index]);
      const transformedPoints = await Promise.all(orderedRoutePoints.map(async point => {
        const story = point.ai_generated_stories?.[0]?.content;
        const audioContent = story ? await generateVoice(
          `You are now approaching ${point.title}. ${story}`
        ) : null;

        return {
          id: point.id,
          title: point.title,
          description: point.description,
          latitude: point.latitude,
          longitude: point.longitude,
          story,
          story_types: point.ai_generated_stories?.[0]?.story_types || [],
          audioUrl: audioContent?.audioUrl
        };
      }));

      // Generate route with waypoints, path, and instructions
      const route = {
        start: startLocation,
        end: endLocation,
        waypoints: transformedPoints,
        coordinates: routeCoordinates,
        instructions,
        storyTypes: selectedTypes,
        totalDistance: directionsData.routes[0].legs.reduce((acc, leg) => acc + leg.distance.value, 0),
        totalDuration: directionsData.routes[0].legs.reduce((acc, leg) => acc + leg.duration.value, 0)
      };

      this.currentRoute = route;
      return route;
    } catch (error) {
      console.error('Error generating tour route:', error);
      throw error;
    }
  }

  // Decode Google Maps polyline encoding
  decodePolyline(encoded) {
    const points = [];
    let index = 0, lat = 0, lng = 0;

    while (index < encoded.length) {
      let shift = 0, result = 0;
      
      do {
        let b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (result & 0x20);
      
      lat += ((result & 1) ? ~(result >> 1) : (result >> 1));

      shift = 0;
      result = 0;
      
      do {
        let b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (result & 0x20);
      
      lng += ((result & 1) ? ~(result >> 1) : (result >> 1));

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  }

  filterPointsAlongRoute(start, end, points) {
    // Calculate route corridor
    const corridor = this.calculateRouteCorridor(start, end);
    
    // Filter points within corridor
    return points.filter(point => 
      this.isPointInCorridor(
        { latitude: point.latitude, longitude: point.longitude },
        corridor
      )
    );
  }

  calculateRouteCorridor(start, end) {
    // Create a buffer zone around the direct path
    const bufferDistance = 0.5; // 500 meters
    return {
      start,
      end,
      bufferDistance
    };
  }

  isPointInCorridor(point, corridor) {
    // Check if point is within buffer distance of the route line
    const distance = this.getDistanceFromLine(
      point,
      corridor.start,
      corridor.end
    );
    return distance <= corridor.bufferDistance;
  }

  getDistanceFromLine(point, lineStart, lineEnd) {
    // Calculate perpendicular distance from point to line
    const { latitude: x, longitude: y } = point;
    const { latitude: x1, longitude: y1 } = lineStart;
    const { latitude: x2, longitude: y2 } = lineEnd;
    
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;

    return Math.sqrt(dx * dx + dy * dy) * 111.32; // Convert to kilometers
  }

  async startNavigation() {
    if (!this.currentRoute) throw new Error('No route selected');
    
    this.isNavigating = true;
    
    // Start location tracking
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10
      },
      this.handleLocationUpdate.bind(this)
    );

    // Play initial navigation instruction
    if (this.currentRoute.instructions.length > 0) {
      await this.playAudioGuide(
        `Starting navigation. ${this.currentRoute.instructions[0].text}. Total distance is ${
          (this.currentRoute.totalDistance / 1000).toFixed(1)
        } kilometers, estimated time ${Math.round(this.currentRoute.totalDuration / 60)} minutes.`
      );
    }
  }

  async stopNavigation() {
    this.isNavigating = false;
    if (this.locationSubscription) {
      this.locationSubscription.remove();
    }
    if (this.sound) {
      await this.sound.stopAsync();
      await this.sound.unloadAsync();
    }
    if (this.announcementTimeout) {
      clearTimeout(this.announcementTimeout);
    }
  }

  async handleLocationUpdate(location) {
    if (!this.isNavigating || !this.currentRoute) return;

    const nearbyWaypoint = this.findNearbyPoint(
      location.coords,
      this.currentRoute.waypoints
    );

    if (nearbyWaypoint && nearbyWaypoint.id !== this.lastAnnouncedWaypoint) {
      this.lastAnnouncedWaypoint = nearbyWaypoint.id;
      
      // Clear any pending announcements
      if (this.announcementTimeout) {
        clearTimeout(this.announcementTimeout);
      }

      // Play waypoint audio after a short delay
      this.announcementTimeout = setTimeout(async () => {
        if (nearbyWaypoint.audioUrl) {
          await this.playAudioFromUrl(nearbyWaypoint.audioUrl);
        } else if (nearbyWaypoint.story) {
          await this.playAudioGuide(
            `You are now approaching ${nearbyWaypoint.title}. ${nearbyWaypoint.story}`
      );
        }
      }, 1000);
    }
  }

  findNearbyPoint(currentLocation, waypoints) {
    const threshold = 0.05; // 50 meters
    
    return waypoints.find(point => {
      const distance = this.calculateDistance(
        currentLocation,
        { latitude: point.latitude, longitude: point.longitude }
      );
      return distance <= threshold;
    });
  }

  calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(point2.latitude - point1.latitude);
    const dLon = this.deg2rad(point2.longitude - point1.longitude);
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(point1.latitude)) * Math.cos(this.deg2rad(point2.latitude)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  async playAudioGuide(text) {
    try {
      if (this.sound) {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      }

      const audioContent = await generateVoice(text);
      if (audioContent?.audioUrl) {
        await this.playAudioFromUrl(audioContent.audioUrl);
      }
    } catch (error) {
      console.error('Error playing audio guide:', error);
    }
  }

  async playAudioFromUrl(audioUrl) {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      
      this.sound = sound;
      
      // Clean up after playback finishes
      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.didJustFinish) {
          await sound.unloadAsync();
          this.sound = null;
        }
      });
    } catch (error) {
      console.error('Error playing audio from URL:', error);
    }
  }
}

export const tourGuideService = new TourGuideService();
