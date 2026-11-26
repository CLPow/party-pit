import { RELAY_BASE } from './net.js';

const CSS = `
.fb-tab { position: fixed; right: 0; top: 50%; z-index: 45; transform: translateY(-50%); writing-mode: vertical-rl; padding: 14px 7px; border: 0; border-radius: 12px 0 0 12px; background: linear-gradient(180deg, #ffd35a, #f0a417); color: #2a1a00; font: 800 13px/1 Inter, system-ui, sans-serif; letter-spacing: .06em; cursor: pointer; box-shadow: -4px 6px 18px rgba(0,0,0,.4); }
.fb-tab:hover { padding-right: 10px; }
.fb-back { position: fixed; inset: 0; z-index: 90; background: rgba(4,8,18,.72); display: grid; place-items: center; padding: 16px; }
.fb-card { width: min(440px, 100%); max-height: calc(100% - 16px); overflow-y: auto; background: #141d35; color: #f3f5ff; border: 1px solid rgba(255,255,255,.14); border-radius: 22px; padding: 18px; box-shadow: 0 30px 80px rgba(0,0,0,.6); font: 15px/1.45 Inter, system-ui, sans-serif; -webkit-user-select: none; user-select: none; }
.fb-card h3 { margin: 0 0 4px; font-size: 1.25rem; }
.fb-card p { margin: 0 0 12px; color: #9aa6c8; font-size: .9rem; }
.fb-stars { display: flex; gap: 6px; margin-bottom: 12px; }
.fb-stars button { width: 40px; height: 40px; border-radius: 12px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.06); font-size: 1.3rem; cursor: pointer; filter: grayscale(1) opacity(.55); }
.fb-stars button.on { filter: none; background: rgba(255,197,61,.16); border-color: #ffc53d; }
.fb-card label { display: block; font-size: .82rem; color: #9aa6c8; margin: 0 0 4px; font-weight: 600; }
.fb-card textarea, .fb-card input { width: 100%; box-sizing: border-box; background: rgba(0,0,0,.3); color: #f3f5ff; border: 1px solid rgba(255,255,255,.14); border-radius: 12px; padding: 10px 12px; font: inherit; margin-bottom: 12px; -webkit-user-select: text; user-select: text; }
.fb-card textarea { min-height: 120px; resize: vertical; }
.fb-row { display: flex; justify-content: flex-end; align-items: center; gap: 8px; }
.fb-row span { margin-right: auto; color: #9aa6c8; font-size: .8rem; }
.fb-btn { border: 0; border-radius: 14px; padding: 10px 18px; font: 700 15px Inter, system-ui, sans-serif; cursor: pointer; background: rgba(255,255,255,.08); color: #f3f5ff; }
.fb-btn.go { background: linear-gradient(180deg, #ffd35a, #f0a417); color: #2a1a00; }
.fb-btn:disabled { opacity: .5; cursor: default; }
.fb-ok { text-align: center; padding: 10px 0; }
.fb-ok b { display: block; font-size: 2.4rem; }
@media (orientation: landscape) and (max-height: 560px) { .fb-tab { padding: 10px 5px; font-size: 11px; } }
`;

const SCREENS = ['home', 'lobby'];
const shown = (el) => el && !el.hidden && getComputedStyle(el).display !== 'none';

export function initFeedback({ game, always = false }) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const tab = document.createElement('button');
  tab.className = 'fb-tab';
  tab.type = 'button';
  tab.textContent = 'Feedback';
  tab.setAttribute('aria-label', 'Send feedback');
  document.body.appendChild(tab);
  tab.addEventListener('click', () => open(game));
  const sync = () => {
    const on = always || SCREENS.some((id) => shown(document.getElementById(id)));
    if (tab.hidden === on) tab.hidden = !on;
  };
  sync();
  setInterval(sync, 1000);
}

function open(game) {
  const back = document.createElement('div');
  back.className = 'fb-back';
  const nameIn = document.getElementById('nameIn');
  const name = (nameIn && nameIn.value.trim()) || '';
  back.innerHTML = `<div class="fb-card" role="dialog" aria-label="Feedback">
    <h3>💬 Feedback</h3>
    <p>Found a bug, have an idea, or loved something? Tell us.</p>
    <div class="fb-stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-r="${n}" aria-label="${n} stars">⭐</button>`).join('')}</div>
    <label for="fbText">Your feedback</label>
    <textarea id="fbText" maxlength="1000" placeholder="What happened, or what would make the game better?"></textarea>
    <label for="fbName">Name (optional)</label>
    <input id="fbName" maxlength="24" value="${name.replace(/"/g, '&quot;')}">
    <label for="fbContact">How can we reach you? (optional)</label>
    <input id="fbContact" maxlength="80" placeholder="Email, Discord, anything">
    <div class="fb-row"><span id="fbCount">0 / 1000</span><button type="button" class="fb-btn" data-x>Cancel</button><button type="button" class="fb-btn go" id="fbGo" disabled>Send</button></div>
  </div>`;
  document.body.appendChild(back);
  const $ = (s) => back.querySelector(s);
  let rating = 0;
  const close = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back || e.target.matches('[data-x]')) close(); });
  back.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
    rating = Number(b.dataset.r) === rating ? 0 : Number(b.dataset.r);
    back.querySelectorAll('[data-r]').forEach((x) => x.classList.toggle('on', Number(x.dataset.r) <= rating));
  }));
  $('#fbText').addEventListener('input', () => {
    const n = $('#fbText').value.trim().length;
    $('#fbCount').textContent = `${$('#fbText').value.length} / 1000`;
    $('#fbGo').disabled = n < 3;
  });
  $('#fbGo').addEventListener('click', async () => {
    $('#fbGo').disabled = true;
    $('#fbGo').textContent = 'Sending…';
    let ok = false;
    try {
      const res = await fetch(RELAY_BASE + '/feedback', {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify({ game, rating, text: $('#fbText').value.trim(), name: $('#fbName').value.trim(), contact: $('#fbContact').value.trim(), wd: navigator.webdriver ? 1 : 0 }),
      });
      ok = res.ok;
    } catch { /* offline */ }
    if (!ok) {
      $('#fbGo').disabled = false;
      $('#fbGo').textContent = 'Try again';
      $('#fbCount').textContent = 'Could not send. Check your connection.';
      return;
    }
    back.querySelector('.fb-card').innerHTML = '<div class="fb-ok"><b>🙏</b><h3>Thanks!</h3><p>Your feedback was sent.</p><button type="button" class="fb-btn go" data-x>Close</button></div>';
  });
  setTimeout(() => $('#fbText').focus(), 50);
}
