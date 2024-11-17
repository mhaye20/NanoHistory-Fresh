-- Enable PostGIS extension for location-based queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT),
    image_url TEXT,
    rating DECIMAL(3,2),
    visit_count INTEGER DEFAULT 0,
    historical_period VARCHAR(100),
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create stories table
CREATE TABLE IF NOT EXISTS stories (
    id BIGSERIAL PRIMARY KEY,
    location_id BIGINT REFERENCES locations(id),
    author_id UUID REFERENCES auth.users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    media_urls TEXT[],
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create AI generated stories table for caching
CREATE TABLE IF NOT EXISTS ai_generated_stories (
    id BIGSERIAL PRIMARY KEY,
    location_id BIGINT REFERENCES locations(id) UNIQUE,
    content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user contributions table
CREATE TABLE IF NOT EXISTS user_contributions (
    id BIGSERIAL PRIMARY KEY,
    location_id BIGINT REFERENCES locations(id),
    user_id UUID REFERENCES auth.users(id),
    content_type VARCHAR(50),
    text TEXT,
    media_urls TEXT[],
    tags TEXT[],
    ai_enhanced BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'pending_review',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Drop existing function if exists to avoid conflicts
DROP FUNCTION IF EXISTS calculate_distances(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);
DROP FUNCTION IF EXISTS calculate_distances(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

-- Function to calculate distances between points (using DOUBLE PRECISION for all numeric parameters)
CREATE OR REPLACE FUNCTION calculate_distances(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION DEFAULT 5000.0
)
RETURNS TABLE (
    id BIGINT,
    distance DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id,
        ST_Distance(
            l.location::geography,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        ) as distance
    FROM locations l
    WHERE ST_DWithin(
        l.location::geography,
        ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
        radius_meters
    )
    ORDER BY distance;
END;
$$ LANGUAGE plpgsql;

-- Function to increment visit count
CREATE OR REPLACE FUNCTION increment_visit_count(location_id BIGINT)
RETURNS void AS $$
BEGIN
    UPDATE locations
    SET visit_count = visit_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = location_id;
END;
$$ LANGUAGE plpgsql;

-- Create index for faster geospatial queries
CREATE INDEX IF NOT EXISTS locations_geography_idx ON locations USING GIST (location);

-- Create index for faster location lookups
CREATE INDEX IF NOT EXISTS stories_location_id_idx ON stories(location_id);
CREATE INDEX IF NOT EXISTS ai_stories_location_id_idx ON ai_generated_stories(location_id);

-- Update location geometry for existing records
UPDATE locations
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE location IS NULL;
