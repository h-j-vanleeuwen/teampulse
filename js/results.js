import { getResponses } from './api.js';
import { Qs, CAT, COL } from './config.js';
import { state } from './state.js';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function calcScores(responses) {
  const out = {};
  Object.keys(CAT).forEach(cat => {
    const catQs = Qs.filter(q => q.cat === cat);
    const vals = [];
    responses.forEach(r => catQs.forEach(q => {
      const a = r.answers[q.n];
      const v = a && typeof a === 'object' ? a.score : a;
      if (v !== undefined && v !== null) vals.push(Number(v));
    }));
    out[cat] = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  });
  return out;
}

function ext(sc, dir) {
  let best = dir === 'max' ? -1 : 6;
  let name = '-';
  Object.entries(sc).forEach(([c, v]) => {
    if (v !== null && (dir === 'max' ? v > best : v < best)) { best = v; name = CAT[c]; }
  });
  return name;
}

export async function fetchResults() {
  document.getElementById('results-body').innerHTML =
    '<div class="empty-state"><div style="font-size:24px">&#9203;</div><div>Loading...</div></div>';
  try {
    state.allResponses = await getResponses();
    renderResults();
  } catch (e) {
    document.getElementById('results-body').innerHTML =
      '<div class="alert alert-error">Could not load: ' + e.message + '</div>';
  }
}

