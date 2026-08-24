// The 5&2 Foundation — Operations Suite Anthropic proxy.
// POST (Authorization: Bearer <token>) { model, max_tokens, messages }
// Env required: ANTHROPIC_API_KEY, SESSION_SECRET
import crypto from 'crypto';

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-sonnet-5',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-8',
]);

function verify(token, secret) {
  if (!token || token.indexOf('.') === -1) return false;
  const [data, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    return payload.exp && Date.now() < payload.exp;
  } catch { return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.SESSION_SECRET;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!secret || !key) return res.status(500).json({ error: 'Server not configured' });

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!verify(token, secret)) return res.status(401).json({ error: 'Not authorized' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const model = (body && body.model) || 'claude-sonnet-4-6';
  if (!ALLOWED_MODELS.has(model)) return res.status(400).json({ error: 'Model not allowed' });
  const max_tokens = Math.min(Number(body && body.max_tokens) || 1000, 2000);
  const messages = Array.isArray(body && body.messages) ? body.messages : [];
  if (!messages.length) return res.status(400).json({ error: 'No messages provided' });

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens, messages }),
    });
    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Upstream error', detail: String(err) });
  }
}
