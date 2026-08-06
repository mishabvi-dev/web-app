import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseAdminUrl, supabaseServiceKey);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function resetPassword() {
  console.log("=== Supabase Admin Password Reset ===");
  
  const email = process.argv[2];
  const newPassword = process.argv[3];

  if (!email || !newPassword) {
    console.log("Usage: node --env-file=.env.local reset-password.mjs <student-email> <new-password>");
    process.exit(1);
  }
      
  console.log(`\nSearching for user: ${email}...`);
      
  // 1. Find the user ID
  const { data: { users }, error: fetchError } = await supabaseAdmin.auth.admin.listUsers();
  if (fetchError) {
    console.error("Failed to fetch users:", fetchError.message);
    process.exit(1);
  }
      
  const user = users.find(u => u.email === email);
  if (!user) {
    console.error(`User with email ${email} not found!`);
    process.exit(1);
  }
      
  console.log(`Found user ID: ${user.id}`);
  console.log(`Updating password...`);
      
  // 2. Force update the password
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword
  });
      
  if (error) {
    console.error("Failed to reset password:", error.message);
  } else {
    console.log(`\nSUCCESS! ✅`);
    console.log(`The password for ${email} has been manually changed to: ${newPassword}`);
    console.log(`The student can use this to log in right now.`);
  }
      
  process.exit(0);
}

resetPassword();
