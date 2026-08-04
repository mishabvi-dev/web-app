export default function AttendancePage() {
  return (
    <div style={{ width: '100%', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      <iframe 
        src="https://frontend-rosy-beta-70.vercel.app/"
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Yenova Attendance System"
        allowFullScreen
      />
    </div>
  );
}
