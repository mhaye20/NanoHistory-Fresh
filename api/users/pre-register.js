import { supabase } from '../../src/services/supabase';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, firstName, lastName, phone, password } = req.body;

    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create auth user with Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
        },
      },
    });

    if (authError) throw authError;

    // Create user profile in profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          email,
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
        },
      ]);

    if (profileError) throw profileError;

    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Send verification email
    const verificationLink = `nanohistory://auth/callback?token=${authData.user.confirmation_token}&type=signup&email=${email}`;
    
    const emailHtml = `
      <h2>Welcome to TaleTrail</h2>
      <p>Thank you for signing up! Please verify your email address by clicking the link below:</p>
      <p><a href="${verificationLink}">Verify Email Address</a></p>
      <p>If you did not create this account, please ignore this email.</p>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Verify your TaleTrail account',
      html: emailHtml,
    });

    return res.status(200).json({
      message: 'Registration successful. Please check your email for verification.',
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(400).json({ error: error.message });
  }
}
