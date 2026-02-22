-- Migration: Unify recipes and radar tables
-- Radar items become recipes with in_library = false
-- Week plan no longer stores inline recipe data

-- 1. Add in_library flag (existing recipes default to true)
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS in_library BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Copy radar items into recipes as in_library=false
-- Note: radar.cook_time maps to recipes.time_mins
INSERT INTO recipes (title, url, source, thumbnail_url, time_mins, ingredients, instructions, servings, in_library)
SELECT title, url, source, thumbnail_url, cook_time, ingredients, instructions, servings, FALSE
FROM radar;

-- 3. Drop radar table
DROP TABLE IF EXISTS radar;

-- 4. Remove week_plan inline columns (no longer needed)
ALTER TABLE week_plan DROP COLUMN IF EXISTS ingredients;
ALTER TABLE week_plan DROP COLUMN IF EXISTS cook_time;
ALTER TABLE week_plan DROP COLUMN IF EXISTS thumbnail_url;
ALTER TABLE week_plan DROP COLUMN IF EXISTS radar_title;
