const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim().replace(/"/g, '');
const SUPABASE_KEY = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim().replace(/"/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// You can specify the teacher's profile ID here, or fetch the first teacher
async function run() {
  const { data: profiles } = await supabase.from('profiles').select('id, role').eq('role', 'teacher');
  
  if (!profiles || profiles.length === 0) {
    console.log('No teacher found to assign tasks to.');
    return;
  }
  
  const teacherId = profiles[0].id;
  
  const scheduleText = fs.readFileSync('C:\\Users\\michu\\.gemini\\antigravity\\brain\\79a16571-896f-48f8-bc00-bc4dbe89ba80\\30_day_schedule.md', 'utf-8');
  
  // Parse lines like: *   **Day 1:** **Introduction & HTML Basics** - Setting up VS Code...
  const regex = /\*\s+\*\*Day\s+\d+:\*\*\s+\*\*(.*?)\*\*\s+-\s+(.*)/g;
  
  let match;
  let count = 0;
  let dayNum = 1;
  while ((match = regex.exec(scheduleText)) !== null) {
    const title = `Day ${dayNum}: ${match[1]}`;
    const desc = match[2];
    
    await supabase.from('tasks').insert({
      title: title,
      description: desc,
      created_by: teacherId
    });
    
    console.log(`Inserted: ${title}`);
    count++;
    dayNum++;
  }
  
  console.log(`Successfully synced ${count} tasks!`);
}

run();
