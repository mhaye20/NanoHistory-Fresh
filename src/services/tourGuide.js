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
      // First get all ai_generated_stories to ensure we have the story types
      const { data: aiStories, error: aiError } = await supabase
        .from('ai_generated_stories')
        .select('*');

      if (aiError) {
        console.error('Error fetching AI stories:', aiError);
        return;
      }

      // Create a map of location_id to story types for quick lookup
      const storyTypesMap = aiStories.reduce((acc, story) => {
        if (story.location_id && Array.isArray(story.story_types)) {
          acc[story.location_id] = story.story_types;
        }
        return acc;
      }, {});

      console.log('Story types map:', storyTypesMap);

      // Get all locations with their AI stories
      const { data: historicalPoints, error: locationsError } = await supabase
        .from('locations')
        .select(`
          *,
          ai_generated_stories (
            content,
            story_types
          )
        `);

      if (locationsError) throw locationsError;

      // Transform locations with proper story types
      const transformedPoints = historicalPoints.map(location => {
        const aiStory = location.ai_generated_stories?.[0];
        // Try to get story types from our map first, then fall back to the AI story
        const storyTypes = storyTypesMap[location.id] || aiStory?.story_types || [];

        return {
          id: location.id,
          title: location.title,
          description: location.description,
          latitude: location.latitude,
          longitude: location.longitude,
          story: aiStory?.content,
          story_types: storyTypes,
          ai_generated_stories: location.ai_generated_stories
        };
      });

      // Filter points by story types
      const filteredPoints = transformedPoints.filter(location => {
        if (!Array.isArray(location.story_types)) return false;

        // Convert camelCase to snake_case for comparison
        const normalizeType = (type) => {
          return type.toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2');
        };

        const normalizedPointTypes = location.story_types.map(normalizeType);
        const normalizedSelectedTypes = selectedTypes.map(normalizeType);

        console.log('Comparing types for location:', {
          id: location.id,
          title: location.title,
          originalTypes: location.story_types,
          normalizedPointTypes,
          normalizedSelectedTypes
        });

        const matches = selectedTypes.includes('all') || 
          normalizedSelectedTypes.some(selectedType => 
            normalizedPointTypes.includes(selectedType)
          );

        console.log('Location match result:', {
          id: location.id,
          title: location.title,
          matches
        });

        return matches;
      });

      console.log('Filtered points for route:', {
        total: filteredPoints.length,
        selectedTypes,
        points: filteredPoints.map(p => ({
          id: p.id,
          title: p.title,
          story_types: p.story_types
        }))
      });

      // Enhanced point selection along route
      const routePoints = this.selectOptimalWaypoints(
        startLocation,
        endLocation,
        filteredPoints
      );

      console.log('Selected waypoints:', {
        total: routePoints.length,
        points: routePoints.map(p => ({
          id: p.id,
          title: p.title,
          story_types: p.story_types
        }))
      });

      // Get route directions from Google Maps API
      const waypointsParam = routePoints.length > 0 ? 
        `&waypoints=optimize:true|${routePoints.map(point => `${point.latitude},${point.longitude}`).join('|')}` : '';

      const directionsResponse = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${
          startLocation.latitude
        },${startLocation.longitude}&destination=${
          endLocation.latitude
        },${endLocation.longitude}${waypointsParam}&mode=walking&units=metric&key=${env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );

      const directionsData = await directionsResponse.json();

      if (directionsData.status !== 'OK') {
        console.error('Directions API error:', directionsData);
        throw new Error('Failed to get route directions');
      }

      // Extract route coordinates and instructions from directions response
      let routeCoordinates = [];
      const instructions = [];
      const waypointOrder = directionsData.routes[0].waypoint_order;

      // Process each leg of the journey
      directionsData.routes[0].legs.forEach(leg => {
        // Add start location of leg
        routeCoordinates.push({
          latitude: leg.start_location.lat,
          longitude: leg.start_location.lng
        });

        // Process each step in the leg
        leg.steps.forEach(step => {
          // Add start location of step
          routeCoordinates.push({
            latitude: step.start_location.lat,
            longitude: step.start_location.lng
          });

          // Add end location of step
          routeCoordinates.push({
            latitude: step.end_location.lat,
            longitude: step.end_location.lng
          });

          instructions.push({
            text: step.html_instructions.replace(/<[^>]*>/g, ''),
            distance: step.distance.text,
            duration: step.duration.text,
            maneuver: step.maneuver,
          });
        });

        // Add end location of leg
        routeCoordinates.push({
          latitude: leg.end_location.lat,
          longitude: leg.end_location.lng
        });
      });

      // Remove duplicate consecutive points
      routeCoordinates = routeCoordinates.filter((point, index, array) => {
        if (index === 0) return true;
        const prevPoint = array[index - 1];
        return !(
          Math.abs(point.latitude - prevPoint.latitude) < 0.000001 &&
          Math.abs(point.longitude - prevPoint.longitude) < 0.000001
        );
      });

      // Transform points to include story content and generate audio
      const orderedRoutePoints = waypointOrder.map(index => routePoints[index]);
      

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

      // Log route data for debugging
      console.log('Generated route:', {
        coordinatesCount: routeCoordinates.length,
        firstCoord: routeCoordinates[0],
        lastCoord: routeCoordinates[routeCoordinates.length - 1],
        waypointsCount: transformedPoints.length,
        allCoords: routeCoordinates
      });

      this.currentRoute = route;
      return route;
    } catch (error) {
      console.error('Error generating tour route:', error);
      throw error;
    }
  }

  selectOptimalWaypoints(start, end, points) {
    // Calculate direct distance between start and end
    const directDistance = this.calculateDistance(start, end);
    
    // Increased buffer distance for wider coverage
    const bufferDistance = Math.max(0.5, directDistance * 0.3); // Min 500m, or 30% of direct distance
    
    // Get points within the enhanced corridor
    const corridorPoints = points.filter(point => 
      this.isPointInEnhancedCorridor(
        { latitude: point.latitude, longitude: point.longitude },
        start,
        end,
        bufferDistance
      )
    );

    // Create segments along the route for better distribution
    const numSegments = Math.max(4, Math.ceil(directDistance / 0.4)); // One segment every 400m
    const segments = new Array(numSegments).fill().map((_, i) => {
      const progress = i / (numSegments - 1);
      return {
        latitude: start.latitude + (end.latitude - start.latitude) * progress,
        longitude: start.longitude + (end.longitude - start.longitude) * progress,
        points: []
      };
    });

    // Assign points to nearest segment
    corridorPoints.forEach(point => {
      let minDist = Infinity;
      let bestSegment = 0;
      
      segments.forEach((segment, i) => {
        const dist = this.calculateDistance(
          { latitude: point.latitude, longitude: point.longitude },
          segment
        );
        if (dist < minDist) {
          minDist = dist;
          bestSegment = i;
        }
      });
      
      segments[bestSegment].points.push(point);
    });

    // Select best points from each segment
    const selectedPoints = [];
    segments.forEach(segment => {
      if (segment.points.length > 0) {
        // Score points in this segment
        const scoredPoints = segment.points.map(point => ({
          ...point,
          score: this.calculatePointScore(
            this.calculateDistance(start, point),
            this.calculateDistance(end, point),
            this.getDistanceFromLine(
              { latitude: point.latitude, longitude: point.longitude },
              start,
              end
            ),
            directDistance,
            point
          )
        }));

        // Sort by score and take the best point(s)
        scoredPoints.sort((a, b) => b.score - a.score);
        selectedPoints.push(scoredPoints[0]);
        
        // If segment has multiple good points with similar scores, include them
        for (let i = 1; i < scoredPoints.length && i < 2; i++) {
          if (scoredPoints[i].score > scoredPoints[0].score * 0.8) {
            selectedPoints.push(scoredPoints[i]);
          }
        }
      }
    });

    // Ensure we have enough points but not too many
    const maxPoints = Math.min(12, Math.max(6, Math.ceil(directDistance / 0.4)));
    return selectedPoints.slice(0, maxPoints);
  }

  calculatePointScore(distanceFromStart, distanceFromEnd, distanceFromLine, directDistance, point) {
    // Base score starts at 1
    let score = 1;

    // Favor points that create a natural progression (closer to middle of route)
    const progressionScore = 1 - Math.abs(
      (distanceFromStart / (distanceFromStart + distanceFromEnd)) - 0.5
    );
    score += progressionScore;

    // Less aggressive penalty for distance from direct route
    const deviationPenalty = Math.max(0.5, 1 - (distanceFromLine / (directDistance * 0.3)));
    score *= deviationPenalty;

    // Bonus for points with stories
    if (point.ai_generated_stories?.length > 0) {
      score *= 1.2;
    }

    return score;
  }

  isPointInEnhancedCorridor(point, start, end, bufferDistance) {
    // Calculate point's distance from the route line
    const distanceFromLine = this.getDistanceFromLine(point, start, end);
    
    // More lenient distance check
    if (distanceFromLine > bufferDistance) {
      return false;
    }

    // Calculate progression along route (0 to 1)
    const progression = this.calculateProgressionAlongRoute(point, start, end);
    
    // More lenient progression check to allow some deviation
    return progression >= -0.2 && progression <= 1.2;
  }

  calculateProgressionAlongRoute(point, start, end) {
    const { latitude: x, longitude: y } = point;
    const { latitude: x1, longitude: y1 } = start;
    const { latitude: x2, longitude: y2 } = end;
    
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    return lenSq !== 0 ? dot / lenSq : -1;
  }

  // Decode Google Maps polyline encoding
  decodePolyline(encoded) {
    if (!encoded) return [];

    const points = [];
    let index = 0, lat = 0, lng = 0;

    try {
      while (index < encoded.length) {
        let shift = 0, result = 0;
        
        do {
          let b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (result & 0x20);
        
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        
        do {
          let b = encoded.charCodeAt(index++) - 63;
          result |= (b & 0x1f) << shift;
          shift += 5;
        } while (result & 0x20);
        
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        const point = {
          latitude: lat * 1e-5,
          longitude: lng * 1e-5,
        };

        // Validate coordinates
        if (isFinite(point.latitude) && isFinite(point.longitude) &&
            Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180) {
          points.push(point);
        }
      }
    } catch (error) {
      console.error('Error decoding polyline:', error);
    }

    return points;
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
