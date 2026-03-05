-- Add check_duration_seconds column to track how long each rig check took
ALTER TABLE rig_checks ADD COLUMN IF NOT EXISTS check_duration_seconds INTEGER DEFAULT NULL;
