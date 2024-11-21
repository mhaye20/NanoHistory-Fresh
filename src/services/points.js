import { createClient } from '@supabase/supabase-js';
import env from '../config/env';

// Initialize admin client with service role key for database operations
const adminClient = createClient(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

// Point values for different actions
export const POINT_VALUES = {
  FIRST_VISIT: 25,        
  REVISIT: 10,          
  DAILY_STREAK: 50,     
  STORY_SHARE: 150,     
  AR_PHOTO: 35,         
  FIRST_STORY: 200,     
  ACHIEVEMENT_UNLOCK: 100, 
};

// Achievement definitions
export const ACHIEVEMENTS = {
  FIRST_STEPS: {
    id: 'first_steps',
    title: 'First Steps',
    description: 'Visit your first historical location',
    points: 50,           // Reduced from 100
    icon: 'directions-walk',
    requirement: 1,
    type: 'visits'
  },
  EXPLORER: {
    id: 'explorer',
    title: 'History Explorer',
    description: 'Visit 5 different historical locations',
    points: 100,          // Reduced from 250
    icon: 'explore',
    requirement: 5,
    type: 'visits'
  },
  HISTORIAN: {
    id: 'historian',
    title: 'Master Historian',
    description: 'Visit 20 different historical locations',
    points: 250,          // Reduced from 500
    icon: 'history-edu',
    requirement: 20,
    type: 'visits'
  },
  STORYTELLER: {
    id: 'storyteller',
    title: 'Storyteller',
    description: 'Share your first story',
    points: 100,          // Reduced from 200
    icon: 'create',
    requirement: 1,
    type: 'stories'
  },
  PHOTOGRAPHER: {
    id: 'photographer',
    title: 'History Photographer',
    description: 'Take 5 AR photos',
    points: 150,          // Reduced from 300
    icon: 'camera',
    requirement: 5,
    type: 'photos'
  },
  DEDICATED: {
    id: 'dedicated',
    title: 'Dedicated Explorer',
    description: 'Maintain a 7-day visit streak',
    points: 200,          // Reduced from 400
    icon: 'star',
    requirement: 7,
    type: 'streak'
  }
};

// Level definitions - adjusted thresholds to match new point values
export const LEVELS = [
  { level: 1, title: 'Novice Explorer', minPoints: 0, maxPoints: 250 },      // Reduced from 1000
  { level: 2, title: 'History Enthusiast', minPoints: 251, maxPoints: 750 }, // Reduced from 2500
  { level: 3, title: 'Time Traveler', minPoints: 751, maxPoints: 1500 },     // Reduced from 5000
  { level: 4, title: 'History Master', minPoints: 1501, maxPoints: 3000 },   // Reduced from 10000
  { level: 5, title: 'Legendary Historian', minPoints: 3001, maxPoints: Infinity }
];

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
export const isAtLocation = async (locationId, userLat, userLon) => {
  console.log('Checking if user is at location:', { locationId, userLat, userLon });
  try {
    const { data: location, error } = await adminClient
      .from('locations')
      .select('latitude, longitude, ai_generated_stories')
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

    // Return true if within 100 meters and has AI-generated stories
    return distance <= 100 && location.ai_generated_stories?.length > 0;
  } catch (error) {
    console.error('Error in isAtLocation:', error);
    return false;
  }
};

// Initialize user data
const initializeUserData = async (userId) => {
  console.log('Initializing user data for:', userId);
  try {
    // Check if user_points exists first
    const { data: existingPoints, error: checkError } = await adminClient
      .from('user_points')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // Not found error
      console.error('Error checking existing points:', checkError);
      throw checkError;
    }

    let pointsData = existingPoints;

    // Only initialize if no existing data
    if (!existingPoints) {
      const { data: newPointsData, error: pointsError } = await adminClient
        .from('user_points')
        .insert([{
          user_id: userId,
          total_points: 0,
          visit_streak: 0,
          last_visit_date: null
        }])
        .select()
        .single();

      if (pointsError) {
        console.error('Error initializing points:', pointsError);
        throw pointsError;
      }

      console.log('Points data initialized:', newPointsData);
      pointsData = newPointsData;
    } else {
      console.log('Using existing points data:', existingPoints);
    }

    // Check if user_stats exists
    const { data: existingStats, error: statsCheckError } = await adminClient
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (statsCheckError && statsCheckError.code !== 'PGRST116') { // Not found error
      console.error('Error checking existing stats:', statsCheckError);
      throw statsCheckError;
    }

    let statsData = existingStats;

    // Only initialize if no existing data
    if (!existingStats) {
      const { data: newStatsData, error: statsError } = await adminClient
        .from('user_stats')
        .insert([{
          user_id: userId,
          unique_visits: 0,
          total_stories: 0,
          total_photos: 0,
          max_streak: 0
        }])
        .select()
        .single();

      if (statsError) {
        console.error('Error initializing stats:', statsError);
        throw statsError;
      }

      console.log('Stats data initialized:', newStatsData);
      statsData = newStatsData;
    } else {
      console.log('Using existing stats data:', existingStats);
    }

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
    // First try to initialize the user data
    await initializeUserData(userId);

    // Now get the points data
    const { data: pointsData, error: pointsError } = await adminClient
      .from('user_points')
      .select('total_points, visit_streak, last_visit_date')
      .eq('user_id', userId)
      .single();

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

    // Only verify location for FIRST_VISIT and REVISIT actions
    if ((action === 'FIRST_VISIT' || action === 'REVISIT') && locationId && userLocation) {
      console.log('Checking location for visit:', { locationId, userLocation });
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

    // Get current points
    const { data: currentData, error: currentError } = await adminClient
      .from('user_points')
      .select('total_points')
      .eq('user_id', userId)
      .single();

    if (currentError) {
      console.error('Error getting current points:', currentError);
      throw currentError;
    }

    // Calculate new points
    const currentPoints = currentData?.total_points || 0;
    const newPoints = currentPoints + points;
    console.log('Points calculation:', { currentPoints, pointsToAdd: points, newPoints });

    // Record action first
    const { error: actionError } = await adminClient
      .from('user_actions')
      .insert([{
        user_id: userId,
        location_id: locationId,
        action_type: action,
        points: points,
        created_at: new Date().toISOString()
      }]);

    if (actionError) {
      console.error('Error recording action:', actionError);
      throw actionError;
    }

    console.log('Action recorded successfully');

    // Update points
    const { data: pointsData, error: pointsError } = await adminClient
      .from('user_points')
      .update({ 
        total_points: newPoints,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (pointsError) {
      console.error('Error updating points:', pointsError);
      throw pointsError;
    }

    console.log('Points updated successfully:', pointsData);

    // Update stats if needed
    if (action === 'STORY_SHARE') {
      const { data: currentStats, error: statsError } = await adminClient
        .from('user_stats')
        .select('total_stories')
        .eq('user_id', userId)
        .single();

      if (statsError) {
        console.error('Error getting current stats:', statsError);
        throw statsError;
      }

      const newTotalStories = (currentStats?.total_stories || 0) + 1;
      const { error: updateStatsError } = await adminClient
        .from('user_stats')
        .update({ 
          total_stories: newTotalStories,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateStatsError) {
        console.error('Error updating stats:', updateStatsError);
      } else {
        console.log('Stats updated successfully');
      }
    }

    // Verify the points were actually updated
    const { data: verifyData, error: verifyError } = await adminClient
      .from('user_points')
      .select('total_points')
      .eq('user_id', userId)
      .single();

    if (verifyError) {
      console.error('Error verifying points update:', verifyError);
    } else {
      console.log('Points verification:', verifyData);
    }

    // Check for achievements after awarding points
    await checkAchievements(userId);

    return pointsData;
  } catch (error) {
    console.error('Error in awardPoints:', error);
    throw error;
  }
};

// Get user's achievements
export const getUserAchievements = async (userId) => {
  console.log('Getting achievements for user:', userId);
  try {
    // Ensure user data exists
    await initializeUserData(userId);

    const { data, error } = await adminClient
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

// Check and award achievements
export const checkAchievements = async (userId) => {
  console.log('Checking achievements for user:', userId);
  try {
    // Ensure user data exists
    await initializeUserData(userId);

    // Get user's stats
    const { data: stats, error: statsError } = await adminClient
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
    const { data: currentAchievements, error: achievementsError } = await adminClient
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
      const { error: insertError } = await adminClient
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
