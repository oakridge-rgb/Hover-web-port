// Evaluate fate-sw.js the way a SW global scope would — catch any eval-time throw
const fs = require('fs');
const code = fs.readFileSync('/home/z/my-project/download/v8.2-deploy/fate-sw.js', 'utf8');

const listeners = {};
const shims = {
  self: null,
  clients: { claim: async () => {}, matchAll: async () => [], get: async () => null },
  skipWaiting: async () => {},
  addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); console.log('listener registered:', t); },
  removeEventListener: () => {},
  Response: class {},
  URL: URL,
  MessageChannel: class { constructor(){ this.port1 = {}; this.port2 = {}; } },
  setTimeout: (f, t) => { console.log('setTimeout scheduled (not fired):', String(f).slice(0, 60)); return 0; },
  console: { log: (...a) => console.log('[sw]', ...a), error: (...a) => console.log('[sw-err]', ...a), warn: (...a) => {} },
};
shims.self = shims;
globalThis.self = shims.self;
for (const k of ['clients','skipWaiting','addEventListener','removeEventListener','Response','URL','MessageChannel','setTimeout']) {
  try { globalThis[k] = shims[k]; } catch(e){}
}
try {
  new Function(code)();
  console.log('EVAL OK — no throw');
} catch (e) {
  console.log('EVAL THREW:', e.message);
  console.log(e.stack ? e.stack.split('\n').slice(0,5).join('\n') : '');
}
console.log('listeners after eval:', Object.keys(listeners).join(','));
