-- Add a locking toggle column to the materials table
ALTER TABLE public.materials
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
