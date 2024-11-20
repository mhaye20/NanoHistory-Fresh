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

    if (pointsError) throw pointsError;

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

    if (statsError) throw statsError;

    return { pointsData, statsData };
  } catch (error) {
    console.error('Error initializing user data:', error);
    throw error;
  }
};

// Get user's current points and level
export const getUserPointsAndLevel = async (userId) => {
  try {
    // Try to get existing points data
    let { data: pointsData, error: pointsError } = await supabase
      .from('user_points')
      .select('total_points, visit_streak, last_visit_date')
      .eq('user_id', userId)
      .single();

    // If no data exists, initialize it
    if (!pointsData) {
      const { pointsData: newPointsData } = await initializeUserData(userId);
      pointsData = newPointsData;
    }

    if (pointsError) throw pointsError;

    // Calculate level based on total points
    const level = LEVELS.find(l => 
      pointsData.total_points >= l.minPoints && 
      pointsData.total_points <= l.maxPoints
    );

    return {
      points: pointsData.total_points,
      streak: pointsData.visit_streak,
      lastVisit: pointsData.last_visit_date,
      level: level.level,
      title: level.title,
      nextLevel: level.level < LEVELS.length ? LEVELS[level.level] : null,
      minPoints: level.minPoints,
      maxPoints: level.maxPoints
    };
  } catch (error) {
    console.error('Error getting user points:', error);
    throw error;
  }
};

// Award points for an action
export const awardPoints = async (userId, action, locationId = null) => {
  try {
    const points = POINT_VALUES[action];
    if (!points) throw new Error('Invalid action type');

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

    if (error) throw error;

    // If no data returned, get current points
    if (!data || data.length === 0) {
      const { data: pointsData, error: pointsError } = await supabase
        .from('user_points')
        .select('total_points, visit_streak')
        .eq('user_id', userId)
        .single();

      if (pointsError) throw pointsError;
      return pointsData;
    }

    // Check for newly unlocked achievements
    await checkAchievements(userId);

    return data[0];
  } catch (error) {
    console.error('Error awarding points:', error);
    throw error;
  }
};

// Check and award achievements
export const checkAchievements = async (userId) => {
  try {
    // Ensure user data exists
    await initializeUserData(userId);

    // Get user's stats
    const { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('unique_visits, total_stories, total_photos, max_streak')
      .eq('user_id', userId)
      .single();

    if (statsError) throw statsError;

    // Get user's current achievements
    const { data: currentAchievements, error: achievementsError } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', userId);

    if (achievementsError) throw achievementsError;

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
        newAchievements.push({
          user_id: userId,
          achievement_id: id,
          earned_at: new Date().toISOString()
        });
      }
    }

    // Award new achievements
    if (newAchievements.length > 0) {
      const { error: insertError } = await supabase
        .from('user_achievements')
        .insert(newAchievements);

      if (insertError) throw insertError;

      // Award points for each new achievement
      for (const achievement of newAchievements) {
        await awardPoints(userId, 'ACHIEVEMENT_UNLOCK');
      }
    }

    return newAchievements;
  } catch (error) {
    console.error('Error checking achievements:', error);
    throw error;
  }
};

// Get user's achievements
export const getUserAchievements = async (userId) => {
  try {
    // Ensure user data exists
    await initializeUserData(userId);

    const { data, error } = await supabase
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', userId);

    if (error) throw error;

    return data.map(achievement => ({
      ...ACHIEVEMENTS[achievement.achievement_id],
      earned_at: achievement.earned_at
    }));
  } catch (error) {
    console.error('Error getting user achievements:', error);
    throw error;
  }
};
