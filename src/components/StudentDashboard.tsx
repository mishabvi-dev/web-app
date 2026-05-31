'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

export default function StudentDashboard({ profileId }: { profileId: string }) {
  const [activeTab, setActiveTab] = useState<'assignments' | 'materials' | 'feed' | 'qa' | 'leaderboard' | 'settings'>('assignments');
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState('Student');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  
  const [doubtContent, setDoubtContent] = useState('');
  const [doubtFile, setDoubtFile] = useState<File | null>(null);
  const [askingDoubt, setAskingDoubt] = useState(false);
  const [doubts, setDoubts] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');

  const [settingName, setSettingName] = useState('');
  const [settingRegNo, setSettingRegNo] = useState('');
  const [settingDepartment, setSettingDepartment] = useState('');
  const [settingLh, setSettingLh] = useState('');
  const [settingAvatarFile, setSettingAvatarFile] = useState<File | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    fetchInitialData();

    const channel = supabase.channel('realtime_notes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, (payload) => {
        setNotes((prev) => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    
    // Fetch Profile Name
    const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url, regno, department, lh').eq('id', profileId).single();
    if (profile) {
      setStudentName(profile.full_name);
      setSettingName(profile.full_name);
      setSettingRegNo(profile.regno || '');
      setSettingDepartment(profile.department || '');
      setSettingLh(profile.lh || '');
      setAvatarUrl(profile.avatar_url || '');
    }

    await Promise.all([
      fetchTasks(),
      fetchMySubmissions(),
      fetchNotes(),
      fetchDoubts(),
      fetchLeaderboard(),
      fetchMaterials()
    ]);
    
    setLoading(false);
  };

  const fetchMaterials = async () => {
    const { data } = await supabase.from('materials').select('*').order('created_at', { ascending: false });
    if (data) setMaterials(data);
  };

  const fetchTasks = async () => {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (data) setTasks(data);
  };

  const fetchMySubmissions = async () => {
    const { data } = await supabase.from('submissions').select('*').eq('student_id', profileId);
    if (data) {
      const subMap: Record<string, any> = {};
      data.forEach(sub => subMap[sub.task_id] = sub);
      setSubmissions(subMap);
    }
  };

  const fetchNotes = async () => {
    const { data } = await supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setNotes(data);
  };

  const fetchDoubts = async () => {
    const { data } = await supabase.from('doubts').select('*').eq('student_id', profileId).order('created_at', { ascending: false });
    if (data) setDoubts(data);
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase.from('submissions').select('student_id, points, profiles!student_id(full_name, avatar_url)').eq('verified', true);
    if (data) {
      const scores: Record<string, any> = {};
      data.forEach((sub: any) => {
        if (sub.points) {
          if (!scores[sub.student_id]) {
            scores[sub.student_id] = { id: sub.student_id, name: sub.profiles?.full_name || 'Unknown', points: 0, avatar: sub.profiles?.avatar_url };
          }
          scores[sub.student_id].points += sub.points;
        }
      });
      setLeaderboard(Object.values(scores).sort((a: any, b: any) => b.points - a.points));
    }
  };

  const handleAskDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doubtContent) return;

    setAskingDoubt(true);
    let finalUrl = null;

    if (doubtFile) {
      const fileExt = doubtFile.name.split('.').pop();
      const fileName = `${profileId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('doubts').upload(fileName, doubtFile);
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage.from('doubts').getPublicUrl(fileName);
        finalUrl = publicUrl;
      }
    }

    const { error } = await supabase.from('doubts').insert([
      { student_id: profileId, question: doubtContent, file_url: finalUrl }
    ]);

    setAskingDoubt(false);
    if (!error) {
      setDoubtContent('');
      setDoubtFile(null);
      fetchDoubts();
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    let finalAvatarUrl = avatarUrl;
    
    try {
      if (settingAvatarFile) {
        const fileExt = settingAvatarFile.name.split('.').pop();
        const fileName = `${profileId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, settingAvatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
        finalAvatarUrl = publicUrl;
      }
      const { error } = await supabase.from('profiles').update({ 
        full_name: settingName, 
        avatar_url: finalAvatarUrl,
        regno: settingRegNo,
        department: settingDepartment,
        lh: settingLh
      }).eq('id', profileId);
      if (error) throw error;
      setStudentName(settingName);
      setAvatarUrl(finalAvatarUrl);
      setSettingAvatarFile(null);
      alert("Profile updated successfully!");
    } catch (err: any) {
      alert("Error updating profile: " + err.message);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleFileUpload = async (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(taskId);

    const fileExt = file.name.split('.').pop();
    const fileName = `${profileId}-${taskId}-${Math.random()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('student_work')
      .upload(fileName, file);

    if (uploadError) {
      alert("Error uploading file: " + uploadError.message);
      setUploading(null);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('student_work')
      .getPublicUrl(fileName);

    const { error: dbError } = await supabase.from('submissions').insert([
      { task_id: taskId, student_id: profileId, file_url: publicUrl }
    ]);

    if (!dbError) {
      setSubmissions(prev => ({ ...prev, [taskId]: true }));
    }
    
    setUploading(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
      </div>
    );
  }

  // Calculate Metrics
  const totalTasks = tasks.length;
  const completedTasks = Object.keys(submissions).length;
  const pendingTasks = totalTasks - completedTasks;
  const progressPercentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const myRankIndex = leaderboard.findIndex(s => s.id === profileId);
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : null;
  const rankSuffix = myRank === 1 ? 'st' : myRank === 2 ? 'nd' : myRank === 3 ? 'rd' : 'th';

  return (
    <div className="dashboard-layout">
      
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="logo-container" style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '48px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '2rem' }}>🎓</span> WebDev LMS
        </div>

        <div className="sidebar-nav">
          <button className={`sidebar-link ${activeTab === 'assignments' ? 'active' : ''}`} onClick={() => setActiveTab('assignments')}>
             📚 Dashboard
          </button>
          <button className={`sidebar-link ${activeTab === 'feed' ? 'active' : ''}`} onClick={() => setActiveTab('feed')}>
             📢 Live Feed
          </button>
          <button className={`sidebar-link ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>
             📚 Study Material
          </button>
          <button className={`sidebar-link ${activeTab === 'qa' ? 'active' : ''}`} onClick={() => setActiveTab('qa')}>
             ❓ Private Q&A
          </button>
          <button className={`sidebar-link ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>
             🏆 Leaderboard
          </button>
          <button className={`sidebar-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
             ⚙️ Settings
          </button>
        </div>
        
        <button className="sidebar-link" onClick={async () => { await supabase.auth.signOut(); window.location.href='/login'; }}>
           🚪 Logout
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="glass-panel dashboard-main">
         
         {/* Top Header */}
         <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
           <input 
             type="text" 
             placeholder="Search tasks or materials..." 
             className="input-field" 
             style={{ width: '300px', marginBottom: 0, background: '#f8fafc', border: 'none', color: '#1e293b' }} 
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
           <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: '700', color: 'var(--foreground)' }}>{studentName}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Student</div>
              </div>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
              ) : (
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                  {studentName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
         </header>

         {/* Hero Section */}
         <section style={{ background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', borderRadius: '24px', padding: '40px', color: 'white', marginBottom: '32px', position: 'relative', overflow: 'hidden' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px' }}>
              Welcome back, {studentName.split(' ')[0]}! 👋
            </h1>
            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              {myRank ? `You are currently in ${myRank}${rankSuffix} place on the leaderboard! 🏆` : "Complete assignments to climb the leaderboard!"}
            </p>
            <div style={{ position: 'absolute', right: '40px', top: '50%', transform: 'translateY(-50%)', fontSize: '6rem', opacity: 0.2 }}>
              🎓
            </div>
         </section>

         {/* Metrics Grid */}
         {activeTab === 'assignments' && (
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
             <div className="task-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px' }}>
               <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '8px' }}>{completedTasks}</div>
               <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase' }}>Completed</div>
             </div>
             
             <div className="task-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px', border: '2px solid var(--primary)' }}>
               <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--accent)', marginBottom: '8px' }}>{pendingTasks}</div>
               <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase' }}>Pending</div>
             </div>
             
             <div className="task-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px' }}>
               <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '8px' }}>{doubts.length}</div>
               <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase' }}>Questions</div>
             </div>
           </div>
         )}

         {/* Tab Content Areas */}
         <div style={{ flexGrow: 1 }}>
          
          {/* Assignments Tab */}
          {activeTab === 'assignments' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {tasks.length === 0 ? <p style={{color: '#94a3b8', fontStyle: 'italic'}}>No tasks assigned yet.</p> : tasks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase())).map((task) => {
                const sub = submissions[task.id];
                return (
                <div key={task.id} className="task-card" style={{ borderLeft: sub ? (sub.verified ? '4px solid var(--success)' : '4px solid var(--accent)') : '4px solid #cbd5e1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{task.title}</h3>
                    {sub ? (
                      sub.verified ? (
                         <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>✓ Graded</span>
                      ) : (
                         <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>Under Review</span>
                      )
                    ) : task.due_date && new Date(task.due_date) < new Date() ? (
                      <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>OVERDUE</span>
                    ) : (
                      <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>Pending</span>
                    )}
                  </div>
                  
                  <p style={{ color: '#475569', fontSize: '0.95rem', marginBottom: '12px', lineHeight: '1.5' }}>{task.description}</p>
                  
                  {task.due_date && !sub && (
                    <div style={{ fontSize: '0.85rem', color: new Date(task.due_date) < new Date() ? 'var(--error)' : '#f59e0b', fontWeight: 'bold', marginBottom: '16px' }}>
                      Due: {new Date(task.due_date).toLocaleString()}
                    </div>
                  )}
                  
                  {sub ? (
                    sub.verified && (
                      <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sub.remark ? '8px' : '0' }}>
                           <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '0.9rem' }}>Grade:</span>
                           <span style={{ fontWeight: '800', color: 'var(--foreground)', fontSize: '1.1rem' }}>{sub.points} Points</span>
                        </div>
                        {sub.remark && (
                           <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '8px', padding: '8px', background: '#f8fafc', borderRadius: '8px' }}>
                              💬 {sub.remark}
                           </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        </div>
                        <div>
                          <span style={{ color: 'var(--primary)', fontWeight: '600' }}>Click to upload</span> or drag and drop
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>PDF, Image, Code File</div>
                        </div>
                        <input 
                          type="file" 
                          onChange={(e) => handleFileUpload(task.id, e)}
                          disabled={uploading === task.id}
                          style={{ display: 'none' }}
                        />
                      </label>
                      {uploading === task.id && <div style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}><span className="spinner"></span>Uploading securely...</div>}
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}

          {/* Feed Tab */}
          {activeTab === 'feed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '16px' }}>Live Teacher Broadcasts</h2>
              {notes.length === 0 ? <p style={{color: '#94a3b8', fontStyle: 'italic'}}>No announcements broadcasted yet.</p> : (
                <div style={{ overflowY: 'auto', maxHeight: '400px', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '8px' }}>
                  {notes.filter(n => n.content.toLowerCase().includes(searchQuery.toLowerCase())).map(note => (
                    <div key={note.id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', borderLeft: '3px solid var(--primary)', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                         <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>T</div>
                         <div>
                           <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>Teacher Broadcast</div>
                           <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(note.created_at).toLocaleString()}</div>
                         </div>
                      </div>
                      <p style={{ fontSize: '1.05rem', lineHeight: '1.6', color: '#1e293b' }}>{note.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Q&A Tab */}
          {activeTab === 'qa' && (
            <div>
              <form onSubmit={handleAskDoubt} style={{ marginBottom: '40px', background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '16px' }}>Ask a new question</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <textarea 
                    className="input-field" 
                    style={{ minHeight: '100px', background: 'white' }} 
                    placeholder="Describe what you need help with..." 
                    value={doubtContent}
                    onChange={e => setDoubtContent(e.target.value)}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                      <label style={{ color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', background: 'rgba(59, 130, 246, 0.1)', padding: '8px 16px', borderRadius: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                        Attach File
                        <input type="file" style={{ display: 'none' }} onChange={e => setDoubtFile(e.target.files?.[0] || null)} />
                      </label>
                      {doubtFile && <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{doubtFile.name}</span>}
                    </div>
                    <button type="submit" className="btn-primary" style={{ padding: '12px 32px' }} disabled={askingDoubt}>
                      {askingDoubt ? 'Sending...' : 'Submit Question'}
                    </button>
                  </div>
                </div>
              </form>

              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px' }}>Your Previous Questions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {doubts.map(doubt => (
                  <div key={doubt.id} className="task-card">
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1rem', fontWeight: 'bold' }}>
                        {studentName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flexGrow: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                           <span style={{ fontWeight: '600' }}>You</span>
                           <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(doubt.created_at).toLocaleDateString()}</span>
                        </div>
                        <p style={{ fontSize: '1rem', color: '#1e293b', lineHeight: '1.5' }}>{doubt.question}</p>
                        {doubt.file_url && (
                           <a href={doubt.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', background: 'rgba(59, 130, 246, 0.1)', padding: '8px 12px', borderRadius: '8px', fontWeight: '600' }}>
                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                             View your attachment
                           </a>
                        )}
                      </div>
                    </div>
                    
                    {doubt.resolved ? (
                      <div style={{ display: 'flex', gap: '12px', background: 'rgba(16, 185, 129, 0.05)', padding: '20px', borderRadius: '12px', borderLeft: '4px solid var(--success)', marginLeft: '32px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>T</div>
                        <div>
                           <div style={{ fontWeight: '600', color: 'var(--success)', marginBottom: '8px' }}>Teacher Reply</div>
                           <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: '1.5' }}>{doubt.answer}</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600', marginLeft: '52px' }}>
                        <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', borderTopColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#d97706', borderLeftColor: '#d97706' }}></span>
                        Awaiting Teacher's Reply...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '800', textAlign: 'center', marginBottom: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '2.5rem' }}>🏆</span> Class Leaderboard
              </h2>
              {leaderboard.length === 0 ? <p style={{textAlign: 'center', color: '#94a3b8', fontStyle: 'italic'}}>No graded assignments yet.</p> : (
                leaderboard.map((student, index) => {
                  let badge = '';
                  let bg = student.id === profileId ? 'rgba(59, 130, 246, 0.05)' : '#ffffff';
                  let border = student.id === profileId ? '1px solid var(--primary)' : '1px solid #e2e8f0';
                  
                  if (index === 0) { badge = '🥇'; bg = 'rgba(250, 204, 21, 0.1)'; border = '1px solid rgba(250, 204, 21, 0.3)'; }
                  else if (index === 1) { badge = '🥈'; bg = 'rgba(148, 163, 184, 0.1)'; border = '1px solid rgba(148, 163, 184, 0.3)'; }
                  else if (index === 2) { badge = '🥉'; bg = 'rgba(180, 83, 9, 0.1)'; border = '1px solid rgba(180, 83, 9, 0.3)'; }

                  return (
                    <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: bg, border: border, borderRadius: '16px', position: 'relative' }}>
                      {student.id === profileId && <div style={{ position: 'absolute', top: '-10px', right: '20px', background: 'var(--primary)', color: 'white', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>YOU</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', width: '40px', textAlign: 'center', color: index < 3 ? '#1e293b' : '#94a3b8' }}>
                          {badge || `#${index + 1}`}
                        </div>
                        {student.avatar ? (
                          <img src={student.avatar} alt={student.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.25rem', color: 'white' }}>
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#1e293b' }}>{student.name}</div>
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>
                        {student.points} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>pts</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Study Material Tab */}
          {activeTab === 'materials' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '24px' }}>📚 Study Material & Syllabus</h2>
                {materials.length === 0 ? <p style={{color: '#94a3b8', fontStyle: 'italic'}}>No materials have been shared yet.</p> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {materials.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase())).map((mat) => (
                      <div key={mat.id} className="task-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ fontWeight: '800', fontSize: '1.25rem', color: '#1e293b' }}>{mat.title}</div>
                        {mat.description && <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: '1.5', flexGrow: 1 }}>{mat.description}</p>}
                        {mat.url && (
                          <a href={mat.url} target="_blank" rel="noreferrer" style={{ marginTop: 'auto', color: 'white', background: 'var(--primary)', fontWeight: '600', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', padding: '10px 16px', borderRadius: '8px', gap: '8px' }}>
                            View Resource
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                          </a>
                        )}
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '8px' }}>Shared on: {new Date(mat.created_at).toLocaleDateString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

         {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>⚙️ Profile Settings</h2>
              <form onSubmit={handleUpdateProfile} style={{ background: '#f8fafc', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  {settingAvatarFile ? (
                    <img src={URL.createObjectURL(settingAvatarFile)} alt="Preview" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '2rem', color: 'white' }}>
                      {settingName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <label style={{ display: 'inline-block', background: 'white', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', color: '#1e293b' }}>
                      Upload New Photo
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setSettingAvatarFile(e.target.files ? e.target.files[0] : null)} />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="form-label">Full Name</label>
                  <input type="text" className="input-field" value={settingName} onChange={e => setSettingName(e.target.value)} required style={{ background: 'white', marginBottom: '0' }} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="form-label">Student Reg No / ID</label>
                    <input type="text" className="input-field" value={settingRegNo} onChange={e => setSettingRegNo(e.target.value)} placeholder="e.g. CS-204" style={{ background: 'white', marginBottom: '0' }} />
                  </div>
                  <div>
                    <label className="form-label">Department</label>
                    <input type="text" className="input-field" value={settingDepartment} onChange={e => setSettingDepartment(e.target.value)} placeholder="e.g. CSE" style={{ background: 'white', marginBottom: '0' }} />
                  </div>
                </div>

                <div>
                  <label className="form-label">LH (Lecture Hall)</label>
                  <input type="text" className="input-field" value={settingLh} onChange={e => setSettingLh(e.target.value)} placeholder="e.g. LH-1" style={{ background: 'white', marginBottom: '0' }} />
                </div>
                
                <button type="submit" className="btn-primary" disabled={isUpdatingProfile}>
                  {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

         </div>
      </main>
    </div>
  );
}
