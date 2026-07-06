import { saveResp, getRoundById } from './api.js';
import { state } from './state.js';
import { t, getQs } from './i18n.js';
import { COL } from './config.js';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderSurvey() {
  const el = document.getElementById('survey-body');
  if (!state.sv.round) { renderSvSelectRound(el); return; }
  if (state.sv.step === -2) { renderSvIntro(el); return; }
  if (state.sv.step === -1) { renderSvName(el); return; }
  const activeQs = getQs().filter(q => state.sv.round.questions.includes(q.n));
  if (state.sv.step >= activeQs.length) { renderSvDone(el); return; }
  renderSvQ(el, activeQs);
}

export async function loadRoundFromUrl() {
  const params = new URLSearchParams(location.search);
  const roundParam = params.get('round');
  if (!roundParam) return false;
  try {
    const res = await getRoundById(roundParam);
    if (res && res.length) {
      const r = res[0];
      state.sv = {
        round: {
          id: r.id,
          label: r.label,
          teamName: r.teams ? r.teams.name : '',
          questions: JSON.parse(r.questions || '[]'),
        },
        firstName: '',
        lastName: '',
        answers: {},
        step: -2,
      };
      return true;
    }
  } catch (e) {
    console.error('Could not load round:', e);
  }
  return false;
}

function renderSvSelectRound(el) {
  el.innerHTML = `<div class="empty-state card">
    <div class="empty-icon">&#128279;</div>
    <div class="font-bold" style="margin-bottom:8px;color:var(--ink)">${t('survey.no_link')}</div>
    <div class="text-sm">${t('survey.no_link_sub')}</div>
  </div>`;
}

function renderSvIntro(el) {
  const rows = [
    { cat: 'Confiance',      dysKey: 'cover.dys.trust',          healthyKey: 'cover.healthy.trust' },
    { cat: 'Conflit',        dysKey: 'cover.dys.conflict',       healthyKey: 'cover.healthy.conflict' },
    { cat: 'Engagement',     dysKey: 'cover.dys.commitment',     healthyKey: 'cover.healthy.commitment' },
    { cat: 'Responsabilite', dysKey: 'cover.dys.accountability', healthyKey: 'cover.healthy.accountability' },
    { cat: 'Resultats',      dysKey: 'cover.dys.results',        healthyKey: 'cover.healthy.results' },
  ];
  const rowsHtml = rows.map(r => `
    <div class="cover-row">
      <div class="cover-row-dys">
        <span class="cover-row-dot" style="background:${COL[r.cat]}"></span>
        ${escapeHtml(t(r.dysKey))}
      </div>
      <div class="cover-row-arrow">→</div>
      <div class="cover-row-healthy">${escapeHtml(t(r.healthyKey))}</div>
    </div>`).join('');

  el.innerHTML = `
  <div class="survey-q-card survey-intro-card">
    <div class="survey-intro-team">${escapeHtml(state.sv.round.teamName)} &nbsp;·&nbsp; ${escapeHtml(state.sv.round.label)}</div>
    <p class="survey-intro-pain">${t('cover.pain')}</p>
    <div class="survey-intro-table-label">${t('cover.table_label')}</div>
    <div class="cover-contrast">
      <div class="cover-contrast-header">
        <span>${t('cover.today')}</span>
        <span></span>
        <span>${t('cover.goal')}</span>
      </div>
      ${rowsHtml}
    </div>
    <p class="survey-intro-conclusion">${t('cover.conclusion')}</p>
    <div style="text-align:center;margin-top:1.5rem">
      <button class="btn btn-primary" onclick="svStartSurvey()">${t('survey.start')}</button>
      <div class="survey-intro-cta">${t('cover.cta')}</div>
    </div>
  </div>`;
}

function renderSvName(el) {
  el.innerHTML = `<div class="survey-q-card">
    <div style="font-size:12px;color:var(--ink3);font-weight:600;margin-bottom:1rem">${escapeHtml(state.sv.round.teamName)} &nbsp;&middot;&nbsp; ${escapeHtml(state.sv.round.label)}</div>
    <div style="font-family:var(--font-display);font-size:20px;margin-bottom:1.5rem">${t('survey.intro')}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:1.5rem">
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink3)">${t('survey.firstname')}</label>
        <input type="text" id="sv-first" placeholder="${t('survey.firstname')}" value="${state.sv.firstName}">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink3)">${t('survey.lastname')}</label>
        <input type="text" id="sv-last" placeholder="${t('survey.lastname')}" value="${state.sv.lastName}">
      </div>
    </div>
    <div class="text-sm" style="margin-bottom:1.5rem">${t('survey.count', { n: state.sv.round.questions.length })}</div>
    <div class="row" style="justify-content:flex-end">
      <button class="btn btn-primary" onclick="beginQuestions()">${t('survey.start')}</button>
    </div>
  </div>`;
  setTimeout(() => { const f = document.getElementById('sv-first'); if (f) f.focus(); }, 100);
}

