'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Register() {
  const [role, setRole] = useState<'student' | 'teacher' | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regNo, setRegNo] = useState('');
  const [department, setDepartment] = useState('');
  const [lh, setLh] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (role === 'teacher' && accessCode !== 'TEACHER_ACCESS') {
      setError("Invalid Teacher Access Code.");
      setLoading(false);
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // If successful sign up, create the profile record
    if (authData.user) {
      const profileData: any = {
        id: authData.user.id,
        full_name: fullName,
        role: role,
        regno: regNo,
      };

      if (role === 'student') {
        profileData.department = department;
        profileData.lh = lh;
      }

      const { error: profileError } = await supabase.from('profiles').insert([profileData]);

      if (profileError) {
        setError("Account created, but failed to set profile. " + profileError.message);
        setLoading(false);
      } else {
        router.push('/dashboard');
      }
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '40px' }}>
        <h1 style={{ marginBottom: '8px', textAlign: 'center', fontWeight: '800', fontSize: '2.25rem', letterSpacing: '-1px' }}>Join the Platform</h1>
        <p style={{ marginBottom: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '1rem' }}>
          {role === null ? 'Select your role to continue' : `Creating a ${role === 'teacher' ? 'Teacher' : 'Student'} account`}
        </p>
        
        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        {role === null ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button 
              className="btn-primary" 
              onClick={() => setRole('student')}
              style={{ padding: '20px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
            >
              🎓 I am a Student
            </button>
            <button 
              className="btn-primary" 
              onClick={() => setRole('teacher')}
              style={{ padding: '20px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', background: 'var(--secondary)' }}
            >
              👨‍🏫 I am a Teacher
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="form-label">Full Name</label>
                <input type="text" className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="John Doe" />
              </div>
              <div>
                <label className="form-label">Reg No / ID</label>
                <input type="text" className="input-field" value={regNo} onChange={(e) => setRegNo(e.target.value)} required placeholder="e.g. CS2024-001" />
              </div>
            </div>

            <label className="form-label">Email Address</label>
            <input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />

            <label className="form-label">Password</label>
            <input type="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" minLength={6} />

            {role === 'student' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="form-label">Department</label>
                  <input type="text" className="input-field" value={department} onChange={(e) => setDepartment(e.target.value)} required placeholder="e.g. CSE" />
                </div>
                <div>
                  <label className="form-label">LH (Lecture Hall)</label>
                  <input type="text" className="input-field" value={lh} onChange={(e) => setLh(e.target.value)} required placeholder="e.g. LH-1" />
                </div>
              </div>
            )}

            {role === 'teacher' && (
              <div>
                <label className="form-label">Teacher Access Code</label>
                <input type="text" className="input-field" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} required placeholder="Enter secret code" />
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button 
                type="button" 
                onClick={() => setRole(null)} 
                style={{ padding: '14px 20px', background: '#f1f5f9', border: 'none', borderRadius: '12px', color: '#64748b', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Back
              </button>
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ flexGrow: 1, padding: '14px' }}
                disabled={loading}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </div>
          </form>
        )}

        <p style={{ marginTop: '32px', textAlign: 'center', fontSize: '0.95rem', color: '#94a3b8' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--primary)', fontWeight: '700' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
