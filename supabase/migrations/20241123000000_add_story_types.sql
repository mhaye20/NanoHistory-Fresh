-- Add story_types column to ai_generated_stories table
ALTER TABLE ai_generated_stories
ADD COLUMN story_types text[] DEFAULT '{}';

-- Update existing rows to have an empty array
UPDATE ai_generated_stories
SET story_types = '{}'
WHERE story_types IS NULL;
