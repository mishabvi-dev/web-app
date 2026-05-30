'use client';

import { useState } from 'react';
import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Basic logic for secret access code
    const role = accessCode === 'TEACHER_ACCESS' ? 'teacher' : 'student';

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
      const { error: profileError } = await supabase.from('profiles').insert([
        {
          id: authData.user.id,
          full_name: fullName,
          role: role,
        }
      ]);

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
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
        <h1 style={{ marginBottom: '8px', textAlign: 'center', fontWeight: '800', fontSize: '2.25rem', letterSpacing: '-1px' }}>Join the Platform</h1>
        <p style={{ marginBottom: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '1rem' }}>Create an account to continue</p>
        
        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <label className="form-label">Full Name</label>
          <input
            type="text"
            className="input-field"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="John Doe"
          />

          <label className="form-label">Email Address</label>
          <input
            type="email"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />

          <label className="form-label">Password</label>
          <input
            type="password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            minLength={6}
          />

          <label className="form-label">Teacher Access Code (Optional)</label>
          <input
            type="text"
            className="input-field"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="Leave blank if you are a student"
          />

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', marginTop: '16px', padding: '14px' }}
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

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
