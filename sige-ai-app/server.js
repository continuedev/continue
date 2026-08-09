const express = require('express');
const path = require('path');
const fetch = global.fetch || require('node-fetch');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// POST /api/ask - receives { prompt } and returns AI response
app.post('/api/ask', async (req, res) => {
  const prompt = req.body.prompt || '';
  // If AI endpoint configured via env, forward the request. Otherwise return a demo response.
  const endpoint = process.env.AI_API_ENDPOINT || '';
  const apiKey = process.env.AI_API_KEY || '';

  if (!prompt) return res.status(400).json({ error: 'Empty prompt' });

  if (!endpoint) {
    return res.json({ reply: `Demo: recibí tu prompt de ${prompt.length} caracteres. (Configura AI_API_ENDPOINT para usar una IA real)` });
  }

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey ? `Bearer ${apiKey}` : undefined
      },
      body: JSON.stringify({ prompt })
    });
    const data = await resp.json();
    return res.json({ reply: data });
  } catch (err) {
    console.error('AI request failed', err);
    return res.status(500).json({ error: 'AI request failed', detail: String(err) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SIGE AI app listening on ${port}`));
