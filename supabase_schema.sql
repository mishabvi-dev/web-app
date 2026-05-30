-- LMS Platform Supabase Schema

-- 1. Create custom enum for roles
CREATE TYPE user_role AS ENUM ('teacher', 'student');

-- 2. Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- 3. Create tasks table
CREATE TABLE tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for tasks
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tasks are viewable by everyone." ON tasks FOR SELECT USING (true);
CREATE POLICY "Only teachers can insert tasks." ON tasks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

-- 4. Create notes table (for real-time)
CREATE TABLE notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notes are viewable by everyone." ON notes FOR SELECT USING (true);
CREATE POLICY "Only teachers can insert notes." ON notes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

-- **CRITICAL FOR REAL-TIME**: Enable logical replication for notes table
ALTER PUBLICATION supabase_realtime ADD TABLE notes;

-- 5. Create submissions table
CREATE TABLE submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT, -- Could be a URL or text
  file_url TEXT, -- Path to file in Supabase Storage
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for submissions
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
-- Teachers can see all submissions. Students can only see their own.
CREATE POLICY "Submissions viewable by teachers and owner." ON submissions FOR SELECT USING (
  auth.uid() = student_id OR 
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);
CREATE POLICY "Students can insert their own submissions." ON submissions FOR INSERT WITH CHECK (auth.uid() = student_id);

-- 6. Setup Storage for Submissions
-- IMPORTANT: You must also create a storage bucket manually in the Supabase Dashboard named "student_work"
-- and set its policies to allow authenticated uploads.
