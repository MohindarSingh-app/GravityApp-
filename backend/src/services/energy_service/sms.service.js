const { env } = require('../../config/energy_service/env');
const AppError = require('../../utils/energy_service/AppError');
const { logError } = require('../../utils/energy_service/logger');

const messages = [];
const plaintextOtps = new Map();

function rememberDevOtp(phone, otp) {
  if (env.nodeEnv === 'production') return;
  plaintextOtps.set(phone, otp);
  if (env.devMailbox || env.nodeEnv === 'test') {
    messages.push({
      channel: 'sms',
      to: phone,
      subject: 'Your verification code',
      text: `Your verification code is:\n${otp}\n\nThis code expires in ${Math.floor(env.otpTtlSeconds / 60)} minutes.`,
      createdAt: new Date().toISOString(),
    });
    if (messages.length > 20) messages.shift();
  }
}

async function sendTwilio({ phone, text }) {
  const { accountSid, authToken, fromNumber, messagingServiceSid } = env.twilio;
  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    throw new Error('Twilio is not configured');
  }
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const params = new URLSearchParams({ To: phone, Body: text });
  // Messaging Service SID prefer karo (India DLT/template routing ke liye best),
  // warna direct From number.
  if (messagingServiceSid) params.set('MessagingServiceSid', messagingServiceSid);
  else params.set('From', fromNumber);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let response;
  try {
    response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
        signal: controller.signal,
      },
    );
  } catch (_err) {
    throw new Error('Twilio request failed');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = payload && payload.message ? ` (${payload.message})` : '';
      if (payload && payload.code) detail += ` [code ${payload.code}]`;
    } catch (_parseError) {
      // Twilio error body parse na ho to generic message hi rakho.
    }
    throw new Error(`Twilio rejected the message${detail}`);
  }
}

async function sendOtp({ phone, otp, purpose }) {
  const text = purpose === 'password_reset'
    ? `Your Service Admin password reset code is ${otp}. It expires in ${Math.floor(env.otpTtlSeconds / 60)} minutes.`
    : `Your Service Admin verification code is ${otp}. It expires in ${Math.floor(env.otpTtlSeconds / 60)} minutes.`;

  rememberDevOtp(phone, otp);

  if (env.smsProvider === 'twilio') {
    try {
      await sendTwilio({ phone, text });
    } catch (err) {
      logError(err);
      // 21608 (trial account / unverified number) aur sender-ID/DLT errors ko
      // user-friendly banao taaki app par seedha samajh aaye.
      const detail = err && err.message ? err.message : '';
      if (/21608/.test(detail)) {
        throw new AppError(
          'This number is not verified on the trial SMS account. Verify it in Twilio or use a verified test number.',
          503,
          'SMS_UNAVAILABLE',
        );
      }
      throw new AppError('Unable to send a verification code right now.', 503, 'SMS_UNAVAILABLE');
    }
    return;
  }

  if (env.nodeEnv === 'production') {
    throw new AppError('SMS delivery is not configured.', 503, 'SMS_UNAVAILABLE');
  }
}

function smsStatus() {
  return {
    provider: env.smsProvider || 'dev',
    configured: env.smsProvider === 'twilio' && Boolean(env.twilioEnabled),
  };
}

function listMessages() {
  return messages.map((message) => ({
    channel: message.channel,
    to: message.to,
    subject: message.subject,
    text: message.text,
    createdAt: message.createdAt,
  }));
}

function peekDevOtp(phone) {
  if (env.nodeEnv === 'production') return null;
  return plaintextOtps.get(phone) || null;
}

function hasDevOtp(phone) {
  if (env.nodeEnv === 'production') return false;
  return plaintextOtps.has(phone);
}

module.exports = {
  sendOtp,
  listMessages,
  peekDevOtp,
  hasDevOtp,
  smsStatus,
};
