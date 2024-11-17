-- Add new columns to stories table
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS accuracy_score DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id) NOT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS stories_author_id_idx ON stories(author_id);
