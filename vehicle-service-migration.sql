-- Smart Rig Check: Vehicle In-Service Migration
-- Run this once in the Supabase SQL Editor

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS in_service BOOLEAN NOT NULL DEFAULT false;