function renderSvQ(el, activeQs) {
  const q = activeQs[state.sv.step];
  const ans = state.sv.answers[q.n] || {};
  const score = ans.score;
  const comment = ans.comment || '';
  const pct = (state.sv.step / activeQs.length * 100).toFixed(0);
  el.innerHTML = `
  <div class="survey-progress">
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="progress-label">${t('survey.answered', { i: state.sv.step, n: activeQs.length })} &nbsp;&middot;&nbsp; ${escapeHtml(state.sv.round.teamName)} &nbsp;&middot;&nbsp; ${escapeHtml(state.sv.round.label)}</div>
  </div>
  <div class="survey-q-card">
    <div class="q-cat-row"><span style="font-size:12px;color:var(--ink3);font-weight:600">${t('survey.question_of', { i: state.sv.step + 1, n: activeQs.length })}</span></div>
    <div class="q-body">${q.text}</div>
    <div class="scale-row">${[1, 2, 3, 4, 5].map(v => `<button class="scale-btn ${score === v ? 'selected' : ''}" onclick="setScore(${q.n},${v})">${v}</button>`).join('')}</div>
    <div class="scale-labels"><span class="scale-label">${t('survey.never')}</span><span class="scale-label">${t('survey.rarely')}</span><span class="scale-label">${t('survey.occasionally')}</span><span class="scale-label">${t('survey.mostofthetime')}</span><span class="scale-label">${t('survey.always')}</span></div>
    <div class="q-comment">
      <label>${t('survey.comment_label')}</label>
      <textarea id="q-comment-${q.n}" placeholder="${t('survey.comment_placeholder')}">${comment}</textarea>
    </div>
  </div>
  <div class="survey-nav">
    <button class="btn btn-outline btn-sm" onclick="svBack()">${t('survey.back')}</button>
    <button class="btn btn-primary btn-sm" id="nxt" onclick="svNext(${activeQs.length})" ${score === undefined ? 'disabled' : ''}>
      ${state.sv.step === activeQs.length - 1 ? t('survey.submit') : t('survey.next')}
    </button>
  </div>`;
}

function renderSvDone(el) {
  el.innerHTML = `<div class="survey-q-card" style="text-align:center;padding:3.5rem 2rem">
    <div style="font-size:52px;margin-bottom:1.25rem">&#128591;</div>
    <div style="font-family:var(--font-display);font-size:30px;margin-bottom:12px;letter-spacing:-0.02em">${t('survey.done_title')}</div>
    <div style="color:var(--ink2);font-size:15px;line-height:1.7;max-width:420px;margin:0 auto">
      ${t('survey.done_sub')}
    </div>
  </div>`;
}

function saveCurrentComment() {
  const activeQs = getQs().filter(q => state.sv.round.questions.includes(q.n));
  if (state.sv.step < 0 || state.sv.step >= activeQs.length) return;
  const q = activeQs[state.sv.step];
  const commentEl = document.getElementById('q-comment-' + q.n);
  if (!commentEl) return;
  if (!state.sv.answers[q.n]) state.sv.answers[q.n] = {};
  state.sv.answers[q.n].comment = commentEl.value;
}

window.svStartSurvey = function () {
  state.sv.step = -1;
  renderSurvey();
};

window.beginQuestions = function () {
  const first = document.getElementById('sv-first').value.trim();
  const last = document.getElementById('sv-last').value.trim();
  if (!first) document.getElementById('sv-first').classList.add('input-error');
  if (!last) document.getElementById('sv-last').classList.add('input-error');
  if (!first || !last) return;
  state.sv.firstName = first;
  state.sv.lastName = last;
  state.sv.step = 0;
  renderSurvey();
};

window.setScore = function (qn, val) {
  if (!state.sv.answers[qn]) state.sv.answers[qn] = {};
  state.sv.answers[qn].score = val;
  const commentEl = document.getElementById('q-comment-' + qn);
  if (commentEl) state.sv.answers[qn].comment = commentEl.value;
  document.querySelectorAll('.scale-row .scale-btn').forEach((btn, idx) => {
    btn.classList.toggle('selected', idx + 1 === val);
  });
  const nextBtn = document.getElementById('nxt');
  if (nextBtn) nextBtn.disabled = false;
};

window.svBack = function () {
  saveCurrentComment();
  if (state.sv.step === 0) { state.sv.step = -1; renderSurvey(); return; }
  if (state.sv.step > 0) { state.sv.step--; renderSurvey(); }
};

window.svNext = async function (total) {
  saveCurrentComment();
  const activeQs = getQs().filter(q => state.sv.round.questions.includes(q.n));
  if (state.sv.step < activeQs.length - 1) { state.sv.step++; renderSurvey(); return; }

  const btn = document.getElementById('nxt');
  btn.disabled = true;
  btn.innerHTML = `${t('survey.saving')} <span class="spinner"></span>`;
  try {
    await saveResp(state.sv.round.id, state.sv.firstName, state.sv.lastName, state.sv.answers);
    renderSvDone(document.getElementById('survey-body'));
    state.sv = { round: null, firstName: '', lastName: '', answers: {}, step: 0 };
  } catch (e) {
    btn.disabled = false;
    btn.textContent = t('survey.submit');
    alert(t('survey.save_error'));
  }
};
