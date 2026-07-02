import { getTeams, addTeamDB, delTeamDB, getRounds, addRoundDB, updateRoundDB, updateRoundQs, delRoundDB } from './api.js';
import { state } from './state.js';
import { t, getQs } from './i18n.js';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function loadAll() {
  try {
    const [teams, rounds] = await Promise.all([getTeams(), getRounds()]);
    state.teams = teams;
    state.rounds = rounds;
    renderTeams();
  } catch (e) {
    document.getElementById('team-list').innerHTML = '<div class="alert alert-error">Failed to load data.</div>';
  }
}

function renderTeams() {
  const el = document.getElementById('team-list');
  if (!state.teams.length) {
    el.innerHTML = `<div class="text-sm" style="color:var(--ink3)">${t('admin.no_teams')}</div>`;
    return;
  }
  el.innerHTML = state.teams.map(t_ => `
    <div class="team-chip ${t_.id === state.activeTeamId ? 'active' : ''}" onclick="selectTeam('${t_.id}')">
      <span class="team-chip-name">${escapeHtml(t_.name)}</span>
      <button class="team-chip-del" onclick="event.stopPropagation();rmTeam('${t_.id}','${escapeHtml(t_.name)}')">x</button>
    </div>`).join('');
}

window.selectTeam = function (id) {
  state.activeTeamId = id;
  state.activeRoundId = null;
  const team = state.teams.find(t_ => t_.id === id);
  document.getElementById('rounds-team-name').textContent = team ? team.name : '';
  document.getElementById('rounds-card').style.display = 'block';
  document.getElementById('round-qs-card').style.display = 'none';
  document.getElementById('round-link-card').style.display = 'none';
  renderTeams();
  renderRounds();
};

window.addTeam = async function () {
  const inp = document.getElementById('new-team');
  const name = inp.value.trim();
  if (!name) return;
  if (state.teams.find(t_ => t_.name === name)) {
    inp.classList.add('input-error');
    setTimeout(() => inp.classList.remove('input-error'), 1500);
    return;
  }
  try {
    await addTeamDB(name);
    inp.value = '';
    await loadAll();
  } catch (e) {
    alert(t('alert.add_team'));
  }
};

window.rmTeam = async function (id, name) {
  if (!confirm(t('confirm.remove_team', { name }))) return;
  try {
    await delTeamDB(id);
    if (state.activeTeamId === id) {
      state.activeTeamId = null;
      state.activeRoundId = null;
      document.getElementById('rounds-card').style.display = 'none';
      document.getElementById('round-qs-card').style.display = 'none';
      document.getElementById('round-link-card').style.display = 'none';
    }
    await loadAll();
  } catch (e) {
    alert(t('alert.remove_team'));
  }
};

function renderRounds() {
  const el = document.getElementById('round-list');
  const teamRounds = state.rounds.filter(r => r.team_id === state.activeTeamId);
  if (!teamRounds.length) {
    el.innerHTML = `<div class="text-sm" style="color:var(--ink3);margin-bottom:8px">${t('admin.no_rounds')}</div>`;
    return;
  }
  el.innerHTML = teamRounds.map(r => `
    <div class="round-item ${r.id === state.activeRoundId ? 'active' : ''}" onclick="selectRound('${r.id}')">
      <span class="round-item-label">${escapeHtml(r.label)}</span>
      <span class="round-item-meta">${JSON.parse(r.questions || '[]').length} questions</span>
      ${r.expected_participants != null ? `<span class="team-chip-expected" onclick="event.stopPropagation();editRoundExpected('${r.id}')" title="Participants attendus">${r.expected_participants}p</span>` : `<span class="team-chip-expected" onclick="event.stopPropagation();editRoundExpected('${r.id}')" title="Définir participants attendus">+ p</span>`}
      <button class="round-item-del" onclick="event.stopPropagation();rmRound('${r.id}','${escapeHtml(r.label)}')">x</button>
    </div>`).join('');
}

