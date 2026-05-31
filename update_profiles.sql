-- Add new columns to the `profiles` table for the revamped registration flow
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS regno text,
ADD COLUMN IF NOT EXISTS department text,
ADD COLUMN IF NOT EXISTS lh text;
