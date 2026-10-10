import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.GROQ_API_KEY;
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'openai/gpt-oss-120b';
const ALLOWED_MODELS = new Set([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant'
]);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const chatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests in a short time. Please wait a moment and try again.' }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(API_KEY && !API_KEY.includes('replace_this')),
    defaultModel: DEFAULT_MODEL,
    provider: 'Groq'
  });
});

app.get('/api/models', (_req, res) => {
  res.json({
    models: [
      { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', note: 'Advanced reasoning' },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', note: 'Versatile' },
      { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B', note: 'Fast and capable' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', note: 'Low latency' }
    ]
  });
});

app.post('/api/chat', chatLimiter, async (req, res) => {
  if (!API_KEY || API_KEY.includes('replace_this')) {
    return res.status(503).json({ error: 'Groq API key is not configured. Add GROQ_API_KEY to your hosting provider environment settings.' });
  }

  const { messages, model } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Please provide at least one message.' });
  }
  if (model && !ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: 'That model is not enabled by this app.' });
  }

  const safeMessages = messages.slice(-32).map((item) => {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') {
      return null;
    }
    return { role: item.role, content: item.content.slice(0, 24000) };
  });
  if (safeMessages.some((item) => item === null) || !safeMessages.some((item) => item.role === 'user')) {
    return res.status(400).json({ error: 'The conversation contains an invalid message.' });
  }

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || (ALLOWED_MODELS.has(DEFAULT_MODEL) ? DEFAULT_MODEL : 'openai/gpt-oss-120b'),
        messages: [
          { role: 'system', content: 'You are Axiom, a clear, capable, thoughtful AI assistant. Give accurate, useful answers. Use Markdown when it improves clarity. Be transparent about uncertainty.' },
          ...safeMessages
        ],
        stream: true,
        max_completion_tokens: 4096,
        temperature: 0.7
      }),
      signal: controller.signal
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      let message = `Groq API returned ${upstream.status}.`;
      try {
        const parsed = JSON.parse(detail);
        message = parsed?.error?.message || parsed?.message || message;
      } catch { /* Keep a readable fallback. */ }
      if (!res.headersSent) return res.status(upstream.status).json({ error: message });
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      return res.end();
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finished = false;
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          finished = true;
          break;
        }
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length) {
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          }
          const error = parsed?.error?.message;
          if (error) {
            res.write(`data: ${JSON.stringify({ error })}\n\n`);
            finished = true;
            break;
          }
        } catch { /* Ignore non-JSON SSE lines. */ }
      }
      if (res.destroyed) {
        controller.abort();
        break;
      }
    }
    if (!res.writableEnded && !res.destroyed) res.end();
  } catch (error) {
    if (error?.name === 'AbortError') return;
    if (res.headersSent) {
      if (!res.destroyed) {
        res.write(`data: ${JSON.stringify({ error: 'The response stream ended unexpectedly. Please try again.' })}\n\n`);
        res.end();
      }
    } else {
      res.status(502).json({ error: error?.message || 'Could not connect to Groq. Check your connection and try again.' });
    }
  }
});

// Serve the built frontend in production; Vite serves the frontend during development.
const distDir = path.resolve(__dirname, '../dist');
app.use(express.static(distDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distDir, 'index.html'), (err) => {
    if (err) res.status(404).send('Build not found. Run npm run build first.');
  });
});

export default app;
const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Axiom API server listening on http://localhost:${PORT}`);
    if (!API_KEY || API_KEY.includes('replace_this')) console.warn('GROQ_API_KEY is not configured. Add it to .env to enable chat.');
  });
}
