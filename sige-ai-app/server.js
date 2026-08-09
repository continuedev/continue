const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = global.fetch || require('node-fetch');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PROVIDERS_FILE = path.join(__dirname, 'providers.json');

function loadProviders() {
  try {
    if (!fs.existsSync(PROVIDERS_FILE)) return [];
    const raw = fs.readFileSync(PROVIDERS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('Failed to load providers.json', e);
    return [];
  }
}

function saveProviders(providers) {
  fs.writeFileSync(PROVIDERS_FILE, JSON.stringify(providers, null, 2), 'utf8');
}

// GET /api/providers -> list available providers (metadata only, no secrets)
app.get('/api/providers', (req, res) => {
  const providers = loadProviders();
  res.json(providers.map(p => ({ id: p.id, name: p.name, endpoint: p.endpoint, description: p.description || '' }))); 
});

// POST /api/providers -> create or update provider (no secret stored)
app.post('/api/providers', (req, res) => {
  const { id, name, endpoint, description, secretEnv } = req.body;
  if (!id || !name || !endpoint) return res.status(400).json({ error: 'id, name and endpoint are required' });
  const providers = loadProviders();
  const idx = providers.findIndex(p => p.id === id);
  const entry = { id, name, endpoint, description: description || '', secretEnv: secretEnv || `AI_API_KEY_${id.toUpperCase()}` };
  if (idx >= 0) providers[idx] = entry; else providers.push(entry);
  saveProviders(providers);
  res.json({ ok: true, provider: entry });
});

// DELETE /api/providers/:id
app.delete('/api/providers/:id', (req, res) => {
  const id = req.params.id;
  let providers = loadProviders();
  providers = providers.filter(p => p.id !== id);
  saveProviders(providers);
  res.json({ ok: true });
});

// POST /api/ask - receives { prompt, providerId } and forwards to chosen provider
app.post('/api/ask', async (req, res) => {
  const prompt = req.body.prompt || '';
  const providerId = req.body.providerId || process.env.AI_DEFAULT_PROVIDER || null;

  if (!prompt) return res.status(400).json({ error: 'Empty prompt' });

  const providers = loadProviders();
  let provider = null;
  if (providerId) provider = providers.find(p => p.id === providerId);
  if (!provider && providers.length) provider = providers[0];

  if (!provider) {
    return res.json({ reply: `Demo: recibí tu prompt de ${prompt.length} caracteres. (No hay proveedores configurados)` });
  }

  // Resolve API key from environment variable name (secretEnv) or fallback to AI_API_KEY_{ID}
  const keyEnv = provider.secretEnv || `AI_API_KEY_${provider.id.toUpperCase()}`;
  const apiKey = process.env[keyEnv] || '';

  try {
    const resp = await fetch(provider.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({ prompt, provider: provider.id })
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
