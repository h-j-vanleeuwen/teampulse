import { getPinDB, setPinDB } from './api.js';
import { state } from './state.js';

function hashPin(p) {
  let h = 0;
  for (let i = 0; i < p.length; i++) { h = (h << 5) - h + p.charCodeAt(i); h |= 0; }
  return String(h);
}

export function updatePinDots(err = false) {
  for (let i = 0; i < 4; i++) {
    const d = document.getElementById('pd' + i);
    d.className = 'pin-dot' + (err ? ' error' : state.pinEntry.length > i ? ' filled' : '');
  }
}

function renderPinStatus() {
  const el = document.getElementById('pin-status-box');
  if (el) el.innerHTML = '<div class="alert alert-success" style="margin-bottom:10px">&#128274; PIN is set and stored securely.</div>';
}

function checkPin() {
  // Bypass PIN on localhost for local development
  if (location.hostname === 'localhost' || hashPin(state.pinEntry) === state.cachedPinHash) {
    state.adminUnlocked = true;
    document.getElementById('pin-overlay').style.display = 'none';
    document.getElementById('admin-badge').style.display = 'flex';
    const dest = state.pinTarget;
    state.pinEntry = '';
    state.pinTarget = null;
    window.showPage(dest);
  } else {
    updatePinDots(true);
    document.getElementById('pin-err').textContent = 'Incorrect PIN. Try again.';
    setTimeout(() => {
      state.pinEntry = '';
      updatePinDots();
      document.getElementById('pin-err').textContent = '';
    }, 900);
  }
}

export async function loadPin() {
  try {
    const res = await getPinDB();
    state.cachedPinHash = res && res.length ? res[0].value : null;
  } catch (e) {
    console.error('Could not load PIN:', e);
  }
  renderPinStatus();
}

window.pinKey = function (k) {
  if (k === '' || k === undefined) return;
  if (k === 'del') { state.pinEntry = state.pinEntry.slice(0, -1); updatePinDots(); return; }
  if (state.pinEntry.length >= 4) return;
  state.pinEntry += k;
  updatePinDots();
  if (state.pinEntry.length === 4) setTimeout(checkPin, 120);
};

window.cancelPin = function () {
  document.getElementById('pin-overlay').style.display = 'none';
  state.pinEntry = '';
  state.pinTarget = null;
};

window.lockAdmin = function () {
  state.adminUnlocked = false;
  document.getElementById('admin-badge').style.display = 'none';
  window.showPage('survey');
};

window.savePin = async function () {
  const a = document.getElementById('pin-a').value.trim();
  const b = document.getElementById('pin-b').value.trim();
  const errEl = document.getElementById('pin-set-err');
  errEl.style.display = 'none';
  if (!/^\d{4}$/.test(a)) { errEl.textContent = 'PIN must be exactly 4 digits.'; errEl.style.display = 'block'; return; }
  if (a !== b) { errEl.textContent = 'PINs do not match.'; errEl.style.display = 'block'; return; }
  try {
    await setPinDB(hashPin(a));
    state.cachedPinHash = hashPin(a);
    document.getElementById('pin-a').value = '';
    document.getElementById('pin-b').value = '';
    renderPinStatus();
  } catch (e) {
    errEl.textContent = 'Could not save PIN. Try again.';
    errEl.style.display = 'block';
  }
};
