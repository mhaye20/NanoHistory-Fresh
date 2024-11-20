-- Drop existing tables and functions if they exist
DROP FUNCTION IF EXISTS award_points(UUID, INTEGER, BIGINT, TEXT);
DROP TABLE IF EXISTS user_actions;
DROP TABLE IF EXISTS user_achievements;
DROP TABLE IF EXISTS user_stats;
DROP TABLE IF EXISTS user_points;

-- Create points tables
CREATE TABLE user_points (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    total_points INTEGER DEFAULT 0,
    visit_streak INTEGER DEFAULT 0,
    last_visit_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    unique_visits INTEGER DEFAULT 0,
    total_stories INTEGER DEFAULT 0,
    total_photos INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    achievement_id TEXT NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

CREATE TABLE user_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    location_id BIGINT REFERENCES locations(id),
    action_type TEXT NOT NULL,
    points INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to award points
CREATE OR REPLACE FUNCTION award_points(
    p_user_id UUID,
    p_points INTEGER,
    p_location_id BIGINT,
    p_action TEXT
) RETURNS TABLE (
    total_points INTEGER,
    visit_streak INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_last_visit TIMESTAMP WITH TIME ZONE;
    v_streak INTEGER;
BEGIN
    -- Initialize user data if not exists
    INSERT INTO user_points (user_id, total_points, visit_streak)
    VALUES (p_user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO user_stats (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Get last visit date
    SELECT last_visit_date, visit_streak 
    INTO v_last_visit, v_streak
    FROM user_points 
    WHERE user_id = p_user_id;

    -- Update streak if applicable
    IF p_action IN ('FIRST_VISIT', 'REVISIT') THEN
        IF v_last_visit IS NULL OR 
           EXTRACT(EPOCH FROM (NOW() - v_last_visit)) > 86400 THEN -- More than 24 hours
            -- Reset or increment streak
            IF v_last_visit IS NULL OR 
               EXTRACT(EPOCH FROM (NOW() - v_last_visit)) > 172800 THEN -- More than 48 hours
                v_streak := 1;
            ELSE
                v_streak := v_streak + 1;
            END IF;

            -- Update last visit date
            UPDATE user_points 
            SET last_visit_date = NOW(),
                visit_streak = v_streak
            WHERE user_id = p_user_id;

            -- Update max streak if applicable
            UPDATE user_stats
            SET max_streak = GREATEST(max_streak, v_streak)
            WHERE user_id = p_user_id;
        END IF;
    END IF;

    -- Update stats based on action
    CASE p_action
        WHEN 'FIRST_VISIT' THEN
            UPDATE user_stats 
            SET unique_visits = unique_visits + 1
            WHERE user_id = p_user_id;
        WHEN 'STORY_SHARE' THEN
            UPDATE user_stats 
            SET total_stories = total_stories + 1
            WHERE user_id = p_user_id;
        WHEN 'AR_PHOTO' THEN
            UPDATE user_stats 
            SET total_photos = total_photos + 1
            WHERE user_id = p_user_id;
    END CASE;

    -- Record the action
    INSERT INTO user_actions (user_id, location_id, action_type, points)
    VALUES (p_user_id, p_location_id, p_action, p_points);

    -- Award points
    UPDATE user_points 
    SET total_points = total_points + p_points
    WHERE user_id = p_user_id;

    -- Return updated points and streak
    RETURN QUERY
    SELECT up.total_points, up.visit_streak
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
