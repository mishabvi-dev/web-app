import { createClient } from '@supabase/supabase-js';

const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseAdminUrl, supabaseServiceKey);

async function testFetch() {
  console.log("Fetching students...");
  const { data: students, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'student');

  console.log("Students:", students?.length);

  const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
  
  if (authError) {
      console.error("Auth error", authError);
      return;
  }
  
  const studentIds = new Set(students.map(s => s.id));
    const emailsToNotify = users
      .filter(u => studentIds.has(u.id) && u.email)
      .map(u => u.email);
  
  console.log("Emails to notify:", emailsToNotify);
}

testFetch();
