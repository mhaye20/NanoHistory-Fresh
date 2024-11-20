-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_user_points_timestamp ON user_points;
DROP TRIGGER IF EXISTS update_user_stats_timestamp ON user_stats;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS award_points(UUID, INTEGER, BIGINT, TEXT);
DROP FUNCTION IF EXISTS update_timestamp();

-- Create user_points table
CREATE TABLE IF NOT EXISTS user_points (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0,
    visit_streak INTEGER DEFAULT 0,
    last_visit_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    unique_visits INTEGER DEFAULT 0,
    total_stories INTEGER DEFAULT 0,
    total_photos INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- Create visited_locations table to track unique visits
CREATE TABLE IF NOT EXISTS visited_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    location_id BIGINT REFERENCES locations(id) ON DELETE CASCADE,
    visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, location_id)
);

-- Create function to handle point awards
CREATE OR REPLACE FUNCTION award_points(
    p_user_id UUID,
    p_points INTEGER,
    p_location_id BIGINT DEFAULT NULL,
    p_action TEXT DEFAULT NULL
) RETURNS TABLE (
    total_points INTEGER,
    visit_streak INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_last_visit TIMESTAMP WITH TIME ZONE;
    v_streak INTEGER;
    v_is_new_visit BOOLEAN;
    v_points user_points%ROWTYPE;
BEGIN
    -- Initialize user_points if not exists
    INSERT INTO user_points (user_id, total_points, visit_streak)
    VALUES (p_user_id, p_points, 1)
    ON CONFLICT (user_id) DO UPDATE 
    SET total_points = user_points.total_points + EXCLUDED.total_points
    RETURNING * INTO v_points;

    -- Initialize user_stats if not exists
    INSERT INTO user_stats (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Handle location visit
    IF p_location_id IS NOT NULL THEN
        -- Check if this is a new visit
        SELECT NOT EXISTS (
            SELECT 1 FROM visited_locations
            WHERE user_id = p_user_id AND location_id = p_location_id
        ) INTO v_is_new_visit;

        IF v_is_new_visit THEN
            -- Record the visit
            INSERT INTO visited_locations (user_id, location_id)
            VALUES (p_user_id, p_location_id);

            -- Update unique visits count
            UPDATE user_stats
            SET unique_visits = unique_visits + 1
            WHERE user_id = p_user_id;
        END IF;

        -- Update visit streak
        SELECT up.last_visit_date, up.visit_streak
        INTO v_last_visit, v_streak
        FROM user_points up
        WHERE up.user_id = p_user_id;

        IF v_last_visit IS NULL OR 
           EXTRACT(EPOCH FROM (NOW() - v_last_visit)) > 86400 THEN
            -- More than 24 hours since last visit
            IF v_last_visit IS NULL OR 
               EXTRACT(EPOCH FROM (NOW() - v_last_visit)) > 172800 THEN
                -- Reset streak if more than 48 hours
                v_streak := 1;
            ELSE
                -- Increment streak
                v_streak := v_streak + 1;
            END IF;

            -- Update streak and last visit
            UPDATE user_points up
            SET visit_streak = v_streak,
                last_visit_date = NOW()
            WHERE up.user_id = p_user_id;

            -- Update max streak if needed
            UPDATE user_stats us
            SET max_streak = GREATEST(us.max_streak, v_streak)
            WHERE us.user_id = p_user_id;
        END IF;
    END IF;

    -- Update stats based on action
    IF p_action = 'STORY_SHARE' THEN
        UPDATE user_stats us
        SET total_stories = us.total_stories + 1
        WHERE us.user_id = p_user_id;
    ELSIF p_action = 'AR_PHOTO' THEN
        UPDATE user_stats us
        SET total_photos = us.total_photos + 1
        WHERE us.user_id = p_user_id;
    END IF;

    -- Return the current points and streak
    RETURN QUERY
    SELECT 
        up.total_points,
        up.visit_streak
    FROM user_points up
    WHERE up.user_id = p_user_id;
END;
$$;

-- Create trigger to update timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_points_timestamp
    BEFORE UPDATE ON user_points
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_user_stats_timestamp
    BEFORE UPDATE ON user_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Create RLS policies
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE visited_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own points" ON user_points;
DROP POLICY IF EXISTS "Users can read own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can read own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can read own visits" ON visited_locations;
DROP POLICY IF EXISTS "Users can initialize own points" ON user_points;
DROP POLICY IF EXISTS "Users can initialize own stats" ON user_stats;
DROP POLICY IF EXISTS "Users can initialize own achievements" ON user_achievements;
DROP POLICY IF EXISTS "Users can initialize own visits" ON visited_locations;
DROP POLICY IF EXISTS "Users can update own points" ON user_points;
DROP POLICY IF EXISTS "Users can update own stats" ON user_stats;

-- Users can read their own data
CREATE POLICY "Users can read own points"
    ON user_points FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can read own stats"
    ON user_stats FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can read own achievements"
    ON user_achievements FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can read own visits"
    ON visited_locations FOR SELECT
    USING (auth.uid() = user_id);

-- Allow users to initialize their own data
CREATE POLICY "Users can initialize own points"
    ON user_points FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can initialize own stats"
    ON user_stats FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can initialize own achievements"
    ON user_achievements FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can initialize own visits"
    ON visited_locations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own data through functions
CREATE POLICY "Users can update own points"
    ON user_points FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own stats"
    ON user_stats FOR UPDATE
    USING (auth.uid() = user_id);
