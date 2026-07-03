const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const env = require('../config/env');

/**
 * Ethereal (https://ethereal.email) is Nodemailer's own testing SMTP
 * service: createTestAccount() registers a throwaway inbox with no signup
 * and no real account tied to anyone. Mail sent through it is never
 * delivered anywhere — it's captured and viewable only via a private
 * preview URL. This keeps a genuine SMTP send code path (the same shape
 * you'd use with a real provider) without exposing or requiring any real
 * email credentials, which matters for a public portfolio repo.
 *
 * The test account is created once and cached — creating a new one per
 * email would be wasteful and is unnecessary since nothing here needs to
 * persist across server restarts.
 */
let transporterPromise = null;

function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = nodemailer.createTestAccount().then((account) =>
      nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      })
    );
  }
  return transporterPromise;
}

async function sendOtpEmail(to, otp) {
  const transporter = await getTransporter();

  const html = `
    <div style="font-family:Arial,sans-serif;background:#0F172A;color:#F8FAFC;padding:32px;border-radius:16px;max-width:420px;margin:auto;">
      <h2 style="color:#8B5CF6;margin-top:0;">Snipr password reset</h2>
      <p style="color:#94A3B8;">Use this code to reset your admin password. It expires in ${env.otp.expiryMinutes} minutes.</p>
      <div style="font-size:32px;font-weight:800;letter-spacing:8px;background:#1E293B;padding:16px 24px;border-radius:12px;text-align:center;margin:24px 0;">${otp}</div>
      <p style="color:#94A3B8;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
    </div>`;

  const info = await transporter.sendMail({
    from: '"Snipr" <no-reply@snipr.test>',
    to,
    subject: 'Your Snipr password reset code',
    html,
    text: `Your Snipr password reset code is ${otp}. It expires in ${env.otp.expiryMinutes} minutes.`,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  logger.info('OTP email sent via Ethereal test inbox', { to, previewUrl });
  return { previewUrl };
}

module.exports = { sendOtpEmail };
