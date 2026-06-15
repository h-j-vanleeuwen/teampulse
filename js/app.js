import { state } from './state.js';
import { loadAll } from './admin.js';
import { renderSurvey, loadRoundFromUrl } from './survey.js';
import { fetchResults } from './results.js';
import { initConfetti } from './confetti.js';
import { initAuth, getSession, signIn, signOut } from './auth.js';
import { setLang, getLang, t } from './i18n.js';

export function showPage(p) {
  document.querySelectorAll('.page').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(e => e.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(e => {
    if (e.dataset.page === p) e.classList.add('active');
  });
  if (p === 'survey') renderSurvey();
  if (p === 'results') fetchResults();
}

export async function showPageGuarded(p) {
  const session = await getSession();
  if (session) {
    state.adminUnlocked = true;
    document.getElementById('admin-badge').style.display = 'flex';
    showPage(p);
    return;
  }
  state.pinTarget = p;
  document.getElementById('auth-err').textContent = '';
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-overlay').style.display = 'flex';
}

window.submitLogin = async function () {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-err');
  const btn = document.querySelector('#auth-box-login .btn-primary');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = t('auth.loading');
  try {
    await signIn(email, password);
    document.getElementById('auth-overlay').style.display = 'none';
    state.adminUnlocked = true;
    document.getElementById('admin-badge').style.display = 'flex';
    const dest = state.pinTarget;
    state.pinTarget = null;
    showPage(dest);
  } catch (e) {
    errEl.textContent = t('auth.error');
  } finally {
    btn.disabled = false;
    btn.textContent = t('auth.submit');
  }
};

window.cancelAuth = function () {
  document.getElementById('auth-overlay').style.display = 'none';
  state.pinTarget = null;
};

window.lockAdmin = async function () {
  await signOut();
  state.adminUnlocked = false;
  document.getElementById('admin-badge').style.display = 'none';
  window.showPage('survey');
};

function refreshStaticI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

window.setLangAndRefresh = function (lang) {
  setLang(lang);
  refreshStaticI18n();
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const pageId = activePage.id.replace('page-', '');
  if (pageId === 'survey') renderSurvey();
  else if (pageId === 'admin') loadAll();
  else if (pageId === 'results') fetchResults();
};

async function boot() {
  const session = await initAuth();
  if (session) {
    state.adminUnlocked = true;
    document.getElementById('admin-badge').style.display = 'flex';
  }
  refreshStaticI18n();
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === getLang());
  });
  await loadAll();
  const hasRound = await loadRoundFromUrl();
  if (hasRound) {
    showPage('survey');
  } else {
    await showPageGuarded('results');
  }
}

window.showPage = showPage;
window.showPageGuarded = showPageGuarded;

initConfetti();

boot().catch(e => console.error('Boot failed:', e));
