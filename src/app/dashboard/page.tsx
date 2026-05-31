'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import TeacherDashboard from '@/components/TeacherDashboard';
import StudentDashboard from '@/components/StudentDashboard';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ id: string, full_name: string, role: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }
      setLoading(false);
    };

    fetchUserAndProfile();
  }, [router]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>Loading...</div>;
  }

  if (!profile) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>Error loading profile.</div>;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--background)' }}>
      {profile.role === 'teacher' ? (
        <TeacherDashboard profileId={profile.id} />
      ) : (
        <StudentDashboard profileId={profile.id} />
      )}
    </div>
  );
}
