const frame = document.querySelector('iframe');
const endpoint = '/api/gruta-do-ocaso';
let session;
let busy = false;

function request(body, keepalive = false) {
  return fetch(endpoint, {
    method: 'POST',
    credentials: 'omit',
    keepalive,
    signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function leave() {
  const member = session;
  session = undefined;
  if (member) void request({ ...member, action: 'leave' }, true).catch(() => {});
}

window.addEventListener('pagehide', leave);
window.addEventListener('message', async (event) => {
  const target = frame.contentWindow;
  if (event.source !== target || event.origin !== 'null') return;
  const { type, height, request: actionData, seq } = event.data ?? {};
  if (type === 'gamesfy:resize' && Number.isFinite(height)) {
    frame.style.height = Math.min(1600, Math.max(430, Math.ceil(height))) + 'px';
    return;
  }
  if (type !== 'ocaso:request' || !actionData || !Number.isSafeInteger(seq)) return;
  const { action, code, kind, mapId, name, map, input } = actionData;
  const reply = (payload) => target.postMessage({ type: 'ocaso:response', seq, payload }, '*');
  if (action === 'leave') {
    leave();
    return reply({ left: true });
  }
  if (!['create', 'join', 'start', 'sync'].includes(action)) return;
  if (busy) return reply({ error: 'Atualização em andamento.' });
  const entering = action === 'create' || action === 'join';
  if (entering) leave();
  busy = true;
  try {
    const response = await request({
      action,
      code,
      kind,
      mapId,
      name,
      map: map === true,
      input,
      ...session,
    });
    const data = await response.json();
    if (response.ok && entering) {
      session = { id: data.id, token: data.token, code: data.code };
      reply({ code: data.code, id: data.id });
    } else {
      if (response.status === 403) session = undefined;
      reply(data);
    }
  } catch {
    reply({ error: 'Sem resposta do servidor. Verifique a conexão.' });
  } finally {
    busy = false;
  }
});
