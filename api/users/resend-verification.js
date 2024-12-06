import { supabase } from '../../src/services/supabase';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log('Resending verification email to:', email);

    // Check if user exists and needs verification
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email_verified')
      .eq('email', email)
      .single();

    if (profileError) {
      console.error('Profile lookup error:', profileError);
      throw profileError;
    }

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (profile.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate new verification token
    const { data, error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: 'nanohistory://auth/callback'
      }
    });

    if (resendError) {
      console.error('Resend error:', resendError);
      throw resendError;
    }

    // Send verification email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const verificationLink = `nanohistory://auth/callback?token=${data.user.confirmation_token}&type=signup&email=${email}`;
    
    const emailHtml = `
      <h2>Verify your TaleTrail account</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationLink}">Verify Email Address</a></p>
      <p>If you did not request this verification email, please ignore it.</p>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Verify your TaleTrail account',
      html: emailHtml,
    });

    console.log('Verification email resent successfully to:', email);

    return res.status(200).json({
      message: 'Verification email sent successfully',
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(400).json({ error: error.message });
  }
}
