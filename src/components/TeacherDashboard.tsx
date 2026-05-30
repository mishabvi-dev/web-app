'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

export default function TeacherDashboard({ profileId }: { profileId: string }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'grading' | 'qa' | 'roster'>('overview');
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState('Teacher');

  const [tasks, setTasks] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  
  const [noteContent, setNoteContent] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  
  const [students, setStudents] = useState<any[]>([]);
  const [studentError, setStudentError] = useState<string | null>(null);
  
  const [doubts, setDoubts] = useState<any[]>([]);
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, { points: string, remark: string }>>({});

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
    if (profile) setTeacherName(profile.full_name);

    await Promise.all([
      fetchTasks(),
      fetchSubmissions(),
      fetchNotes(),
      fetchStudents(),
      fetchDoubts()
    ]);
    
    setLoading(false);
  };

  const fetchTasks = async () => {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
    if (data) setTasks(data);
  };

  const fetchSubmissions = async () => {
    const { data } = await supabase
      .from('submissions')
      .select('*, profiles!student_id(full_name), tasks!task_id(title)')
      .order('submitted_at', { ascending: false });
    if (data) setSubmissions(data);
  };

  const fetchNotes = async () => {
    const { data } = await supabase.from('notes').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setNotes(data);
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase.from('profiles').select('id, full_name, role');
    if (error) {
       setStudentError(error.message);
    }
    if (data) {
       const studentUsers = data.filter(u => u.role === 'student' || u.role === 'Student');
       if (studentUsers.length === 0 && data.length > 0) {
         setStudentError(`Found ${data.length} users, but none have role 'student'. Roles found: ${data.map(u => u.role).join(', ')}`);
       }
       setStudents(studentUsers);
    }
  };

  const fetchDoubts = async () => {
    const { data } = await supabase.from('doubts').select('*, profiles!student_id(full_name)').order('created_at', { ascending: false });
    if (data) setDoubts(data);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || !newTaskDesc) return;

    const { error } = await supabase.from('tasks').insert([
      { title: newTaskTitle, description: newTaskDesc, created_by: profileId }
    ]);
    
    if (!error) {
      setNewTaskTitle('');
      setNewTaskDesc('');
      fetchTasks();
    }
  };

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent) return;

    const { error } = await supabase.from('notes').insert([
      { content: noteContent, created_by: profileId }
    ]);
    
    if (!error) {
      setNoteContent('');
    }
  };

  const handleReplyDoubt = async (doubtId: string) => {
    const reply = replyContent[doubtId];
    if (!reply) return;
    const { error } = await supabase.from('doubts').update({ answer: reply, resolved: true }).eq('id', doubtId);
    if (!error) {
      setReplyContent(prev => ({ ...prev, [doubtId]: '' }));
      fetchDoubts();
    }
  };

  const handleGradeSubmission = async (submissionId: string) => {
    const grade = grades[submissionId];
    if (!grade || !grade.points) return;
    
    const { error } = await supabase.from('submissions').update({
      verified: true,
      points: parseInt(grade.points),
      remark: grade.remark || ''
    }).eq('id', submissionId);

    if (!error) {
      fetchSubmissions();
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
      </div>
    );
  }

  // Calculate Metrics
  const ungradedSubmissions = submissions.filter(s => !s.verified).length;
  const unresolvedDoubts = doubts.filter(d => !d.resolved).length;
  const totalStudents = students.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Hero / Welcome Section */}
      <section className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)', padding: '40px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px', letterSpacing: '-1px' }}>
          Welcome back, <span style={{ color: 'var(--primary)' }}>{teacherName.split(' ')[0]}</span>! 👋
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>
          {(ungradedSubmissions > 0 || unresolvedDoubts > 0) 
            ? `You have ${ungradedSubmissions} submissions to grade and ${unresolvedDoubts} questions to answer.` 
            : "You're all caught up! The class is running smoothly."}
        </p>
      </section>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', background: ungradedSubmissions > 0 ? 'rgba(245, 158, 11, 0.05)' : '' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: ungradedSubmissions > 0 ? 'var(--accent)' : '' }}>{ungradedSubmissions}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>To Grade</div>
          </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', background: unresolvedDoubts > 0 ? 'rgba(239, 68, 68, 0.05)' : '' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: unresolvedDoubts > 0 ? 'var(--error)' : '' }}>{unresolvedDoubts}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Open Questions</div>
          </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: '800' }}>{totalStudents}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Active Students</div>
          </div>
        </div>
      </div>

      {/* Main Tabbed Content */}
      <section className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        
        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', overflowX: 'auto', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            style={{ flexShrink: 0 }}
          >
            📊 Overview & Tools
          </button>
          <button 
            className={`tab-btn ${activeTab === 'grading' ? 'active' : ''}`}
            onClick={() => setActiveTab('grading')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
          >
            📥 Grading Inbox
            {ungradedSubmissions > 0 && (
              <span style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{ungradedSubmissions}</span>
            )}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'qa' ? 'active' : ''}`}
            onClick={() => setActiveTab('qa')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
          >
            🙋 Q&A
            {unresolvedDoubts > 0 && (
              <span style={{ background: 'var(--error)', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{unresolvedDoubts}</span>
            )}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
            onClick={() => setActiveTab('roster')}
            style={{ flexShrink: 0 }}
          >
            👥 Roster
          </button>
        </div>

        {/* Tab Content Areas */}
        <div style={{ padding: '32px' }}>
          
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
              
              {/* Assign Task */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>📝 Assign New Task</h2>
                <form onSubmit={handleCreateTask} style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <input 
                    className="input-field" 
                    placeholder="Task Title (e.g., Build a Responsive Navbar)" 
                    value={newTaskTitle} 
                    onChange={e => setNewTaskTitle(e.target.value)} 
                  />
                  <textarea 
                    className="input-field" 
                    placeholder="Detailed instructions and requirements..." 
                    rows={5}
                    value={newTaskDesc} 
                    onChange={e => setNewTaskDesc(e.target.value)} 
                  />
                  <button type="submit" className="btn-primary" style={{ width: '100%' }}>Create Assignment</button>
                </form>
              </div>

              {/* Broadcast Note */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.5rem', fontWeight: '700' }}>
                  <span style={{ position: 'relative', display: 'flex', height: '10px', width: '10px' }}>
                    <span style={{ animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite', position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', background: 'var(--success)', opacity: '0.7' }}></span>
                    <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: '10px', width: '10px', background: 'var(--success)' }}></span>
                  </span>
                  Live Broadcast
                </h2>
                
                <form onSubmit={handlePostNote} style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    className="input-field" 
                    style={{ marginBottom: 0, flexGrow: 1 }} 
                    placeholder="Send a live update to all students..." 
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                  />
                  <button type="submit" className="btn-primary" style={{ padding: '0 24px' }}>Send</button>
                </form>

                <div style={{ overflowY: 'auto', maxHeight: '300px', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '8px' }}>
                  {notes.map(note => (
                    <div key={note.id} style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '16px', borderRadius: '12px', borderLeft: '3px solid var(--primary)' }}>
                      <p style={{ fontSize: '0.95rem', lineHeight: '1.5', color: '#f8fafc' }}>{note.content}</p>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px', textAlign: 'right', fontWeight: '600' }}>
                        {new Date(note.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Grading Inbox Tab */}
          {activeTab === 'grading' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {submissions.length === 0 ? <p style={{color: '#94a3b8', fontStyle: 'italic'}}>No submissions yet.</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  {submissions.map((sub) => (
                    <div key={sub.id} className="task-card" style={{ borderLeft: sub.verified ? '4px solid var(--success)' : '4px solid var(--accent)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#f8fafc' }}>{sub.profiles?.full_name || 'Student'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {new Date(sub.submitted_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '16px', marginTop: '4px' }}>Assignment: {sub.tasks?.title}</div>
                      
                      {sub.file_url && (
                        <a href={sub.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '20px', background: 'rgba(59, 130, 246, 0.1)', padding: '6px 12px', borderRadius: '6px', fontWeight: '600' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                          View Student File
                        </a>
                      )}

                      {sub.verified ? (
                        <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sub.remark ? '12px' : '0' }}>
                            <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              Graded
                            </span>
                            <span style={{ fontWeight: '800', color: '#f8fafc', fontSize: '1.1rem' }}>{sub.points} Points</span>
                          </div>
                          {sub.remark && (
                             <div style={{ fontSize: '0.9rem', color: '#cbd5e1', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                               💬 {sub.remark}
                             </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: '600' }}>Evaluate this submission:</div>
                          <input 
                            type="number" 
                            placeholder="Points awarded (e.g. 10)" 
                            className="input-field" 
                            value={grades[sub.id]?.points || ''} 
                            onChange={e => setGrades(prev => ({...prev, [sub.id]: { ...prev[sub.id], points: e.target.value }}))} 
                            style={{ marginBottom: 0 }} 
                          />
                          <textarea 
                            placeholder="Constructive feedback... (optional)" 
                            className="input-field" 
                            rows={3} 
                            value={grades[sub.id]?.remark || ''} 
                            onChange={e => setGrades(prev => ({...prev, [sub.id]: { ...prev[sub.id], remark: e.target.value }}))} 
                            style={{ marginBottom: 0 }} 
                          />
                          <button onClick={() => handleGradeSubmission(sub.id)} className="btn-primary" style={{ padding: '12px', fontWeight: '700' }}>
                            Verify & Submit Grade
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Q&A Tab */}
          {activeTab === 'qa' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {doubts.length === 0 ? <p style={{color: '#94a3b8', fontStyle: 'italic'}}>No questions asked yet.</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  {doubts.map(doubt => (
                    <div key={doubt.id} className="task-card" style={{ borderLeft: doubt.resolved ? '4px solid var(--success)' : '4px solid var(--error)' }}>
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1rem', fontWeight: 'bold' }}>
                          {(doubt.profiles?.full_name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                             <span style={{ fontWeight: '600' }}>{doubt.profiles?.full_name || 'Student'}</span>
                             <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(doubt.created_at).toLocaleDateString()}</span>
                          </div>
                          <p style={{ fontSize: '1rem', color: '#f8fafc', lineHeight: '1.5' }}>{doubt.question}</p>
                          {doubt.file_url && (
                             <a href={doubt.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '12px', background: 'rgba(59, 130, 246, 0.1)', padding: '8px 12px', borderRadius: '8px', fontWeight: '600' }}>
                               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                               View attachment
                             </a>
                          )}
                        </div>
                      </div>
                      
                      {doubt.resolved ? (
                        <div style={{ display: 'flex', gap: '12px', background: 'rgba(16, 185, 129, 0.05)', padding: '20px', borderRadius: '12px', borderLeft: '4px solid var(--success)', marginLeft: '32px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--success)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>T</div>
                          <div>
                             <div style={{ fontWeight: '600', color: 'var(--success)', marginBottom: '8px' }}>Your Reply</div>
                             <p style={{ fontSize: '0.95rem', color: '#e2e8f0', lineHeight: '1.5' }}>{doubt.answer}</p>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginLeft: '32px' }}>
                          <textarea 
                            className="input-field" 
                            style={{ marginBottom: 0, minHeight: '80px' }} 
                            placeholder="Write your answer..." 
                            value={replyContent[doubt.id] || ''}
                            onChange={e => setReplyContent(prev => ({ ...prev, [doubt.id]: e.target.value }))}
                          />
                          <button 
                            onClick={() => handleReplyDoubt(doubt.id)} 
                            className="btn-primary" 
                            style={{ padding: '10px 24px', alignSelf: 'flex-end', fontWeight: '600' }}
                          >
                            Reply & Resolve
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Roster Tab */}
          {activeTab === 'roster' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {studentError && <div style={{ color: 'red', background: 'rgba(255,0,0,0.1)', padding: '16px', borderRadius: '8px' }}>Error fetching students: {studentError}</div>}
              {students.length === 0 && !studentError ? <p style={{color: '#94a3b8', fontStyle: 'italic'}}>No students registered yet.</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                  {students.map((student) => (
                    <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.5rem', color: 'white' }}>
                        {student.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#f8fafc' }}>{student.full_name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: '600', marginTop: '4px' }}>Active Student</div>
                      </div>
                    </div>
                  ))}
                </div>
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
