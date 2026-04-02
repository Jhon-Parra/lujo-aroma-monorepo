-- Migration: Add firebase_user_id to usuarios table
-- Created: 2026-04-02
-- Description: Adds a new column to store the Firebase UID for Google Login integration.

ALTER TABLE usuarios 
ADD COLUMN firebase_user_id VARCHAR(128) DEFAULT NULL AFTER supabase_user_id;

-- Add index for fast logical lookups
CREATE UNIQUE INDEX idx_usuarios_firebase_uid ON usuarios(firebase_user_id);
