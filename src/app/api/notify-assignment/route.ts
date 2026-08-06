import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Initialize Resend
// Note: If you don't have RESEND_API_KEY set, this will fail gracefully or throw an error.
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key');

// Create a Supabase admin client to bypass RLS and access auth.users
const supabaseAdminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseAdminUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { title, description } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
       console.log('Skipping email notification: Missing API Keys in .env.local');
       return NextResponse.json({ message: 'Keys missing, email skipped' }, { status: 200 });
    }

    // 1. Fetch all students from profiles
    const { data: students, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'student');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
    }

    if (!students || students.length === 0) {
      return NextResponse.json({ message: 'No students found to notify' });
    }

    // 2. Fetch all users from auth.users using the admin API
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      return NextResponse.json({ error: 'Failed to fetch user emails' }, { status: 500 });
    }

    // 3. Match profiles to emails
    const studentIds = new Set(students.map(s => s.id));
    const emailsToNotify: string[] = users
      .filter(u => studentIds.has(u.id) && u.email)
      .map(u => u.email as string);

    if (emailsToNotify.length === 0) {
      return NextResponse.json({ message: 'No student emails found' });
    }

    // 4. Send email using Resend
    // Due to Resend Sandbox limits, we send to the safe test address so it shows up in your dashboard.
    // In production with a verified domain, you would use: to: emailsToNotify
    const { data, error } = await resend.emails.send({
      from: 'Yenova LMS <notifications@yenova.site>', // Change to your verified domain in production
      to: emailsToNotify, // Send to all students
      subject: `New Assignment Posted: ${title} (Sent to ${emailsToNotify.length} students)`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
          <h2 style="color: #8b5cf6;">New Material Available 📚</h2>
          <p>Hi there,</p>
          <p>A new assignment or study material has just been posted on the Yenova LMS platform:</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
            <h3 style="margin-top: 0; color: #111827;">${title}</h3>
            <p style="margin-bottom: 0;">${description || 'No additional description provided.'}</p>
          </div>
          <p>Please log in to your dashboard to view the full details and complete your tasks!</p>
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

    return NextResponse.json({ success: true, count: emailsToNotify.length });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
