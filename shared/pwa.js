const NAME = document.title;

let deferred = null;
let wakeLock = null;
let wantAwake = false;

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function initPwa({ toast }) {
  if ('serviceWorker' in navigator && !new URLSearchParams(location.search).has('nosw')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {});
    });
  }

  const box = document.getElementById('installBox');
  const btn = document.getElementById('installBtn');
  const hint = document.getElementById('installHint');
  if (!box || isStandalone()) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    box.hidden = false;
    btn.hidden = false;
    hint.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    box.hidden = true;
    toast(`${NAME} is installed. Open it from your home screen or app list.`, 'good');
  });

  btn.addEventListener('click', async () => {
    if (deferred) {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      if (outcome === 'accepted') box.hidden = true;
      return;
    }
    hint.hidden = !hint.hidden;
  });

  if (isIOS()) {
    box.hidden = false;
    hint.textContent = 'On iPhone or iPad: tap the Share button in Safari, then "Add to Home Screen".';
    btn.textContent = `📲 Add ${NAME} to your home screen`;
  }
}

async function acquire() {
  if (!wantAwake || wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acquire(); });

export function keepAwake(on) {
  wantAwake = on;
  if (on) acquire();
  else if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}
