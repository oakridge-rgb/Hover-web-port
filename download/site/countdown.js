/* ================================================================
   FATE V7 — LAUNCH COUNTDOWN
   Add to any page:  <script src="countdown.js"></script>
   (put it after theme.js so it picks up the theme colors)

   Shows a banner counting down to launch:
     Nov 19, 2026 · 6:05 AM Central
   When the moment passes it flips to "FATE V7 IS LIVE".
   Colors follow your FATE V7 theme automatically (CSS vars).

   Change the date before this script with:
   window.FATE_LAUNCH_AT = '2026-11-19T06:05:00-06:00';
   ================================================================ */
(function () {
  var TARGET = '2026-11-19T06:05:00-06:00'; /* Nov 19 · 6:05 AM Central (CST) */
  if (window.FATE_LAUNCH_AT) TARGET = window.FATE_LAUNCH_AT;
  var target = new Date(TARGET).getTime();
  if (isNaN(target)) return;

  var css = [
    '.fate-cd{margin:0 auto 18px;padding:13px 18px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;',
      'gap:10px 18px;background:rgba(var(--panel-rgb,28,13,4),0.55);border:1px solid var(--glass-border,rgba(255,255,255,0.08));',
      'border-radius:16px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);position:relative;z-index:5;overflow:hidden;text-align:center}',
    '.fate-cd::before{content:"";position:absolute;inset:0;pointer-events:none;',
      'background:linear-gradient(90deg,transparent,rgba(var(--primary-rgb,255,122,0),0.09),transparent)}',
    '.fate-cd>*{position:relative}',
    '.fate-cd-badge{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.18em;',
      'text-transform:uppercase;color:var(--text,#f8fafc);white-space:nowrap}',
    '.fate-cd-dot{width:8px;height:8px;border-radius:50%;background:var(--primary,#ff7a00);flex:0 0 auto;',
      'box-shadow:0 0 12px var(--primary-glow,rgba(255,122,0,0.45));animation:fateCdPulse 1.6s ease-in-out infinite}',
    '@keyframes fateCdPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.55}}',
    '.fate-cd-cells{display:flex;gap:10px;justify-content:center}',
    '.fate-cd-cell{min-width:64px;padding:8px 10px 6px;border-radius:12px;',
      'background:rgba(var(--panel2-rgb,12,6,2),0.6);border:1px solid var(--glass-border,rgba(255,255,255,0.08))}',
    '.fate-cd-num{display:block;font-size:clamp(1.3rem,4.5vw,1.9rem);font-weight:900;line-height:1;',
      'font-variant-numeric:tabular-nums;color:var(--primary,#ff7a00);',
      'background:linear-gradient(180deg,var(--grad-a,#ffa41c),var(--grad-b,#ff6200));',
      '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}',
    '.fate-cd-lbl{display:block;margin-top:4px;font-size:8.5px;font-weight:700;letter-spacing:.22em;',
      'text-transform:uppercase;color:var(--text-muted,#b8b0a8)}',
    '.fate-cd-when{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;',
      'color:var(--text-muted,#b8b0a8);white-space:nowrap}',
    '.fate-cd-when b{color:var(--primary,#ff7a00)}',
    '.fate-cd-live{font-size:clamp(1.1rem,4vw,1.6rem);font-weight:900;letter-spacing:.12em;text-transform:uppercase;',
      'color:var(--primary,#ff7a00);background:linear-gradient(90deg,var(--grad-a,#ffa41c),var(--grad-b,#ff6200));',
      '-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;',
      'animation:fateCdGlow 2s ease-in-out infinite}',
    '@keyframes fateCdGlow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35)}}',
    '@media(max-width:560px){',
      '.fate-cd{padding:11px 12px;gap:8px 12px}',
      '.fate-cd-cell{min-width:52px;padding:7px 8px 5px}',
      '.fate-cd-when{white-space:normal;width:100%}}'
  ].join('');

  function build() {
    if (document.getElementById('fateCountdown')) return;
    var st = document.createElement('style');
    st.id = 'fateCountdownStyle';
    st.textContent = css;
    document.head.appendChild(st);

    var el = document.createElement('div');
    el.className = 'fate-cd';
    el.id = 'fateCountdown';
    el.innerHTML =
      '<span class="fate-cd-badge"><span class="fate-cd-dot"></span><span id="fateCdBadgeTxt">FATE V7 launches in</span></span>' +
      '<span class="fate-cd-cells" id="fateCdCells">' +
        '<span class="fate-cd-cell"><b class="fate-cd-num" id="fateCdD">--</b><span class="fate-cd-lbl">Days</span></span>' +
        '<span class="fate-cd-cell"><b class="fate-cd-num" id="fateCdH">--</b><span class="fate-cd-lbl">Hrs</span></span>' +
        '<span class="fate-cd-cell"><b class="fate-cd-num" id="fateCdM">--</b><span class="fate-cd-lbl">Min</span></span>' +
        '<span class="fate-cd-cell"><b class="fate-cd-num" id="fateCdS">--</b><span class="fate-cd-lbl">Sec</span></span>' +
      '</span>' +
      '<span class="fate-cd-when">Nov 19 &middot; <b>6:05 AM CT</b></span>';

    var host = document.querySelector('main') || document.body;
    host.insertBefore(el, host.firstChild);
    return el;
  }

  var live = false;
  function tick() {
    var el = document.getElementById('fateCountdown');
    if (!el) return;
    var diff = target - Date.now();
    if (diff <= 0 && !live) {
      live = true;
      var cells = document.getElementById('fateCdCells');
      var when = el.querySelector('.fate-cd-when');
      if (cells) cells.style.display = 'none';
      if (when) when.style.display = 'none';
      var badge = document.getElementById('fateCdBadgeTxt');
      if (badge) badge.textContent = 'FATE V7';
      var pill = document.createElement('span');
      pill.className = 'fate-cd-live';
      pill.textContent = 'FATE V7 is live';
      el.appendChild(pill);
      return;
    }
    if (live || diff <= 0) return;
    var s = Math.floor(diff / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    var $ = function (id) { return document.getElementById(id); };
    if ($('fateCdD')) $('fateCdD').textContent = pad(d);
    if ($('fateCdH')) $('fateCdH').textContent = pad(h);
    if ($('fateCdM')) $('fateCdM').textContent = pad(m);
    if ($('fateCdS')) $('fateCdS').textContent = pad(s);
  }

  function boot() {
    build();
    tick();
    setInterval(tick, 1000);
    window.FATE_countdown = { target: target, el: document.getElementById('fateCountdown') };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
