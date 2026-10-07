import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Account from '@/lib/models/Account';
import { getOwnerId, unauthorized } from '@/lib/currentUser';
import { encrypt, decrypt } from '@/lib/encrypt';

// GET /api/ai — get user's AI settings (key masked)
export async function GET(request) {
  try {
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();
    await connectDB();
    const account = await Account.findOne({ ownerId }).select('aiProvider aiModel aiApiKey').lean();
    if (!account) return NextResponse.json({ provider: 'none', model: '', configured: false });

    return NextResponse.json({
      provider: account.aiProvider || 'none',
      model: account.aiModel || '',
      configured: !!account.aiApiKey,
      keyMasked: account.aiApiKey ? '••••' + decrypt(account.aiApiKey)?.slice(-4) : null,
    });
  } catch (error) {
    console.error('[AI GET]', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// PUT /api/ai — save AI settings
export async function PUT(request) {
  try {
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();
    const { provider, apiKey, model } = await request.json();

    if (provider && !['none', 'claude', 'openai', 'gemini'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    await connectDB();
    const update = {};
    if (provider !== undefined) update.aiProvider = provider;
    if (model !== undefined) update.aiModel = model;
    if (apiKey && apiKey !== '' && !apiKey.includes('••••')) {
      update.aiApiKey = encrypt(apiKey);
    }
    if (provider === 'none') {
      update.aiApiKey = null;
      update.aiModel = '';
    }

    await Account.updateOne({ ownerId }, { $set: update });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AI PUT]', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}

// POST /api/ai — generate/improve content
export async function POST(request) {
  try {
    const ownerId = await getOwnerId(request);
    if (!ownerId) return unauthorized();

    const { action, text, topic, tone } = await request.json();
    if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 });

    await connectDB();
    const account = await Account.findOne({ ownerId }).select('+aiApiKey aiProvider aiModel').lean();
    if (!account?.aiApiKey || account.aiProvider === 'none') {
      return NextResponse.json({ error: 'AI not configured. Go to Accounts → AI Settings to add your API key.' }, { status: 400 });
    }

    const apiKey = decrypt(account.aiApiKey);
    if (!apiKey) return NextResponse.json({ error: 'Failed to decrypt API key. Re-save it in settings.' }, { status: 500 });

    const prompt = buildPrompt(action, text, topic, tone);
    const result = await callAI(account.aiProvider, apiKey, account.aiModel, prompt);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[AI GENERATE]', error);
    const msg = error.message?.includes('401') || error.message?.includes('Unauthorized')
      ? 'API key is invalid. Check your key in AI Settings.'
      : error.message?.includes('429')
        ? 'Rate limit exceeded. Try again in a moment.'
        : error.message || 'AI generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildPrompt(action, text, topic, tone) {
  const toneMap = {
    professional: 'professional and authoritative',
    casual: 'casual and conversational',
    storytelling: 'narrative storytelling style',
    bold: 'bold and opinionated with strong statements',
  };
  const toneDesc = toneMap[tone] || 'professional';

  switch (action) {
    case 'generate':
      return `Write a LinkedIn post about: ${topic || 'a professional topic'}.
Style: ${toneDesc}.
Rules: 1-3000 characters, use line breaks for readability, include a hook in the first line, end with a call to action.
Do NOT use markdown formatting. Do NOT include hashtags (user will add separately).
Return ONLY the post text, nothing else.`;

    case 'improve':
      return `Improve this LinkedIn post to make it more engaging and professional. Keep the same core message but improve the writing quality, structure, and impact.
Original post:
${text}

Rules: Keep it 1-3000 characters. Use line breaks. Make the opening hook stronger. End with a call to action.
Do NOT use markdown. Do NOT add hashtags.
Return ONLY the improved post text, nothing else.`;

    case 'shorter':
      return `Make this LinkedIn post significantly shorter while keeping the core message. Target 50-60% of original length.
Original:
${text}

Return ONLY the shortened post text.`;

    case 'longer':
      return `Expand this LinkedIn post with more detail, examples, or context. Add 40-60% more content.
Original:
${text}

Return ONLY the expanded post text.`;

    case 'hashtags':
      return `Suggest 5-8 relevant LinkedIn hashtags for this post. Return ONLY the hashtags separated by spaces, nothing else.
Post:
${text || topic}`;

    case 'hook':
      return `Write 5 attention-grabbing opening lines (hooks) for a LinkedIn post about: ${topic || text?.slice(0, 100) || 'a professional topic'}.
Each hook should be 1 sentence, designed to stop scrolling.
Return each hook on a new line, numbered 1-5. Nothing else.`;

    case 'tone':
      return `Rewrite this LinkedIn post in a ${toneDesc} tone. Keep the same message.
Original:
${text}

Return ONLY the rewritten post text.`;

    default:
      return `Improve this LinkedIn post: ${text}`;
  }
}

async function callAI(provider, apiKey, model, prompt) {
  switch (provider) {
    case 'claude':
      return callClaude(apiKey, model || 'claude-sonnet-4-20250514', prompt);
    case 'openai':
      return callOpenAI(apiKey, model || 'gpt-4o-mini', prompt);
    case 'gemini':
      return callGemini(apiKey, model || 'gemini-pro', prompt);
    default:
      throw new Error('Unsupported AI provider');
  }
}

async function callClaude(apiKey, model, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `Claude API ${res.status}`); }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function callOpenAI(apiKey, model, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `OpenAI API ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(apiKey, model, prompt) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `Gemini API ${res.status}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
