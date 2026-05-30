'use client';

import { supabase } from '@/utils/supabase';
import { useRouter } from 'next/navigation';

export default function Navbar({ role, name }: { role: string, name: string }) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <nav style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '20px 40px', 
      background: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{ fontWeight: '800', fontSize: '1.5rem', background: 'linear-gradient(to right, #f8fafc, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>
        WebDev LMS
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: '600', fontSize: '1rem' }}>{name}</div>
          <div style={{ fontSize: '0.75rem', color: role === 'teacher' ? 'var(--secondary)' : 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: '700', marginTop: '2px' }}>
            {role}
          </div>
        </div>
        <button 
          onClick={handleLogout}
          style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.3)', 
            color: 'var(--error)', 
            padding: '10px 20px', 
            borderRadius: '10px',
            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
