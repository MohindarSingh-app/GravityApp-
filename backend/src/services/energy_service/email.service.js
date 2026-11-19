const nodemailer = require('nodemailer');
const { env } = require('../../config/energy_service/env');
const { logError } = require('../../utils/energy_service/logger');

const messages = [];
const plaintextOtps = new Map();
let transporter;

function getTransporter() {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user
        ? { user: env.smtp.user, pass: env.smtp.pass }
        : undefined,
    });
  }
  return transporter;
}

async function deliver({ to, subject, text }) {
  if (env.devMailbox) {
    messages.push({
      to,
      subject,
      text,
      createdAt: new Date().toISOString(),
    });
    if (messages.length > 20) messages.shift();
  }

  const mailer = getTransporter();
  if (!mailer) return;

  try {
    await mailer.sendMail({
      from: env.smtp.from,
      to,
      subject,
      text,
    });
  } catch (_err) {
    logError(new Error('Email delivery failed'));
  }
}

async function sendVerification({ to, fullName, token }) {
  await deliver({
    to,
    subject: 'Verify your Service Admin email',
    text: [
      `Hello ${fullName},`,
      '',
      'Enter this verification code in the app:',
      token,
      '',
      'This code expires in 24 hours. If you did not create an account, you can ignore this message.',
    ].join('\n'),
  });
}

async function sendOtp({ to, otp }) {
  if (env.nodeEnv !== 'production') plaintextOtps.set(to, otp);
  await deliver({
    to,
    subject: 'Your Service Admin verification code',
    text: [
      'Your Service Admin verification code is:',
      otp,
      '',
      `This code expires in ${Math.floor(env.otpTtlSeconds / 60)} minutes.`,
      'If you did not request this code, you can ignore this message.',
    ].join('\n'),
  });
}

async function sendPasswordReset({ to, fullName, token }) {
  await deliver({
    to,
    subject: 'Reset your Service Admin password',
    text: [
      `Hello ${fullName},`,
      '',
      'Enter this password reset code in the app:',
      token,
      '',
      'This code expires in 30 minutes. If you did not request a reset, you can ignore this message.',
    ].join('\n'),
  });
}

function listMessages() {
  return messages.map((message) => ({ ...message }));
}

function peekDevOtp(email) {
  if (env.nodeEnv === 'production') return null;
  return plaintextOtps.get(email) || null;
}

module.exports = {
  sendOtp,
  peekDevOtp,
  sendVerification,
  sendPasswordReset,
  listMessages,
};
