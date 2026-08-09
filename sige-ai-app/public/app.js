document.getElementById('send').addEventListener('click', async () => {
  const prompt = document.getElementById('prompt').value.trim();
  const status = document.getElementById('status');
  const reply = document.getElementById('reply');
  status.textContent = '';
  reply.textContent = '';
  if (!prompt) { status.textContent = 'Escribe un prompt.'; return }
  status.textContent = 'Enviando...';
  try {
    const r = await fetch('/api/ask', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ prompt }) });
    const j = await r.json();
    if (j.error) { status.textContent = 'Error: ' + j.error; return }
    status.textContent = 'Respuesta recibida';
    reply.textContent = typeof j.reply === 'string' ? j.reply : JSON.stringify(j.reply, null, 2);
  } catch (e) {
    status.textContent = 'Fallo en la petición';
    reply.textContent = String(e);
  }
});
