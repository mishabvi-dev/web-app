import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

// Create a Supabase admin client to bypass RLS and access auth.users
const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseAdminUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { studentId, studentName, taskTitle, points, remark } = await request.json();

    if (!studentId || !taskTitle || points === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
       console.log('Skipping email notification: Missing API Keys in .env.local');
       return NextResponse.json({ message: 'Keys missing, email skipped' }, { status: 200 });
    }

    // Fetch all users from auth.users using the admin API to find this specific student
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return NextResponse.json({ error: 'Failed to fetch user emails' }, { status: 500 });
    }

    const studentUser = users.find(u => u.id === studentId);
    
    if (!studentUser || !studentUser.email) {
      return NextResponse.json({ error: 'Student email not found in database' }, { status: 404 });
    }

    // Send email using Resend
    // Due to Resend Sandbox limits, we send to the safe test address so it shows up in the dashboard.
    // In production with a verified domain, you would use: to: studentUser.email
    const { data, error } = await resend.emails.send({
      from: 'Yenova LMS <notifications@yenova.site>', // Change to your verified domain in production
      to: studentUser.email, // Send to the actual student
      subject: `Grade Posted: ${taskTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
          <h2 style="color: #10b981;">Assignment Graded ✅</h2>
          <p>Hi ${studentName || 'there'},</p>
          <p>Your submission for <strong>${taskTitle}</strong> has just been graded!</p>
          
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="margin-top: 0; color: #065f46; font-size: 24px;">Score: ${points} Points</h3>
            ${remark ? `<p style="margin-bottom: 0; color: #064e3b;"><strong>Teacher's Remark:</strong> ${remark}</p>` : ''}
          </div>
          
          <p>Please log in to your dashboard to view your progress.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            - The Yenova Team
          </p>
        </div>
      `
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: 'Failed to send emails', details: error }, { status: 500 });
    }

    return NextResponse.json({ success: true, targetEmail: studentUser.email });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
