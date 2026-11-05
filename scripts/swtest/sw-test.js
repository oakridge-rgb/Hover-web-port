importScripts('./curl/index.plain.js');
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('message', async e => {
  if (!e.data || e.data.type !== 'test-init') return;
  let result;
  try {
    const c = new self.LibcurlClient({ wisp: 'wss://lane.test/' });
    await c.init();
    result = { ok: true, hasSession: !!c.session };
  } catch (err){
    result = { ok: false, err: String((err && err.message) || err), stack: String((err && err.stack) || '').slice(0, 700) };
  }
  try { e.source.postMessage({ type: 'test-init-result', result }); } catch (x){}
});
