import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  console.log("Testing Resend API...");
  console.log("API Key loaded:", process.env.RESEND_API_KEY ? "Yes" : "No");
  
  if (!process.env.RESEND_API_KEY) {
      console.log("Error: RESEND_API_KEY is not defined.");
      return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'delivered@resend.dev', // This is a safe testing email provided by Resend
      subject: 'Test Email',
      html: '<p>This is a test email to verify API key validity.</p>'
    });

    if (error) {
      console.error("Resend API Error:", error);
    } else {
      console.log("Email successfully sent! ID:", data?.id);
    }
  } catch (err) {
    console.error("Caught exception:", err);
  }
}

testEmail();
