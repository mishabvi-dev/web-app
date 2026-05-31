'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

export default function TeacherDashboard({ profileId }: { profileId: string }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'assignments' | 'grading' | 'qa' | 'roster' | 'leaderboard' | 'materials' | 'settings'>('overview');
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState('Teacher');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  const [tasks, setTasks] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  
  const [noteContent, setNoteContent] = useState('');
  const [notes, setNotes] = useState<any[]>([]);
  
  const [students, setStudents] = useState<any[]>([]);
  const [studentError, setStudentError] = useState<string | null>(null);
  
  const [doubts, setDoubts] = useState<any[]>([]);
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, { points: string, remark: string }>>({});

  const [materials, setMaterials] = useState<any[]>([]);
  const [newMaterialTitle, setNewMaterialTitle] = useState('');
  const [newMaterialDesc, setNewMaterialDesc] = useState('');
  const [newMaterialUrl, setNewMaterialUrl] = useState('');
  const [newMaterialFile, setNewMaterialFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const [settingName, setSettingName] = useState('');
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
    const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', profileId).single();
    if (profile) {
      setTeacherName(profile.full_name);
      setSettingName(profile.full_name);
      setAvatarUrl(profile.avatar_url || '');
    }

    await Promise.all([
      fetchTasks(),
      fetchSubmissions(),
      fetchNotes(),
      fetchStudents(),
      fetchDoubts(),
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
    const { data, error } = await supabase.from('profiles').select('id, full_name, role, student_class, avatar_url');
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

    const taskData: any = { title: newTaskTitle, description: newTaskDesc, created_by: profileId };
    if (newTaskDueDate) {
      taskData.due_date = new Date(newTaskDueDate).toISOString();
    }

    const { error } = await supabase.from('tasks').insert([taskData]);
    
    if (!error) {
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskDueDate('');
      fetchTasks();
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
      const { error } = await supabase.from('profiles').update({ full_name: settingName, avatar_url: finalAvatarUrl }).eq('id', profileId);
      if (error) throw error;
      setTeacherName(settingName);
      setAvatarUrl(finalAvatarUrl);
      setSettingAvatarFile(null);
      alert("Profile updated successfully!");
    } catch (err: any) {
      alert("Error updating profile: " + err.message);
    } finally {
      setIsUpdatingProfile(false);
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

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this task and all its submissions?")) return;
    
    // First, delete any submissions associated with this task to prevent Foreign Key constraint errors
    await supabase.from('submissions').delete().eq('task_id', taskId);
    
    // Then delete the task itself
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    
    if (!error) {
      if (selectedTask?.id === taskId) setSelectedTask(null);
      fetchTasks();
    } else {
      console.error("Supabase error:", error);
      alert("Error deleting task. It may be due to database permissions (RLS policies). Check the console for details.\n\nError: " + error.message);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm("Are you sure you want to delete this broadcast?")) return;
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (!error) {
      fetchNotes();
    } else {
      console.error("Supabase error:", error);
      alert("Error deleting broadcast. It may be due to database permissions (RLS policies).\n\nError: " + error.message);
    }
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterialTitle) return;
    
    setIsUploading(true);
    let finalUrl = newMaterialUrl;

    try {
      if (newMaterialFile) {
        const fileExt = newMaterialFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${profileId}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage.from('materials').upload(filePath, newMaterialFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from('materials').getPublicUrl(filePath);
        finalUrl = publicUrl;
      }

      const { error } = await supabase.from('materials').insert([
        { title: newMaterialTitle, description: newMaterialDesc, url: finalUrl, created_by: profileId }
      ]);
      
      if (error) throw error;
      
      setNewMaterialTitle('');
      setNewMaterialDesc('');
      setNewMaterialUrl('');
      setNewMaterialFile(null);
      fetchMaterials();
    } catch (err: any) {
      alert("Error creating material: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!window.confirm("Are you sure you want to delete this study material?")) return;
    const { error } = await supabase.from('materials').delete().eq('id', materialId);
    if (!error) fetchMaterials();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px' }}></div>
      </div>
    );
  }

  const ungradedSubmissions = submissions.filter(s => !s.verified).length;
  const unresolvedDoubts = doubts.filter(d => !d.resolved).length;
  const totalStudents = students.length;

  const getLeaderboard = () => {
    const scores: Record<string, any> = {};
    submissions.forEach((sub: any) => {
      if (sub.verified && sub.points) {
        if (!scores[sub.student_id]) {
          scores[sub.student_id] = { id: sub.student_id, name: sub.profiles?.full_name || 'Unknown', points: 0, avatar: sub.profiles?.avatar_url };
        }
        scores[sub.student_id].points += sub.points;
      }
    });
    return Object.values(scores).sort((a, b) => b.points - a.points);
  };
  const leaderboard = getLeaderboard();

  return (
    <div className="dashboard-layout">
      
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="logo-container" style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '48px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '2rem' }}>🎓</span> WebDev LMS
        </div>

        <div className="sidebar-nav">
          <button className={`sidebar-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
             📊 Overview
          </button>
          <button className={`sidebar-link ${activeTab === 'assignments' ? 'active' : ''}`} onClick={() => { setActiveTab('assignments'); setSelectedTask(null); }}>
             📝 Assignments
          </button>
          <button className={`sidebar-link ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>
             📚 Study Material
          </button>
          <button className={`sidebar-link ${activeTab === 'grading' ? 'active' : ''}`} onClick={() => setActiveTab('grading')}>
             📥 Grading Inbox
             {ungradedSubmissions > 0 && <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{ungradedSubmissions}</span>}
          </button>
          <button className={`sidebar-link ${activeTab === 'qa' ? 'active' : ''}`} onClick={() => setActiveTab('qa')}>
             🙋 Q&A
             {unresolvedDoubts > 0 && <span style={{ marginLeft: 'auto', background: 'var(--error)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{unresolvedDoubts}</span>}
          </button>
          <button className={`sidebar-link ${activeTab === 'roster' ? 'active' : ''}`} onClick={() => setActiveTab('roster')}>
             👥 Roster
          </button>
          <button className={`sidebar-link ${activeTab === 'materials' ? 'active' : ''}`} onClick={() => setActiveTab('materials')}>
             📚 Study Material
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
                <div style={{ fontWeight: '700', color: 'var(--foreground)' }}>{teacherName}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Teacher</div>
              </div>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
              ) : (
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                  {teacherName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
         </header>

         {/* Hero Section */}
         <section style={{ background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', borderRadius: '24px', padding: '40px', color: 'white', marginBottom: '32px', position: 'relative', overflow: 'hidden' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px' }}>
              Welcome back, {teacherName.split(' ')[0]}! 👋
            </h1>
            <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
              {(ungradedSubmissions > 0 || unresolvedDoubts > 0) 
                ? `You have ${ungradedSubmissions} submissions to grade and ${unresolvedDoubts} questions to answer.` 
                : "You're all caught up! The class is running smoothly."}
            </p>
            <div style={{ position: 'absolute', right: '40px', top: '50%', transform: 'translateY(-50%)', fontSize: '6rem', opacity: 0.2 }}>
              👨‍🏫
            </div>
         </section>

         {/* Metrics Grid */}
         {activeTab === 'overview' && (
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
             <div className="task-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px', border: ungradedSubmissions > 0 ? '2px solid var(--accent)' : '' }}>
               <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--accent)', marginBottom: '8px' }}>{ungradedSubmissions}</div>
               <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase' }}>To Grade</div>
             </div>
             
             <div className="task-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px', border: unresolvedDoubts > 0 ? '2px solid var(--error)' : '' }}>
               <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--error)', marginBottom: '8px' }}>{unresolvedDoubts}</div>
               <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase' }}>Open Questions</div>
             </div>
             
             <div className="task-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px' }}>
               <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '8px' }}>{totalStudents}</div>
               <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', textTransform: 'uppercase' }}>Active Students</div>
             </div>
           </div>
         )}

         {/* Tab Content Areas */}
         <div style={{ flexGrow: 1 }}>
          
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
              
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
                    style={{ marginBottom: 0, flexGrow: 1, background: '#f8fafc' }} 
                    placeholder="Send a live update to all students..." 
                    value={noteContent}
                    onChange={e => setNoteContent(e.target.value)}
                  />
                  <button type="submit" className="btn-primary" style={{ padding: '0 24px' }}>Send</button>
                </form>

                <div style={{ overflowY: 'auto', maxHeight: '300px', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '8px' }}>
                  {notes.filter(n => n.content.toLowerCase().includes(searchQuery.toLowerCase())).map(note => (
                    <div key={note.id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', borderLeft: '3px solid var(--primary)', position: 'relative' }}>
                      <button onClick={() => handleDeleteNote(note.id)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.5 }} title="Delete Broadcast">🗑️</button>
                      <p style={{ fontSize: '0.95rem', lineHeight: '1.5', color: '#1e293b', paddingRight: '24px' }}>{note.content}</p>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px', textAlign: 'right', fontWeight: '600' }}>
                        {new Date(note.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analytics Dashboard */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>📈 Class Analytics</h2>
                <div className="glass-panel" style={{ padding: '24px' }}>
                  {tasks.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {tasks.slice(0, 3).map((task) => {
                        const taskSubmissions = submissions.filter(s => s.task_id === task.id);
                        const completionRate = totalStudents > 0 ? (taskSubmissions.length / totalStudents) * 100 : 0;
                        const gradedSubmissions = taskSubmissions.filter(s => s.verified);
                        const avgScore = gradedSubmissions.length > 0 
                          ? (gradedSubmissions.reduce((acc, s) => acc + (s.points || 0), 0) / gradedSubmissions.length).toFixed(1) 
                          : 'N/A';

                        return (
                          <div key={task.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: '600', color: '#1e293b' }}>
                              <span>{task.title.length > 30 ? task.title.substring(0, 30) + '...' : task.title}</span>
                              <span>{Math.round(completionRate)}% Completed | Avg: {avgScore}</span>
                            </div>
                            <div style={{ width: '100%', height: '12px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                              <div style={{ width: `${completionRate}%`, height: '100%', background: 'linear-gradient(90deg, var(--secondary) 0%, var(--primary) 100%)', transition: 'width 1s ease' }}></div>
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>Showing last 3 assignments</div>
                    </div>
                  ) : (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No data to show yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Assignments Tab */}
          {activeTab === 'assignments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {!selectedTask ? (
                <>
                  {/* Assign Task */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>📝 Assign New Task</h2>
                    <form onSubmit={handleCreateTask} style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <input 
                        className="input-field" 
                        placeholder="Task Title (e.g., Build a Responsive Navbar)" 
                        value={newTaskTitle} 
                        onChange={e => setNewTaskTitle(e.target.value)} 
                        style={{ background: 'white', marginBottom: 0 }}
                      />
                      <textarea 
                        className="input-field" 
                        placeholder="Detailed instructions and requirements..." 
                        rows={5}
                        value={newTaskDesc} 
                        onChange={e => setNewTaskDesc(e.target.value)} 
                        style={{ background: 'white', marginBottom: 0 }}
                      />
                      <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '8px' }}>Due Date (Optional)</label>
                        <input 
                          type="datetime-local" 
                          className="input-field" 
                          value={newTaskDueDate} 
                          onChange={e => setNewTaskDueDate(e.target.value)} 
                          style={{ background: 'white', marginBottom: 0 }}
                        />
                      </div>
                      <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }}>Create Assignment</button>
                    </form>
                  </div>

                  {/* Task List */}
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '20px' }}>📚 Task History</h2>
                    {tasks.length === 0 ? <p style={{color: '#94a3b8', fontStyle: 'italic'}}>No tasks created yet.</p> : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {tasks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase())).map((task) => (
                          <div 
                            key={task.id} 
                            className="task-card"
                            onClick={() => setSelectedTask(task)}
                            style={{ cursor: 'pointer', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}
                          >
                            <button onClick={(e) => handleDeleteTask(task.id, e)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.5 }} title="Delete Task">🗑️</button>
                            <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#1e293b', paddingRight: '24px' }}>{task.title}</div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Created: {new Date(task.created_at).toLocaleDateString()}</div>
                            {task.due_date && (
                              <div style={{ fontSize: '0.85rem', color: new Date(task.due_date) < new Date() ? 'var(--error)' : '#f59e0b', fontWeight: 'bold' }}>
                                Due: {new Date(task.due_date).toLocaleString()}
                              </div>
                            )}
                            <div style={{ color: 'var(--primary)', fontWeight: '600', marginTop: '12px', fontSize: '0.9rem' }}>View Submissions →</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Selected Task View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <button onClick={() => setSelectedTask(null)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ← Back to all tasks
                  </button>
                  <div className="task-card" style={{ padding: '24px' }}>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', marginBottom: '12px' }}>{selectedTask.title}</h2>
                    <p style={{ color: '#475569', lineHeight: '1.6' }}>{selectedTask.description}</p>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b', marginTop: '16px' }}>Student Submissions</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {students.map((student) => {
                      const sub = submissions.find(s => s.task_id === selectedTask.id && s.student_id === student.id);
                      return (
                        <div key={student.id} className="task-card" style={{ padding: '20px', borderLeft: sub ? (sub.verified ? '4px solid var(--success)' : '4px solid var(--accent)') : '4px solid #cbd5e1', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                          <div style={{ width: '250px', flexShrink: 0 }}>
                            <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {student.avatar_url ? (
                                <img src={student.avatar_url} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>
                                  {student.full_name.charAt(0)}
                                </div>
                              )}
                              {student.full_name}
                            </div>
                            {sub ? (
                              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>Submitted: {new Date(sub.submitted_at).toLocaleDateString()}</div>
                            ) : (
                              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '8px', fontStyle: 'italic' }}>🔴 Not Submitted</div>
                            )}
                          </div>

                          {sub && (
                            <div style={{ flexGrow: 1 }}>
                              {sub.file_url && (
                                <a href={sub.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '16px', background: 'rgba(59, 130, 246, 0.1)', padding: '6px 12px', borderRadius: '6px', fontWeight: '600' }}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                                  View File
                                </a>
                              )}
                              
                              {sub.verified ? (
                                <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '0.9rem' }}>🟢 Graded</span>
                                    <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '1.1rem' }}>{sub.points} Points</span>
                                  </div>
                                  {sub.remark && <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '8px' }}>💬 {sub.remark}</div>}
                                </div>
                              ) : (
                                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                  <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: '600', marginBottom: '12px' }}>🟡 Needs Grading</div>
                                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    <input type="number" placeholder="Points" className="input-field" style={{ width: '100px', marginBottom: 0, background: 'white' }} value={grades[sub.id]?.points || ''} onChange={e => setGrades(prev => ({...prev, [sub.id]: { ...prev[sub.id], points: e.target.value }}))} />
                                    <input type="text" placeholder="Suggestion / Remark" className="input-field" style={{ flexGrow: 1, minWidth: '200px', marginBottom: 0, background: 'white' }} value={grades[sub.id]?.remark || ''} onChange={e => setGrades(prev => ({...prev, [sub.id]: { ...prev[sub.id], remark: e.target.value }}))} />
                                    <button onClick={() => handleGradeSubmission(sub.id)} className="btn-primary">Grade</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Study Material Tab */}
          {activeTab === 'materials' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>📤 Upload Study Material</h2>
                <form onSubmit={handleCreateMaterial} style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <input className="input-field" placeholder="Material Title" value={newMaterialTitle} onChange={e => setNewMaterialTitle(e.target.value)} style={{ background: 'white', marginBottom: '0' }} />
                  <textarea className="input-field" placeholder="Description..." rows={3} value={newMaterialDesc} onChange={e => setNewMaterialDesc(e.target.value)} style={{ background: 'white', marginBottom: '0' }} />
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flexGrow: 1, padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '8px' }}>Upload File (PDF, Image, etc.)</label>
                      <input type="file" onChange={e => setNewMaterialFile(e.target.files ? e.target.files[0] : null)} />
                    </div>
                    
                    <div style={{ fontWeight: '600', color: '#94a3b8' }}>OR</div>
                    
                    <div style={{ flexGrow: 1, padding: '12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '8px' }}>Paste URL Link</label>
                      <input className="input-field" placeholder="e.g. YouTube Link" value={newMaterialUrl} onChange={e => setNewMaterialUrl(e.target.value)} style={{ marginBottom: '0', border: 'none', background: '#f8fafc' }} />
                    </div>
                  </div>

                  <button type="submit" className="btn-primary" disabled={isUploading} style={{ width: '100%', opacity: isUploading ? 0.7 : 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    {isUploading ? <><span className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderTopColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: 'white', borderLeftColor: 'white' }}></span> Uploading...</> : "Share Material"}
                  </button>
                </form>
              </div>

              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '20px' }}>📚 Library</h2>
                {materials.length === 0 ? <p style={{color: '#94a3b8', fontStyle: 'italic'}}>No materials shared yet.</p> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {materials.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase())).map((mat) => (
                      <div key={mat.id} className="task-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                        <button onClick={() => handleDeleteMaterial(mat.id)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', opacity: 0.5 }} title="Delete Material">🗑️</button>
                        <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#1e293b', paddingRight: '24px' }}>{mat.title}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Added: {new Date(mat.created_at).toLocaleDateString()}</div>
                        {mat.description && <p style={{ fontSize: '0.95rem', color: '#475569', marginTop: '8px', flexGrow: 1 }}>{mat.description}</p>}
                        {mat.url && (
                          <a href={mat.url} target="_blank" rel="noreferrer" style={{ marginTop: '12px', color: 'var(--primary)', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(139, 92, 246, 0.1)', padding: '8px 16px', borderRadius: '8px', alignSelf: 'flex-start' }}>
                            View Resource ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
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
                        <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#1e293b' }}>{sub.profiles?.full_name || 'Student'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {new Date(sub.submitted_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '16px', marginTop: '4px' }}>Assignment: {sub.tasks?.title}</div>
                      
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
                            <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '1.1rem' }}>{sub.points} Points</span>
                          </div>
                          {sub.remark && (
                             <div style={{ fontSize: '0.9rem', color: '#475569', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                               💬 {sub.remark}
                             </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: '600' }}>Evaluate this submission:</div>
                          <input 
                            type="number" 
                            placeholder="Points awarded (e.g. 10)" 
                            className="input-field" 
                            value={grades[sub.id]?.points || ''} 
                            onChange={e => setGrades(prev => ({...prev, [sub.id]: { ...prev[sub.id], points: e.target.value }}))} 
                            style={{ marginBottom: 0, background: 'white' }} 
                          />
                          <textarea 
                            placeholder="Constructive feedback... (optional)" 
                            className="input-field" 
                            rows={3} 
                            value={grades[sub.id]?.remark || ''} 
                            onChange={e => setGrades(prev => ({...prev, [sub.id]: { ...prev[sub.id], remark: e.target.value }}))} 
                            style={{ marginBottom: 0, background: 'white' }} 
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
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1rem', fontWeight: 'bold', color: 'white' }}>
                          {(doubt.profiles?.full_name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flexGrow: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                             <span style={{ fontWeight: '600' }}>{doubt.profiles?.full_name || 'Student'}</span>
                             <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(doubt.created_at).toLocaleDateString()}</span>
                          </div>
                          <p style={{ fontSize: '1rem', color: '#1e293b', lineHeight: '1.5' }}>{doubt.question}</p>
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
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>T</div>
                          <div>
                             <div style={{ fontWeight: '600', color: 'var(--success)', marginBottom: '8px' }}>Your Reply</div>
                             <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: '1.5' }}>{doubt.answer}</p>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc', padding: '20px', borderRadius: '12px', marginLeft: '32px' }}>
                          <textarea 
                            className="input-field" 
                            style={{ marginBottom: 0, minHeight: '80px', background: 'white' }} 
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
                    <div 
                      key={student.id} 
                      onClick={() => setSelectedStudent(student)}
                      className="task-card"
                      style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', padding: '20px' }}
                    >
                      {student.avatar_url ? (
                        <img src={student.avatar_url} alt={student.full_name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.5rem', color: 'white', flexShrink: 0 }}>
                          {student.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#1e293b' }}>{student.full_name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: '600', marginTop: '4px' }}>
                          {student.student_class ? `Class: ${student.student_class}` : 'Active Student'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  let bg = '#ffffff';
                  let border = '1px solid #e2e8f0';
                  
                  if (index === 0) { badge = '🥇'; bg = 'rgba(250, 204, 21, 0.1)'; border = '1px solid rgba(250, 204, 21, 0.3)'; }
                  else if (index === 1) { badge = '🥈'; bg = 'rgba(148, 163, 184, 0.1)'; border = '1px solid rgba(148, 163, 184, 0.3)'; }
                  else if (index === 2) { badge = '🥉'; bg = 'rgba(180, 83, 9, 0.1)'; border = '1px solid rgba(180, 83, 9, 0.3)'; }

                  return (
                    <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: bg, border: border, borderRadius: '16px' }}>
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
                
                <button type="submit" className="btn-primary" disabled={isUpdatingProfile}>
                  {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

         </div>
      </main>

      {/* Student Details Modal */}
      {selectedStudent && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(4px)' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '40px', position: 'relative', background: 'white' }}>
            <button 
              onClick={() => setSelectedStudent(null)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: '#f1f5f9', border: 'none', color: '#64748b', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '40px', borderBottom: '1px solid #e2e8f0', paddingBottom: '32px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '2.5rem', color: 'white' }}>
                {selectedStudent.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: 0, color: '#1e293b' }}>{selectedStudent.full_name}</h2>
                <div style={{ fontSize: '1.1rem', color: 'var(--success)', fontWeight: '600', marginTop: '4px' }}>
                  {selectedStudent.student_class ? `Class: ${selectedStudent.student_class}` : 'No class specified'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  Submissions
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {submissions.filter(s => s.student_id === selectedStudent.id).length === 0 ? (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>No submissions found.</p>
                  ) : (
                    submissions.filter(s => s.student_id === selectedStudent.id).map(sub => (
                      <div key={sub.id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', borderLeft: sub.verified ? '3px solid var(--success)' : '3px solid var(--accent)' }}>
                        <div style={{ fontWeight: '600', fontSize: '0.95rem', color: '#1e293b' }}>{sub.tasks?.title}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>{new Date(sub.submitted_at).toLocaleDateString()}</div>
                        {sub.verified && <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 'bold', marginTop: '8px' }}>{sub.points} Points</div>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                  Questions Asked
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {doubts.filter(d => d.student_id === selectedStudent.id).length === 0 ? (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>No questions found.</p>
                  ) : (
                    doubts.filter(d => d.student_id === selectedStudent.id).map(doubt => (
                      <div key={doubt.id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', borderLeft: doubt.resolved ? '3px solid var(--success)' : '3px solid var(--error)' }}>
                        <div style={{ fontSize: '0.95rem', lineHeight: '1.4', color: '#1e293b' }}>"{doubt.question}"</div>
                        {doubt.resolved && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--success)', marginTop: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '6px' }}>
                            {doubt.answer}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
