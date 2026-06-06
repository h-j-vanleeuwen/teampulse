import { saveResp, getRoundById } from './api.js';
import { Qs, CAT } from './config.js';
import { state } from './state.js';

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
  if (state.sv.step === -1) { renderSvName(el); return; }
  const activeQs = Qs.filter(q => state.sv.round.questions.includes(q.n));
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
        step: -1,
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
    <div class="font-bold" style="margin-bottom:8px;color:var(--ink)">No survey link detected</div>
    <div class="text-sm">To fill out a survey, please use the personal link provided by your team admin.</div>
  </div>`;
}

function renderSvName(el) {
  el.innerHTML = `<div class="survey-q-card">
    <div style="font-size:12px;color:var(--ink3);font-weight:600;margin-bottom:1rem">${escapeHtml(state.sv.round.teamName)} &nbsp;&middot;&nbsp; ${escapeHtml(state.sv.round.label)}</div>
    <div style="font-family:var(--font-display);font-size:20px;margin-bottom:1.5rem">Before you begin, please introduce yourself</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:1.5rem">
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink3)">First name</label>
        <input type="text" id="sv-first" placeholder="First name" value="${state.sv.firstName}">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink3)">Last name</label>
        <input type="text" id="sv-last" placeholder="Last name" value="${state.sv.lastName}">
      </div>
    </div>
    <div class="text-sm" style="margin-bottom:1.5rem">This assessment has <strong>${state.sv.round.questions.length} questions</strong>. Your answers will be visible to your team admin.</div>
    <div class="row" style="justify-content:flex-end">
      <button class="btn btn-primary" onclick="beginQuestions()">Start survey</button>
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
    <div class="progress-label">${state.sv.step} of ${activeQs.length} answered &nbsp;&middot;&nbsp; ${escapeHtml(state.sv.round.teamName)} &nbsp;&middot;&nbsp; ${escapeHtml(state.sv.round.label)}</div>
  </div>
  <div class="survey-q-card">
    <div class="q-cat-row"><span style="font-size:12px;color:var(--ink3);font-weight:600">Question ${state.sv.step + 1} of ${activeQs.length}</span></div>
    <div class="q-body">${q.text}</div>
    <div class="scale-row">${[1, 2, 3, 4, 5].map(v => `<button class="scale-btn ${score === v ? 'selected' : ''}" onclick="setScore(${q.n},${v})">${v}</button>`).join('')}</div>
    <div class="scale-labels"><span class="scale-label">Never</span><span class="scale-label">Rarely</span><span class="scale-label">Occasionally</span><span class="scale-label">Most of the time</span><span class="scale-label">Always</span></div>
    <div class="q-comment">
      <label>Comment (optional)</label>
      <textarea id="q-comment-${q.n}" placeholder="Any context, anecdote or clarification for this question...">${comment}</textarea>
    </div>
  </div>
  <div class="survey-nav">
    <button class="btn btn-outline btn-sm" onclick="svBack()">Back</button>
    <button class="btn btn-primary btn-sm" id="nxt" onclick="svNext(${activeQs.length})" ${score === undefined ? 'disabled' : ''}>
      ${state.sv.step === activeQs.length - 1 ? 'Submit' : 'Next'}
    </button>
  </div>`;
}

function renderSvDone(el) {
  el.innerHTML = `<div class="survey-q-card" style="text-align:center;padding:3.5rem 2rem">
    <div style="font-size:52px;margin-bottom:1.25rem">&#128591;</div>
    <div style="font-family:var(--font-display);font-size:30px;margin-bottom:12px;letter-spacing:-0.02em">Thank you!</div>
    <div style="color:var(--ink2);font-size:15px;line-height:1.7;max-width:420px;margin:0 auto">
      Thank you for filling out this questionnaire &mdash; your input is of utmost importance to us.
    </div>
  </div>`;
}

function saveCurrentComment() {
  const activeQs = Qs.filter(q => state.sv.round.questions.includes(q.n));
  if (state.sv.step < 0 || state.sv.step >= activeQs.length) return;
  const q = activeQs[state.sv.step];
  const commentEl = document.getElementById('q-comment-' + q.n);
  if (!commentEl) return;
  if (!state.sv.answers[q.n]) state.sv.answers[q.n] = {};
  state.sv.answers[q.n].comment = commentEl.value;
}

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
  const activeQs = Qs.filter(q => state.sv.round.questions.includes(q.n));
  renderSvQ(document.getElementById('survey-body'), activeQs);
};

window.svBack = function () {
  saveCurrentComment();
  if (state.sv.step === 0) { state.sv.step = -1; renderSurvey(); return; }
  if (state.sv.step > 0) { state.sv.step--; renderSurvey(); }
};

window.svNext = async function (total) {
  saveCurrentComment();
  const activeQs = Qs.filter(q => state.sv.round.questions.includes(q.n));
  if (state.sv.step < activeQs.length - 1) { state.sv.step++; renderSurvey(); return; }

  const btn = document.getElementById('nxt');
  btn.disabled = true;
  btn.innerHTML = 'Saving... <span class="spinner"></span>';
  try {
    await saveResp(state.sv.round.id, state.sv.firstName, state.sv.lastName, state.sv.answers);
    renderSvDone(document.getElementById('survey-body'));
    state.sv = { round: null, firstName: '', lastName: '', answers: {}, step: 0 };
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Submit';
    alert('Save failed, please retry.');
  }
};