function buildLongitudinalSection(ct, roundList) {
  const participantMap = {};

  roundList.forEach(round => {
    round.responses.forEach(r => {
      const key = `${r.first_name} ${r.last_name}`;
      if (!participantMap[key]) participantMap[key] = { name: key, rounds: {} };
      const scores = calcScores([r]);
      const vals = Object.values(scores).filter(v => v !== null);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      participantMap[key].rounds[round.id] = { avg, scores, label: round.label };
    });
  });

  const multiRound = Object.values(participantMap).filter(p => Object.keys(p.rounds).length >= 2);
  if (!multiRound.length) return '';

  const headers = roundList.map(r => `<th>${escapeHtml(r.label)}</th>`).join('');

  const rows = multiRound.map(p => {
    const roundCells = roundList.map(r => {
      const rd = p.rounds[r.id];
      if (!rd || rd.avg === null) return '<td><span style="color:var(--ink3)">-</span></td>';
      const v = rd.avg;
      return `<td><span class="score-pill score-${Math.round(v)}">${v.toFixed(1)}</span></td>`;
    }).join('');

    const presentRounds = roundList.filter(r => p.rounds[r.id] && p.rounds[r.id].avg !== null);
    let trendCell = '<td><span style="color:var(--ink3)">-</span></td>';
    if (presentRounds.length >= 2) {
      const first = p.rounds[presentRounds[0].id].avg;
      const last = p.rounds[presentRounds[presentRounds.length - 1].id].avg;
      const diff = last - first;
      const isUp = diff > 0.15;
      const isDown = diff < -0.15;
      const arrow = isUp ? '↑' : isDown ? '↓' : '→';
      const color = isUp ? 'var(--green)' : isDown ? 'var(--red)' : 'var(--ink3)';
      const sign = diff > 0 ? '+' : '';
      trendCell = `<td><span class="trend-badge" style="color:${color}">${arrow} ${sign}${diff.toFixed(1)}</span></td>`;
    }

    return `<tr class="longi-row">
      <td style="font-weight:500">${escapeHtml(p.name)}</td>
      ${roundCells}
      ${trendCell}
    </tr>`;
  }).join('');

  return `
  <div class="card mt">
    <div class="card-title">Evolution by participant</div>
    <div style="overflow-x:auto">
      <table class="responses-table longi-table">
        <thead><tr><th>Participant</th>${headers}<th>Trend</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function renderResults() {
  const el = document.getElementById('results-body');

  const teamMap = {};
  state.allResponses.forEach(r => {
    if (!r.rounds) return;
    const tid = r.rounds.team_id;
    const tname = r.rounds.teams ? r.rounds.teams.name : 'Unknown';
    if (!teamMap[tid]) teamMap[tid] = { id: tid, name: tname, rounds: {} };
    const rid = r.rounds.id;
    if (!teamMap[tid].rounds[rid]) teamMap[tid].rounds[rid] = { id: rid, label: r.rounds.label, responses: [] };
    teamMap[tid].rounds[rid].responses.push(r);
  });

  const teamList = Object.values(teamMap);
  if (!teamList.length) {
    el.innerHTML = '<div class="empty-state card"><div class="empty-icon">&#128202;</div><div class="font-bold" style="margin-bottom:8px">No responses yet</div><div class="text-sm">Complete a survey round to see results here.</div></div>';
    return;
  }

  if (!state.rTeamId || !teamMap[state.rTeamId]) state.rTeamId = teamList[0].id;
  const ct = teamMap[state.rTeamId];
  const roundList = Object.values(ct.rounds);
  if (!state.rRoundId || !ct.rounds[state.rRoundId]) state.rRoundId = roundList[0]?.id || null;
  if (state.cRoundId === state.rRoundId) state.cRoundId = null;

  const rRound = state.rRoundId ? ct.rounds[state.rRoundId] : null;
  const rResp = rRound ? rRound.responses : [];
  const cRound = state.cRoundId ? ct.rounds[state.cRoundId] : null;
  const cResp = cRound ? cRound.responses : [];
  const sc = calcScores(rResp);
  const cSc = cRound ? calcScores(cResp) : null;
  const vals = Object.values(sc).filter(v => v !== null);
  const ov = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;

  el.innerHTML = `
  <div class="card">
    <div class="card-title">Team</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${teamList.map(t => `<button class="team-pill ${t.id === state.rTeamId ? 'active' : ''}" onclick="selectResultTeam('${t.id}')">${escapeHtml(t.name)}</button>`).join('')}
    </div>
  </div>

  <div class="card mt">
    <div class="card-title">Round</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap${roundList.length > 1 ? ';margin-bottom:1rem' : ''}">
      ${roundList.map(r => `<button class="team-pill ${r.id === state.rRoundId ? 'active' : ''}" onclick="selectResultRound('${r.id}')">${escapeHtml(r.label)} <span style="opacity:0.6;font-size:11px">${r.responses.length}</span></button>`).join('')}
    </div>
    ${roundList.length > 1 ? `
    <div style="font-size:12px;color:var(--ink3);margin-bottom:6px">Compare with:</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="team-pill ${!state.cRoundId ? 'active' : ''}" onclick="selectCompareRound(null)" style="font-size:12px">None</button>
      ${roundList.filter(r => r.id !== state.rRoundId).map(r => `<button class="team-pill ${r.id === state.cRoundId ? 'compare' : ''}" onclick="selectCompareRound('${r.id}')" style="font-size:12px">${escapeHtml(r.label)}</button>`).join('')}
    </div>` : ''}
  </div>

  <div class="stats-grid mt">
    <div class="stat-card"><div class="stat-label">Responses</div><div class="stat-value">${rResp.length}</div></div>
    <div class="stat-card"><div class="stat-label">Overall avg</div><div class="stat-value">${ov.toFixed(1)}<span class="stat-max">/5</span></div></div>
    <div class="stat-card"><div class="stat-label">Strongest</div><div class="stat-value" style="font-size:18px;padding-top:8px">${ext(sc, 'max')}</div></div>
    <div class="stat-card"><div class="stat-label">Focus area</div><div class="stat-value" style="font-size:18px;padding-top:8px">${ext(sc, 'min')}</div></div>
  </div>

  <div class="card mt">
    <div class="card-title">Scores by dimension</div>
    ${cSc ? `<div style="display:flex;gap:16px;margin-bottom:1rem">
      <div class="legend-item"><div class="legend-dot" style="background:var(--accent)"></div>${escapeHtml(rRound.label)}</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--amber);opacity:0.55"></div>${escapeHtml(cRound.label)}</div>
    </div>` : ''}
    <div class="bar-chart">
      ${Object.entries(CAT).map(([cat, label]) => {
        const s = sc[cat];
        const cs = cSc ? cSc[cat] : null;
        const p = s !== null ? (s / 5 * 100).toFixed(1) : 0;
        const cp = cs !== null ? (cs / 5 * 100).toFixed(1) : 0;
        return `<div class="bar-row">
          <div class="bar-label">${label}</div>
          <div class="bar-track">
            ${cs !== null ? `<div class="bar-fill2" style="width:${cp}%;background:${COL[cat]}"></div>` : ''}
            <div class="bar-fill" style="width:${p}%;background:${COL[cat]}"><span>${s !== null ? s.toFixed(2) : '-'}</span></div>
          </div>
          <div class="bar-score">${s !== null ? s.toFixed(1) : '-'}</div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <div class="card mt">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
      Individual responses <button class="btn btn-outline btn-sm" onclick="fetchResults()">Refresh</button>
    </div>
    <div style="overflow-x:auto">
      <table class="responses-table">
        <thead><tr><th>#</th><th>Name</th><th>Date</th>${Object.values(CAT).map(l => `<th>${l}</th>`).join('')}<th>Avg</th><th>Notes</th></tr></thead>
        <tbody>
          ${rResp.map((r, i) => {
            const rs = calcScores([r]);
            const v2 = Object.values(rs).filter(v => v !== null);
            const ov2 = v2.length ? (v2.reduce((a, b) => a + b, 0) / v2.length) : null;
            const comments = Object.entries(r.answers || {})
              .filter(([, a]) => a && typeof a === 'object' && a.comment && a.comment.trim())
              .map(([qn, a]) => ({ q: Qs.find(q => q.n === Number(qn)), text: a.comment.trim() }))
              .filter(c => c.q);
            const rowId = 'comments-' + r.id;
            return `<tr>
              <td style="color:var(--ink3)">${i + 1}</td>
              <td style="font-weight:500">${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)}</td>
              <td style="color:var(--ink3)">${new Date(r.submitted_at).toLocaleDateString()}</td>
              ${Object.keys(CAT).map(cat => { const v = rs[cat]; return `<td><span class="score-pill ${v !== null ? 'score-' + Math.round(v) : ''}">${v !== null ? v.toFixed(1) : '-'}</span></td>`; }).join('')}
              <td><strong>${ov2 !== null ? ov2.toFixed(2) : '-'}</strong></td>
              <td><button class="btn-comments ${comments.length ? 'has-comments' : ''}" onclick="toggleComments('${rowId}')" ${!comments.length ? 'disabled' : ''}>${comments.length ? '&#128172; ' + comments.length : '-'}</button></td>
            </tr>
            <tr class="comments-row" id="${rowId}" style="display:none">
              <td colspan="${7 + Object.keys(CAT).length}">
                ${comments.map(c => `<div class="comment-block"><div class="comment-q">Q${c.q.n} &mdash; ${escapeHtml(CAT[c.q.cat] || c.q.cat)}: "${escapeHtml(c.q.text)}"</div><div class="comment-text">${escapeHtml(c.text)}</div></div>`).join('')}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>
  ${buildLongitudinalSection(ct, roundList)}`;
}

window.selectResultTeam = function (id) {
  state.rTeamId = id;
  state.rRoundId = null;
  state.cRoundId = null;
  renderResults();
};

window.selectResultRound = function (id) {
  state.rRoundId = id;
  state.cRoundId = null;
  renderResults();
};

window.selectCompareRound = function (id) {
  state.cRoundId = id;
  renderResults();
};

window.toggleComments = function (rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
};

window.fetchResults = fetchResults;
