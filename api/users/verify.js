import { supabase } from '../../src/services/supabase';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({ error: 'Missing token or email' });
    }

    console.log('Verifying email:', email, 'with token:', token);

    // Verify the token with Supabase
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'signup',
    });

    if (error) {
      console.error('Verification error:', error);
      throw error;
    }

    // Update user profile verification status
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ email_verified: true })
      .eq('email', email);

    if (updateError) {
      console.error('Profile update error:', updateError);
      throw updateError;
    }

    // Send welcome email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const welcomeHtml = `
      <h2>Welcome to NanoHistory!</h2>
      <p>Your email has been verified successfully. You can now sign in to your account and start exploring historical locations.</p>
      <p>Thank you for joining our community!</p>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Welcome to NanoHistory',
      html: welcomeHtml,
    });

    console.log('Email verification successful for:', email);

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    });

  } catch (error) {
    console.error('Verification handler error:', error);
    return res.status(400).json({ error: error.message });
  }
}
