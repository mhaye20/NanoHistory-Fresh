import { supabase } from './supabase';

// Point values for different actions
export const POINT_VALUES = {
  FIRST_VISIT: 100,
  REVISIT: 50,
  DAILY_STREAK: 100,
  STORY_SHARE: 300,
  AR_PHOTO: 200,
  FIRST_STORY: 500,
  ACHIEVEMENT_UNLOCK: 250,
};

// Achievement definitions
export const ACHIEVEMENTS = {
  FIRST_STEPS: {
    id: 'first_steps',
    title: 'First Steps',
    description: 'Visit your first historical location',
    points: 100,
    icon: 'directions-walk',
    requirement: 1,
    type: 'visits'
  },
  EXPLORER: {
    id: 'explorer',
    title: 'History Explorer',
    description: 'Visit 5 different historical locations',
    points: 250,
    icon: 'explore',
    requirement: 5,
    type: 'visits'
  },
  HISTORIAN: {
    id: 'historian',
    title: 'Master Historian',
    description: 'Visit 20 different historical locations',
    points: 500,
    icon: 'history-edu',
    requirement: 20,
    type: 'visits'
  },
  STORYTELLER: {
    id: 'storyteller',
    title: 'Storyteller',
    description: 'Share your first story',
    points: 200,
    icon: 'create',
    requirement: 1,
    type: 'stories'
  },
  PHOTOGRAPHER: {
    id: 'photographer',
    title: 'History Photographer',
    description: 'Take 5 AR photos',
    points: 300,
    icon: 'camera',
    requirement: 5,
    type: 'photos'
  },
  DEDICATED: {
    id: 'dedicated',
    title: 'Dedicated Explorer',
    description: 'Maintain a 7-day visit streak',
    points: 400,
    icon: 'star',
    requirement: 7,
    type: 'streak'
  }
};

// Level definitions
export const LEVELS = [
  { level: 1, title: 'Novice Explorer', minPoints: 0, maxPoints: 1000 },
  { level: 2, title: 'History Enthusiast', minPoints: 1001, maxPoints: 2500 },
  { level: 3, title: 'Time Traveler', minPoints: 2501, maxPoints: 5000 },
  { level: 4, title: 'History Master', minPoints: 5001, maxPoints: 10000 },
  { level: 5, title: 'Legendary Historian', minPoints: 10001, maxPoints: Infinity }
];

// Initialize user data
const initializeUserData = async (userId) => {
  console.log('Initializing user data for:', userId);
  try {
    // Initialize user_points
    const { data: pointsData, error: pointsError } = await supabase
      .from('user_points')
      .upsert([{
        user_id: userId,
        total_points: 0,
        visit_streak: 0,
        last_visit_date: null
      }], { onConflict: 'user_id' })
      .select()
      .single();

    if (pointsError) {
      console.error('Error initializing points:', pointsError);
      throw pointsError;
    }

    console.log('Points data initialized:', pointsData);

    // Initialize user_stats
    const { data: statsData, error: statsError } = await supabase
      .from('user_stats')
      .upsert([{
        user_id: userId,
        unique_visits: 0,
        total_stories: 0,
        total_photos: 0,
        max_streak: 0
      }], { onConflict: 'user_id' })
      .select()
      .single();

    if (statsError) {
      console.error('Error initializing stats:', statsError);
      throw statsError;
    }

    console.log('Stats data initialized:', statsData);
    return { pointsData, statsData };
  } catch (error) {
    console.error('Error in initializeUserData:', error);
    throw error;
  }
};

// Get user's current points and level
export const getUserPointsAndLevel = async (userId) => {
  console.log('Getting points and level for user:', userId);
  try {
    // Try to get existing points data
    let { data: pointsData, error: pointsError } = await supabase
      .from('user_points')
      .select('total_points, visit_streak, last_visit_date')
      .eq('user_id', userId)
      .single();

    // If no data exists, initialize it
    if (!pointsData) {
      console.log('No points data found, initializing...');
      const { pointsData: newPointsData } = await initializeUserData(userId);
      pointsData = newPointsData;
    }

    if (pointsError) {
      console.error('Error getting points:', pointsError);
      throw pointsError;
    }

    console.log('Retrieved points data:', pointsData);

    // Calculate level based on total points
    const level = LEVELS.find(l => 
      pointsData.total_points >= l.minPoints && 
      pointsData.total_points <= l.maxPoints
    );

    const result = {
      points: pointsData.total_points,
      streak: pointsData.visit_streak,
      lastVisit: pointsData.last_visit_date,
      level: level.level,
      title: level.title,
      nextLevel: level.level < LEVELS.length ? LEVELS[level.level] : null,
      minPoints: level.minPoints,
      maxPoints: level.maxPoints
    };

    console.log('Calculated user level data:', result);
    return result;
  } catch (error) {
    console.error('Error in getUserPointsAndLevel:', error);
    throw error;
  }
};

