import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import env from '../config/env';
import { generateVoice } from './ai';

const LOCATION_CACHE_KEY = '@tour_guide_last_location';

class TourGuideService {
  constructor() {
    this.sound = null;
    this.locationSubscription = null;
    this.currentRoute = null;
    this.isNavigating = false;
    this.lastAnnouncedWaypoint = null;
    this.announcementTimeout = null;
    this.lastKnownLocation = null;
  }

  async requestLocationPermissions() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }
  }

  async loadCachedLocation() {
    try {
      const cachedLocation = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
      if (cachedLocation) {
        this.lastKnownLocation = JSON.parse(cachedLocation);
        return this.lastKnownLocation;
      }
    } catch (error) {
      console.warn('Error loading cached location:', error);
    }
    return null;
  }

  async saveCachedLocation(location) {
    try {
      await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp
      }));
    } catch (error) {
      console.warn('Error saving cached location:', error);
    }
  }

  async getCurrentLocation() {
    try {
      // First try to get a quick fix with low accuracy
      const quickLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
        maximumAge: 10000 // Accept locations up to 10 seconds old
      });

      // Save this quick location
      if (quickLocation) {
        this.lastKnownLocation = {
          latitude: quickLocation.coords.latitude,
          longitude: quickLocation.coords.longitude
        };
        await this.saveCachedLocation(quickLocation);
      }

      // Start getting a more accurate location in the background
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      }).then(accurateLocation => {
        this.lastKnownLocation = {
          latitude: accurateLocation.coords.latitude,
          longitude: accurateLocation.longitude
        };
        this.saveCachedLocation(accurateLocation);
      }).catch(error => {
        console.warn('Error getting accurate location:', error);
      });

      // Return the quick location immediately
      return quickLocation;
    } catch (quickError) {
      console.warn('Error getting quick location:', quickError);
      
      // If quick location fails, try to use cached location
      const cachedLocation = await this.loadCachedLocation();
      if (cachedLocation) {
        return {
          coords: {
            latitude: cachedLocation.latitude,
            longitude: cachedLocation.longitude
          },
          timestamp: cachedLocation.timestamp
        };
      }

      // If all else fails, try one last time with high accuracy
      try {
        const fallbackLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });
        return fallbackLocation;
      } catch (fallbackError) {
        console.error('Error getting fallback location:', fallbackError);
        throw fallbackError;
      }
    }
  }

  async generateTourRoute(startLocation, endLocation, selectedTypes, customWaypoints = null) {
    try {
      let routePoints;
      
      if (customWaypoints) {
        // Ensure waypoints have required properties
        routePoints = customWaypoints.map(wp => {
          const latitude = wp.coordinate ? wp.coordinate.latitude : wp.latitude;
          const longitude = wp.coordinate ? wp.coordinate.longitude : wp.longitude;
          
          console.log('Processing waypoint:', {
            original: wp,
            extracted: { latitude, longitude }
          });
          
          return {
            ...wp,
            latitude: typeof latitude === 'string' ? parseFloat(latitude) : latitude,
            longitude: typeof longitude === 'string' ? parseFloat(longitude) : longitude
          };
        }).filter(wp => {
          const isValid = !isNaN(wp.latitude) && !isNaN(wp.longitude);
          if (!isValid) {
            console.warn('Invalid waypoint filtered out:', wp);
          }
          return isValid;
        });
      } else {
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

        // Transform and filter points based on selected types
        const eligiblePoints = historicalPoints
          .filter(location => {
            const storyTypes = location.ai_generated_stories?.[0]?.story_types || [];
            return selectedTypes.includes('all') || 
                   storyTypes.some(type => selectedTypes.includes(type.toLowerCase()));
          })
          .map(location => ({
            ...location,
            story: location.ai_generated_stories?.[0]?.content,
            story_types: location.ai_generated_stories?.[0]?.story_types || []
          }));

        // Calculate route corridor
        const directDistance = this.calculateDistance(startLocation, endLocation);
        const corridorWidth = Math.max(0.5, directDistance * 0.3); // 30% of direct distance, minimum 500m

        // Score and select optimal waypoints
        const scoredPoints = eligiblePoints
          .map(point => {
            const distanceFromLine = this.getDistanceFromLine(point, startLocation, endLocation);
            const distanceToStart = this.calculateDistance(point, startLocation);
            const distanceToEnd = this.calculateDistance(point, endLocation);
            const progression = this.calculateProgressionAlongRoute(point, startLocation, endLocation);
            
            // Score based on multiple factors
            const score = this.calculatePointScore(
              distanceToStart,
              distanceToEnd,
              distanceFromLine,
              directDistance,
              point,
              progression
            );

            return { ...point, score, progression };
          })
          .filter(point => {
            // Keep points within corridor and reasonable distance
            const withinCorridor = this.isPointInEnhancedCorridor(point, startLocation, endLocation, corridorWidth);
            const withinDistance = this.calculateDistance(point, startLocation) <= 50 &&
                                 this.calculateDistance(point, endLocation) <= 50;
            return withinCorridor && withinDistance;
          })
          .sort((a, b) => b.score - a.score);

        // Select points with good spacing
        const MIN_SPACING = 0.2; // 200m minimum spacing
        routePoints = [];
        let lastProgression = -0.2;

        for (const point of scoredPoints) {
          if (point.progression - lastProgression >= MIN_SPACING && routePoints.length < 10) {
            routePoints.push(point);
            lastProgression = point.progression;
          }
        }

        console.log('Selected waypoints:', {
          eligible: eligiblePoints.length,
          scored: scoredPoints.length,
          final: routePoints.length
        });
      }
      
      console.log('Route points after processing:', routePoints.map(p => ({
        latitude: p.latitude,
        longitude: p.longitude
      })));

      // Validate start and end locations
      const start = {
        latitude: typeof startLocation.latitude === 'string' ? parseFloat(startLocation.latitude) : startLocation.latitude,
        longitude: typeof startLocation.longitude === 'string' ? parseFloat(startLocation.longitude) : startLocation.longitude
      };

      const end = {
        latitude: typeof endLocation.latitude === 'string' ? parseFloat(endLocation.latitude) : endLocation.latitude,
        longitude: typeof endLocation.longitude === 'string' ? parseFloat(endLocation.longitude) : endLocation.longitude
      };

      if (isNaN(start.latitude) || isNaN(start.longitude) || 
          isNaN(end.latitude) || isNaN(end.longitude)) {
        throw new Error('Invalid start or end location coordinates');
      }

      console.log('Validated coordinates:', {
        start,
        end,
        waypointsCount: routePoints.length
      });

      // Remove duplicate waypoints and limit to 10 waypoints (Google Maps limit)
      const uniqueRoutePoints = routePoints.reduce((acc, point) => {
        const key = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
        if (!acc.has(key)) {
          acc.set(key, point);
        }
        return acc;
      }, new Map());

      const limitedRoutePoints = Array.from(uniqueRoutePoints.values()).slice(0, 10);

      console.log('Filtered waypoints:', {
        original: routePoints.length,
        afterDuplicates: uniqueRoutePoints.size,
        final: limitedRoutePoints.length,
        points: limitedRoutePoints
      });

      // Filter out waypoints that are too far from the route (more than 50km from start/end)
      const MAX_DISTANCE_KM = 50;
      const filteredRoutePoints = limitedRoutePoints.filter(point => {
        const distanceToStart = this.calculateDistance(point, start);
        const distanceToEnd = this.calculateDistance(point, end);
        const isWithinRange = distanceToStart <= MAX_DISTANCE_KM && distanceToEnd <= MAX_DISTANCE_KM;
        
        if (!isWithinRange) {
          console.log('Filtering out waypoint too far from route:', point);
        }
        return isWithinRange;
      });

      console.log('Distance-filtered waypoints:', {
        original: limitedRoutePoints.length,
        filtered: filteredRoutePoints.length
      });

      // Build waypoints parameter with better validation and route feasibility checks
      let validWaypoints = filteredRoutePoints
        .filter(point => {
          // Additional validation for each point
          const lat = parseFloat(point.latitude);
          const lng = parseFloat(point.longitude);
          const isValid = !isNaN(lat) && !isNaN(lng) && 
                        lat >= -90 && lat <= 90 && 
                        lng >= -180 && lng <= 180;
          if (!isValid) {
            console.warn('Invalid waypoint coordinates:', point);
          }
          return isValid;
        });

      // Calculate progression along route for each waypoint
      validWaypoints = validWaypoints.map(point => ({
        ...point,
        progression: this.calculateProgressionAlongRoute(point, start, end)
      }));

      // Sort waypoints by progression
      validWaypoints.sort((a, b) => a.progression - b.progression);

      // Ensure minimum spacing between waypoints (at least 500 meters)
      const MIN_SPACING_KM = 0.5;
      const spacedWaypoints = [];
      let lastPoint = null;

      for (const point of validWaypoints) {
        if (!lastPoint || this.calculateDistance(lastPoint, point) >= MIN_SPACING_KM) {
          spacedWaypoints.push(point);
          lastPoint = point;
        } else {
          console.log('Skipping waypoint too close to previous:', point.title);
        }
      }

      // Limit to 6 waypoints to ensure route feasibility
      validWaypoints = spacedWaypoints.slice(0, 6);

      console.log('Waypoint selection:', {
        afterSpacing: spacedWaypoints.length,
        final: validWaypoints.length,
        waypoints: validWaypoints.map(w => ({
          title: w.title,
          progression: w.progression,
          distance: this.getDistanceFromLine(w, start, end)
        }))
      });

      const waypointsParam = validWaypoints.length > 0 
        ? validWaypoints
            .map(point => {
              // Format with exactly 6 decimal places
              const lat = parseFloat(point.latitude).toFixed(6);
              const lng = parseFloat(point.longitude).toFixed(6);
              return `${lat},${lng}`;
            })
            .join('|')
        : '';

      // Build the full URL with proper URL encoding
      const apiUrl = new URL('https://maps.googleapis.com/maps/api/directions/json');
      
      // Format start and end with consistent precision
      const originParam = `${parseFloat(start.latitude).toFixed(6)},${parseFloat(start.longitude).toFixed(6)}`;
      const destParam = `${parseFloat(end.latitude).toFixed(6)},${parseFloat(end.longitude).toFixed(6)}`;
      
      apiUrl.searchParams.append('origin', originParam);
      apiUrl.searchParams.append('destination', destParam);
      
      if (waypointsParam) {
        // Let Google optimize the waypoint order to find a valid route
        apiUrl.searchParams.append('waypoints', `optimize:true|${waypointsParam.split('|').map(wp => `via:${wp}`).join('|')}`);
      }
      
      apiUrl.searchParams.append('mode', 'walking');
      apiUrl.searchParams.append('units', 'metric');
      apiUrl.searchParams.append('key', env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);

      const debugUrl = apiUrl.toString().replace(env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, 'API_KEY');
      console.log('API URL (without key):', debugUrl);
      console.log('Waypoints being used:', validWaypoints);

      try {
        const directionsResponse = await fetch(apiUrl.toString());
        const responseText = await directionsResponse.text();

        if (!directionsResponse.ok) {
          console.error('Directions API HTTP error:', directionsResponse.status, responseText);
          throw new Error(`Directions API HTTP error: ${directionsResponse.status}`);
        }

        let directionsData;
        try {
          directionsData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse directions response:', responseText.substring(0, 500));
          throw new Error(`Invalid response from directions API: ${responseText.substring(0, 100)}`);
        }

        if (directionsData.status !== 'OK') {
          console.error('Directions API error:', directionsData);
          throw new Error(`Failed to get route directions: ${directionsData.status} - ${directionsData.error_message || 'Unknown error'}`);
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
              distance: typeof step.distance === 'object' ? step.distance.text : (step.distance || '0.1 km'),
              distance_meters: step.distance?.value || 0,
              duration: typeof step.duration === 'object' ? step.duration.text : (step.duration || '1 min'),
              duration_seconds: step.duration?.value || 0,
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

        // Keep the original waypoints, just reorder them according to the API response
        const orderedWaypoints = waypointOrder.map(index => filteredRoutePoints[index]);

        // Generate route with waypoints, path, and instructions
        const totalDuration = directionsData.routes[0].legs.reduce((acc, leg) => {
          console.log('Leg duration:', leg.duration);
          return acc + (leg.duration?.value || 0);
        }, 0);

        console.log('Total duration in seconds:', totalDuration);

        const route = {
          start: startLocation,
          end: endLocation,
          waypoints: orderedWaypoints, // Use our ordered waypoints, not any from the API
          coordinates: routeCoordinates,
          instructions,
          totalDuration,
          totalDistance: directionsData.routes[0].legs.reduce((acc, leg) => acc + (leg.distance?.value || 0), 0),
          legs: directionsData.routes[0].legs
        };

        // Log route data for debugging
        console.log('Generated route:', {
          coordinatesCount: routeCoordinates.length,
          firstCoord: routeCoordinates[0],
          lastCoord: routeCoordinates[routeCoordinates.length - 1],
          waypointsCount: orderedWaypoints.length,
          waypoints: orderedWaypoints
        });

        this.currentRoute = route;
        return route;
      } catch (error) {
        console.error('Error generating tour route:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error generating tour route:', error);
      throw error;
    }
  }

  calculatePointScore(distanceFromStart, distanceFromEnd, distanceFromLine, directDistance, point, progression) {
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

    // Bonus for points with good progression
    score *= 1 + (progression - 0.5) * 0.2;

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
    // Project point onto line between start and end
    const startToEnd = {
      lat: end.latitude - start.latitude,
      lng: end.longitude - start.longitude
    };
    const startToPoint = {
      lat: point.latitude - start.latitude,
      lng: point.longitude - start.longitude
    };

    // Calculate dot product
    const dotProduct = startToPoint.lat * startToEnd.lat + startToPoint.lng * startToEnd.lng;
    const lineLength = startToEnd.lat * startToEnd.lat + startToEnd.lng * startToEnd.lng;

    // Get progression along line (0 = at start, 1 = at end)
    return Math.max(0, Math.min(1, dotProduct / lineLength));
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

  normalizeType(types, selectedTypes) {
    const normalizeType = (type) => {
      return type.toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2');
    };

    const normalizedPointTypes = types.map(normalizeType);
    const normalizedSelectedTypes = selectedTypes.map(normalizeType);

    return normalizedSelectedTypes.some(selectedType => 
      normalizedPointTypes.includes(selectedType)
    );
  }
}

export const tourGuideService = new TourGuideService();
