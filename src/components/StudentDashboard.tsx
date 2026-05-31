'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

export default function StudentDashboard({ profileId }: { profileId: string }) {
  const [activeTab, setActiveTab] = useState<'assignments' | 'feed' | 'qa' | 'leaderboard'>('assignments');
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState('Student');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  const [tasks, setTasks] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  
  const [doubtContent, setDoubtContent] = useState('');
  const [doubtFile, setDoubtFile] = useState<File | null>(null);
  const [askingDoubt, setAskingDoubt] = useState(false);
  const [doubts, setDoubts] = useState<any[]>([]);

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
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', profileId).single();
    if (profile) setStudentName(profile.full_name);

    await Promise.all([
      fetchTasks(),
      fetchMySubmissions(),
      fetchNotes(),
      fetchDoubts(),
      fetchLeaderboard()
    ]);
    
    setLoading(false);
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
      data.forEach(sub => {
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

    let fileUrl = null;
    
    if (doubtFile) {
      const fileExt = doubtFile.name.split('.').pop();
      const fileName = `doubt-${profileId}-${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('student_work')
        .upload(fileName, doubtFile);
        
      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from('student_work')
          .getPublicUrl(fileName);
        fileUrl = publicUrl;
      }
    }

    const { error } = await supabase.from('doubts').insert([{ student_id: profileId, question: doubtContent, file_url: fileUrl }]);
    if (!error) {
      setDoubtContent('');
      setDoubtFile(null);
      fetchDoubts();
    }
    setAskingDoubt(false);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Hero / Welcome Section */}
      <section className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', padding: '40px', gap: '24px' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px', letterSpacing: '-1px' }}>
            Welcome back, <span style={{ color: 'var(--primary)' }}>{studentName.split(' ')[0]}</span>! 👋
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>
            {myRank ? `You are currently in ${myRank}${rankSuffix} place on the leaderboard! 🏆` : "Complete assignments to climb the leaderboard!"}
          </p>
        </div>
        
        {/* Progress Circle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>Course Progress</div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#f8fafc' }}>{progressPercentage}%</div>
          </div>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: `conic-gradient(var(--primary) ${progressPercentage}%, rgba(255,255,255,0.05) ${progressPercentage}%)`, display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)' }}>
             <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#0f172a' }}></div>
          </div>
        </div>
      </section>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{completedTasks}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Completed Tasks</div>
          </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{pendingTasks}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Pending Tasks</div>
          </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{doubts.length}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Questions Asked</div>
          </div>
        </div>
      </div>

      {/* Main Tabbed Content */}
      <section className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        
        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
          <button 
            className={`tab-btn ${activeTab === 'assignments' ? 'active' : ''}`}
            onClick={() => setActiveTab('assignments')}
            style={{ flexShrink: 0 }}
          >
            📚 Assignments
          </button>
          <button 
            className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
          >
            <span style={{ position: 'relative', display: 'flex', height: '8px', width: '8px' }}>
              <span style={{ animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite', position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', background: 'var(--success)', opacity: '0.7' }}></span>
              <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: '8px', width: '8px', background: 'var(--success)' }}></span>
            </span>
            Live Feed
          </button>
          <button 
            className={`tab-btn ${activeTab === 'qa' ? 'active' : ''}`}
            onClick={() => setActiveTab('qa')}
            style={{ flexShrink: 0 }}
          >
            ❓ Private Q&A
          </button>
          <button 
            className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            🏆 Leaderboard
          </button>
        </div>

        {/* Tab Content Areas */}
        <div style={{ padding: '32px' }}>
          
          {/* Assignments Tab */}
          {activeTab === 'assignments' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {tasks.length === 0 ? <p style={{color: '#94a3b8', fontStyle: 'italic'}}>No tasks assigned yet.</p> : tasks.map(task => {
                const sub = submissions[task.id];
                return (
                <div key={task.id} className="task-card" style={{ borderLeft: sub ? (sub.verified ? '4px solid var(--success)' : '4px solid var(--accent)') : '4px solid #64748b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{task.title}</h3>
                    {sub ? (
                      sub.verified ? (
                         <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>✓ Graded</span>
                      ) : (
                         <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>Under Review</span>
                      )
                    ) : (
                      <span style={{ background: 'rgba(100, 116, 139, 0.1)', color: '#94a3b8', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>Pending</span>
                    )}
                  </div>
                  
                  <p style={{ color: '#cbd5e1', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.5' }}>{task.description}</p>
                  
                  {sub ? (
                    sub.verified && (
                      <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sub.remark ? '8px' : '0' }}>
                           <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '0.9rem' }}>Grade:</span>
                           <span style={{ fontWeight: '800', color: '#f8fafc', fontSize: '1.1rem' }}>{sub.points} Points</span>
                        </div>
                        {sub.remark && (
                           <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                              💬 {sub.remark}
                           </div>
                        )}
                      </div>
                    )
                  ) : (
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center' }}>
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
              {notes.length === 0 ? <p style={{color: '#94a3b8', fontStyle: 'italic'}}>No announcements broadcasted yet.</p> : notes.map(note => (
                <div key={note.id} style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '24px', borderRadius: '16px', borderLeft: '4px solid var(--primary)', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                     <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>T</div>
                     <div>
                       <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>Teacher Broadcast</div>
                       <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(note.created_at).toLocaleString()}</div>
                     </div>
                  </div>
                  <p style={{ fontSize: '1.05rem', lineHeight: '1.6', color: '#f8fafc' }}>{note.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Q&A Tab */}
          {activeTab === 'qa' && (
            <div>
              <form onSubmit={handleAskDoubt} style={{ marginBottom: '40px', background: 'rgba(0,0,0,0.2)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '16px' }}>Ask a new question</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <textarea 
                    className="input-field" 
                    style={{ minHeight: '100px' }} 
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
                      {doubtFile && <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{doubtFile.name}</span>}
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
                  <div key={doubt.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1rem', fontWeight: 'bold' }}>
                        {studentName.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flexGrow: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                           <span style={{ fontWeight: '600' }}>You</span>
                           <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(doubt.created_at).toLocaleDateString()}</span>
                        </div>
                        <p style={{ fontSize: '1rem', color: '#f8fafc', lineHeight: '1.5' }}>{doubt.question}</p>
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
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--success)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>T</div>
                        <div>
                           <div style={{ fontWeight: '600', color: 'var(--success)', marginBottom: '8px' }}>Teacher Reply</div>
                           <p style={{ fontSize: '0.95rem', color: '#e2e8f0', lineHeight: '1.5' }}>{doubt.answer}</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '600', marginLeft: '52px' }}>
                        <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px', borderTopColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#fbbf24', borderLeftColor: '#fbbf24' }}></span>
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
                  let bg = student.id === profileId ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)';
                  let border = student.id === profileId ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255,255,255,0.05)';
                  
                  if (index === 0) { badge = '🥇'; bg = 'rgba(250, 204, 21, 0.1)'; border = '1px solid rgba(250, 204, 21, 0.3)'; }
                  else if (index === 1) { badge = '🥈'; bg = 'rgba(148, 163, 184, 0.1)'; border = '1px solid rgba(148, 163, 184, 0.3)'; }
                  else if (index === 2) { badge = '🥉'; bg = 'rgba(180, 83, 9, 0.1)'; border = '1px solid rgba(180, 83, 9, 0.3)'; }

                  return (
                    <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: bg, border: border, borderRadius: '16px', position: 'relative' }}>
                      {student.id === profileId && <div style={{ position: 'absolute', top: '-10px', right: '20px', background: 'var(--primary)', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>YOU</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', width: '40px', textAlign: 'center', color: index < 3 ? '#fff' : '#64748b' }}>
                          {badge || `#${index + 1}`}
                        </div>
                        {student.avatar ? (
                          <img src={student.avatar} alt={student.name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.25rem', color: 'white' }}>
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#f8fafc' }}>{student.name}</div>
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>
                        {student.points} <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: '600' }}>pts</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

        </div>
      </section>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        
        .tab-btn {
          padding: 20px 32px;
          background: transparent;
          border: none;
          color: #94a3b8;
          font-family: inherit;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.3s ease;
        }
        
        .tab-btn:hover {
          color: #f8fafc;
          background: rgba(255,255,255,0.02);
        }
        
        .tab-btn.active {
          color: var(--primary);
          border-bottom: 3px solid var(--primary);
          background: rgba(59, 130, 246, 0.05);
        }
      `}} />
    </div>
  );
}