// Award points for an action
export const awardPoints = async (userId, action, locationId = null, userLocation = null) => {
  console.log('Awarding points:', { userId, action, locationId });
  try {
    const points = POINT_VALUES[action];
    if (!points) {
      console.error('Invalid action type:', action);
      throw new Error('Invalid action type');
    }

    // For location-based actions, verify user's location
    if (locationId && userLocation) {
      console.log('Checking location:', { locationId, userLocation });
      const atLocation = await isAtLocation(
        locationId,
        userLocation.coords.latitude,
        userLocation.coords.longitude
      );

      if (!atLocation) {
        console.log('User not at location');
        throw new Error('User not at location');
      }
    }

    // Ensure user data exists
    await initializeUserData(userId);

    // Call the award_points function
    const { data, error } = await supabase.rpc(
      'award_points',
      { 
        p_user_id: userId,
        p_points: points,
        p_location_id: locationId,
        p_action: action
      }
    );

    if (error) {
      console.error('Error in award_points RPC:', error);
      throw error;
    }

    console.log('Points awarded:', data);

    // If no data returned, get current points
    if (!data || data.length === 0) {
      console.log('No data returned from award_points, fetching current points');
      const { data: pointsData, error: pointsError } = await supabase
        .from('user_points')
        .select('total_points, visit_streak')
        .eq('user_id', userId)
        .single();

      if (pointsError) {
        console.error('Error getting points after award:', pointsError);
        throw pointsError;
      }

      console.log('Current points data:', pointsData);
      return pointsData;
    }

    // Check for newly unlocked achievements
    await checkAchievements(userId);

    return data[0];
  } catch (error) {
    console.error('Error in awardPoints:', error);
    throw error;
  }
};

// Check and award achievements
export const checkAchievements = async (userId) => {
  console.log('Checking achievements for user:', userId);
  try {
    // Ensure user data exists
    await initializeUserData(userId);

    // Get user's stats
    const { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('unique_visits, total_stories, total_photos, max_streak')
      .eq('user_id', userId)
      .single();

    if (statsError) {
      console.error('Error getting user stats:', statsError);
      throw statsError;
    }

    console.log('User stats:', stats);

    // Get user's current achievements
    const { data: currentAchievements, error: achievementsError } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId);

    if (achievementsError) {
      console.error('Error getting current achievements:', achievementsError);
      throw achievementsError;
    }

    console.log('Current achievements:', currentAchievements);

    const earnedIds = currentAchievements.map(a => a.achievement_id);
    const newAchievements = [];

    // Check each achievement
    for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
      if (earnedIds.includes(id)) continue;

      let earned = false;
      switch (achievement.type) {
        case 'visits':
          earned = stats.unique_visits >= achievement.requirement;
          break;
        case 'stories':
          earned = stats.total_stories >= achievement.requirement;
          break;
        case 'photos':
          earned = stats.total_photos >= achievement.requirement;
          break;
        case 'streak':
          earned = stats.max_streak >= achievement.requirement;
          break;
      }

      if (earned) {
        console.log('New achievement earned:', id);
        newAchievements.push({
          user_id: userId,
          achievement_id: id,
          earned_at: new Date().toISOString()
        });
      }
    }

    // Award new achievements
    if (newAchievements.length > 0) {
      console.log('Awarding new achievements:', newAchievements);
      const { error: insertError } = await supabase
        .from('user_achievements')
        .insert(newAchievements);

      if (insertError) {
        console.error('Error inserting achievements:', insertError);
        throw insertError;
      }

      // Award points for each new achievement
      for (const achievement of newAchievements) {
        await awardPoints(userId, 'ACHIEVEMENT_UNLOCK');
      }
    }

    return newAchievements;
  } catch (error) {
    console.error('Error in checkAchievements:', error);
    throw error;
  }
};

// Get user's achievements
export const getUserAchievements = async (userId) => {
  console.log('Getting achievements for user:', userId);
  try {
    // Ensure user data exists
    await initializeUserData(userId);

    const { data, error } = await supabase
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', userId);

    if (error) {
      console.error('Error getting achievements:', error);
      throw error;
    }

    console.log('Retrieved achievements:', data);

    return data.map(achievement => ({
      ...ACHIEVEMENTS[achievement.achievement_id],
      earned_at: achievement.earned_at
    }));
  } catch (error) {
    console.error('Error in getUserAchievements:', error);
    throw error;
  }
};

// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

// Check if user is at location
const isAtLocation = async (locationId, userLat, userLon) => {
  console.log('Checking if user is at location:', { locationId, userLat, userLon });
  try {
    const { data: location, error } = await supabase
      .from('locations')
      .select('latitude, longitude')
      .eq('id', locationId)
      .single();

    if (error) {
      console.error('Error getting location:', error);
      throw error;
    }
    if (!location) {
      console.log('Location not found');
      return false;
    }

    console.log('Location data:', location);

    const distance = calculateDistance(
      userLat,
      userLon,
      location.latitude,
      location.longitude
    );

    console.log('Distance to location:', distance);

    // Return true if within 100 meters
    return distance <= 100;
  } catch (error) {
    console.error('Error in isAtLocation:', error);
    return false;
  }
};
