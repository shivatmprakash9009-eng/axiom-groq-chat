import 'dotenv/config';
import app from '../index.js';

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Axiom API server listening on http://localhost:${PORT}`);
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes('replace_this')) {
    console.warn('GROQ_API_KEY is not configured. Add it to .env to enable chat.');
  }
});