window.selectRound = function (id) {
  state.activeRoundId = id;
  const r = state.rounds.find(r => r.id === id);
  if (!r) return;
  try {
    state.selQs = new Set(JSON.parse(r.questions || '[]').map(Number));
  } catch (e) {
    state.selQs = new Set(getQs().map(q => q.n));
  }
  document.getElementById('round-qs-label').textContent = r.label;
  document.getElementById('link-round-label').textContent = r.label;
  document.getElementById('round-qs-card').style.display = 'block';
  document.getElementById('round-link-card').style.display = 'block';
  state.catF = 'all';
  document.querySelectorAll('.q-filter-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  loadQList();
  renderShareUrl();
  renderRounds();
};

window.addRound = async function () {
  const inp = document.getElementById('new-round');
  const sizeInp = document.getElementById('new-round-expected');
  const label = inp.value.trim();
  if (!label || !state.activeTeamId) return;
  const expected = parseInt(sizeInp?.value) || null;
  try {
    await addRoundDB(state.activeTeamId, label, expected);
    inp.value = '';
    if (sizeInp) sizeInp.value = '';
    await loadAll();
    const newR = state.rounds.find(r => r.team_id === state.activeTeamId && r.label === label);
    if (newR) window.selectRound(newR.id);
  } catch (e) {
    alert(t('alert.add_round'));
  }
};

window.editRoundExpected = async function (id) {
  const round = state.rounds.find(r => r.id === id);
  const current = round?.expected_participants ?? '';
  const val = prompt('Participants attendus pour ce round :', current);
  if (val === null) return;
  const num = val.trim() === '' ? null : parseInt(val);
  if (val.trim() !== '' && (isNaN(num) || num <= 0)) return;
  try {
    await updateRoundDB(id, { expected_participants: num });
    await loadAll();
  } catch (e) {
    alert('Erreur lors de la mise à jour');
  }
};

window.rmRound = async function (id, label) {
  if (!confirm(t('confirm.remove_round', { name: label }))) return;
  try {
    await delRoundDB(id);
    if (state.activeRoundId === id) {
      state.activeRoundId = null;
      document.getElementById('round-qs-card').style.display = 'none';
      document.getElementById('round-link-card').style.display = 'none';
    }
    await loadAll();
    renderRounds();
  } catch (e) {
    alert(t('alert.remove_round'));
  }
};

window.saveRoundQs = async function () {
  if (!state.activeRoundId) return;
  const btn = document.getElementById('save-qs-btn');
  btn.disabled = true;
  btn.textContent = t('admin.saving');
  try {
    await updateRoundQs(state.activeRoundId, state.selQs);
    const r = state.rounds.find(r => r.id === state.activeRoundId);
    if (r) r.questions = JSON.stringify([...state.selQs]);
    renderRounds();
    btn.textContent = t('admin.saved');
    setTimeout(() => { btn.disabled = false; btn.textContent = t('admin.save_qs'); }, 1500);
  } catch (e) {
    btn.disabled = false;
    btn.textContent = t('admin.save_qs');
    alert(t('alert.save_qs') + e.message);
  }
};

function renderShareUrl() {
  if (!state.activeRoundId) return;
  document.getElementById('share-url').textContent =
    location.origin + location.pathname + '?round=' + state.activeRoundId;
}

window.copyShare = function (btn) {
  navigator.clipboard.writeText(document.getElementById('share-url').textContent);
  btn.textContent = t('admin.copied');
  setTimeout(() => btn.textContent = t('admin.copy'), 2000);
};

function loadQList() {
  const qs = state.catF === 'all' ? getQs() : getQs().filter(q => q.cat === state.catF);
  document.getElementById('q-list').innerHTML = qs.map(q => `
    <div class="q-item ${state.selQs.has(q.n) ? 'selected' : ''}" onclick="togQ(${q.n})">
      <div class="q-check">${state.selQs.has(q.n) ? '<svg style="width:8px;height:8px" viewBox="0 0 8 8"><polyline points="1,4 3.5,6.5 7,2" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</div>
      <span class="q-num">${q.n}</span>
      <span class="q-text">${escapeHtml(q.text)}</span>
    </div>`).join('');
  document.getElementById('sel-count').textContent = t('admin.selected', { n: state.selQs.size });
}

window.togQ = function (n) {
  state.selQs.has(n) ? state.selQs.delete(n) : state.selQs.add(n);
  loadQList();
};

window.selectAll = function () {
  state.selQs = new Set(getQs().map(q => q.n));
  loadQList();
};

window.clearAll = function () {
  state.selQs.clear();
  loadQList();
};

window.filterCat = function (btn, cat) {
  state.catF = cat;
  document.querySelectorAll('.q-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadQList();
};
