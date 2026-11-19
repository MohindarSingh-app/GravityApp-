const supportModel = require('../../models/energy_service/support.model');
const catalogService = require('./catalog.service');
const { matchFaq } = require('../../constants/energy_service/supportFaq');

async function createRequest(user, input) {
  const request = await supportModel.create({
    userId: user.id,
    companyId: user.company_id,
    subject: input.subject.trim(),
    message: input.message.trim(),
  });
  return {
    request: {
      id: request.id,
      subject: request.subject,
      status: request.status,
      createdAt: request.created_at,
    },
    message: 'Your support request was saved.',
  };
}

async function submit(user, input) {
  return createRequest(user, input);
}

async function callAiWebhook(message, history) {
  const url = process.env.SUPPORT_AI_WEBHOOK_URL;
  if (!url) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`AI webhook returned ${response.status}`);
    }
    const payload = await response.json();
    const answer = payload.answer || payload.text || payload.message;
    if (!answer || typeof answer !== 'string') {
      throw new Error('AI webhook response missing answer text');
    }
    return {
      answer: answer.trim(),
      suggestHuman: Boolean(payload.suggestHuman),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function assist(user, input) {
  const message = input.message.trim();
  const history = Array.isArray(input.history) ? input.history.slice(-8) : [];

  const { groups } = await catalogService.list(['faq']);
  const faqHit = matchFaq(groups.faq, message);
  if (faqHit) {
    return {
      source: 'faq',
      answer: faqHit.summary,
      suggestHuman: false,
      faqId: faqHit.code,
    };
  }

  try {
    const ai = await callAiWebhook(message, history);
    if (ai) {
      return {
        source: 'ai',
        answer: ai.answer,
        suggestHuman: ai.suggestHuman,
      };
    }
  } catch (err) {
    return {
      source: 'unavailable',
      answer: null,
      suggestHuman: true,
      error: 'The AI assistant is temporarily unavailable. You can message support or request a callback.',
    };
  }

  return {
    source: 'none',
    answer: null,
    suggestHuman: true,
    message: 'I could not find a quick answer for that. Message support with details or request a callback if you need a person.',
  };
}

module.exports = { submit, assist };
