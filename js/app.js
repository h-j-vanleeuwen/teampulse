import { state } from './state.js';
import { loadPin, updatePinDots } from './pin.js';
import { loadAll } from './admin.js';
import { renderSurvey, loadRoundFromUrl } from './survey.js';
import { fetchResults } from './results.js';
import { initConfetti } from './confetti.js';

export function showPage(p) {
  document.querySelectorAll('.page').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(e => e.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(e => {
    if (e.textContent.trim().toLowerCase() === p) e.classList.add('active');
  });
  if (p === 'survey') renderSurvey();
  if (p === 'results') fetchResults();
}

export function showPageGuarded(p) {
  if (state.adminUnlocked) { showPage(p); return; }
  state.pinTarget = p;
  state.pinEntry = '';
  document.getElementById('pin-err').textContent = '';
  document.getElementById('pin-title').textContent = p === 'results' ? 'Results access' : 'Admin access';
  updatePinDots();
  document.getElementById('pin-overlay').style.display = 'flex';
}

async function boot() {
  await loadPin();
  if (state.adminUnlocked) document.getElementById('admin-badge').style.display = 'flex';
  await loadAll();
  const hasRound = await loadRoundFromUrl();
  showPage(hasRound ? 'survey' : 'survey');
}

window.showPage = showPage;
window.showPageGuarded = showPageGuarded;

initConfetti();

boot().catch(e => console.error('Boot failed:', e));
