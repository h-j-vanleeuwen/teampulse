import { getResponses } from './api.js';
import { Qs, CAT, COL } from './config.js';
import { state } from './state.js';
import { buildPyramidData } from './pyramid.js';

// Snapshot of the currently rendered round, so the pyramid modal can rebuild
// itself from the exact scores on screen without re-walking the state tree.
let lastPyramidContext = null;

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

// Calculates standard deviation per category across all respondents.
function calcDispersion(responses) {
  const out = {};
  Object.keys(CAT).forEach(cat => {
    const catQs = Qs.filter(q => q.cat === cat);
    const vals = [];
    responses.forEach(r => catQs.forEach(q => {
      const a = r.answers[q.n];
      const v = a && typeof a === 'object' ? a.score : a;
      if (v !== undefined && v !== null) vals.push(Number(v));
    }));
    if (vals.length < 2) { out[cat] = null; return; }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    out[cat] = Math.sqrt(vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length);
  });
  return out;
}

// Computes average score per question across all respondents.
function calcQuestionStats(responses) {
  const stats = {};
  Qs.forEach(q => {
    const vals = [];
    responses.forEach(r => {
      const a = r.answers[q.n];
      const v = a && typeof a === 'object' ? a.score : a;
      if (v !== undefined && v !== null) vals.push(Number(v));
    });
    if (vals.length) stats[q.n] = { q, avg: vals.reduce((a, b) => a + b, 0) / vals.length };
  });
  return stats;
}

// Returns a dispersion badge HTML string based on standard deviation.
function dispBadge(d) {
  if (d === null) return '';
  if (d < 0.7) return '<span class="disp-badge disp-ok">Consensuel</span>';
  if (d < 1.2) return '<span class="disp-badge disp-mid">Partagé</span>';
  return '<span class="disp-badge disp-bad">Divergent</span>';
}

// Maps participant full names to anonymous aliases (Participant A, B, C...).
function buildAliasMap(responses) {
  const names = [...new Set(responses.map(r => `${r.first_name} ${r.last_name}`))].sort();
  return Object.fromEntries(names.map((n, i) => [n, `Participant ${String.fromCharCode(65 + i)}`]));
}

function buildSynthesisBlock(sc, dispersion) {
  const catKeys = Object.keys(CAT);
  const forces = catKeys.filter(c => sc[c] !== null && sc[c] >= 3.5).sort((a, b) => sc[b] - sc[a]);
  const fragilites = catKeys.filter(c => sc[c] !== null && sc[c] < 3.0).sort((a, b) => sc[a] - sc[b]);
  const divergences = catKeys.filter(c => dispersion[c] !== null && dispersion[c] > 1.2);

  const renderItems = (items, icon, cls) => items.length
    ? items.slice(0, 2).map(c => `<div class="synth-item ${cls}"><span class="synth-icon">${icon}</span>${escapeHtml(CAT[c])}<span class="synth-score">${sc[c].toFixed(1)}</span></div>`).join('')
    : `<div class="synth-empty">-</div>`;

  const renderDivItems = items => items.length
    ? items.slice(0, 2).map(c => `<div class="synth-item synth-div"><span class="synth-icon">↔</span>${escapeHtml(CAT[c])}</div>`).join('')
    : `<div class="synth-empty">Opinions alignées</div>`;

  return `
  <div class="card mt synth-card">
    <div class="card-title">Synthèse</div>
    <div class="synth-grid">
      <div class="synth-col">
        <div class="synth-col-title synth-forces-title">Forces</div>
        ${renderItems(forces, '✓', 'synth-force')}
      </div>
      <div class="synth-col">
        <div class="synth-col-title synth-fragilites-title">Fragilités</div>
        ${renderItems(fragilites, '!', 'synth-fragile')}
      </div>
      <div class="synth-col">
        <div class="synth-col-title synth-divergences-title">Divergences</div>
        ${renderDivItems(divergences)}
      </div>
    </div>
  </div>`;
}

function buildTopBottomSection(qStats) {
  const cols = Object.keys(CAT).map(cat => {
    const catList = Object.values(qStats).filter(s => s.q.cat === cat);
    if (catList.length < 2) return '';

    const sorted = [...catList].sort((a, b) => b.avg - a.avg);
    const top = sorted.slice(0, 2);
    const bottom = sorted.slice(-2).reverse();

    const renderRow = (s, type) => {
      const icon = type === 'top' ? '▲' : '▼';
      const cls = type === 'top' ? 'topbot-up' : 'topbot-down';
      return `<div class="topbot-q-row ${cls}">
        <span class="topbot-icon">${icon}</span>
        <span class="topbot-text">${escapeHtml(s.q.text)}</span>
        <span class="topbot-score">${s.avg.toFixed(1)}</span>
      </div>`;
    };

    return `<div class="topbot-cat">
      <div class="topbot-cat-title">${escapeHtml(CAT[cat])}</div>
      ${top.map(s => renderRow(s, 'top')).join('')}
      <div class="topbot-sep"></div>
      ${bottom.map(s => renderRow(s, 'bottom')).join('')}
    </div>`;
  }).filter(Boolean).join('');

  if (!cols) return '';

  return `
  <div class="card mt">
    <div class="card-title">Questions saillantes par dimension</div>
    <div class="topbot-grid">${cols}</div>
  </div>`;
}

// The pyramid is a single triangle sliced horizontally. The apex band is
// taller (so its base is wide enough to hold its content) while the lower
// bands share the rest evenly. Sides stay perfectly straight.
const PYRAMID_APEX_BOTTOM = 0.38;
const PYRAMID_HEIGHT_PX = 430;

// Returns the top/bottom width fractions (0-1 of full width) of each band,
// from apex (topIndex 0) to base.
function pyramidBandFractions(topIndex, total) {
  const rest = (1 - PYRAMID_APEX_BOTTOM) / (total - 1);
  const bottom = topIndex === 0 ? PYRAMID_APEX_BOTTOM : PYRAMID_APEX_BOTTOM + rest * topIndex;
  const top = topIndex === 0 ? 0 : PYRAMID_APEX_BOTTOM + rest * (topIndex - 1);
  return { top, bottom };
}

// Builds the clip-path that carves one band, given its width fractions.
function pyramidClipPath(top, bottom) {
  const halfTop = 50 * top;
  const halfBot = 50 * bottom;
  if (top === 0) {
    return `polygon(50% 0%, ${50 + halfBot}% 100%, ${50 - halfBot}% 100%)`;
  }
  return `polygon(${50 - halfTop}% 0%, ${50 + halfTop}% 0%, ${50 + halfBot}% 100%, ${50 - halfBot}% 100%)`;
}

function buildPyramidContent(scores) {
  const { levels, priorityKey } = buildPyramidData(scores);
  const total = levels.length;
  // Render apex first (top of the stack) down to the foundation.
  const rows = [...levels].reverse().map((stage, topIndex) => {
    const { top, bottom } = pyramidBandFractions(topIndex, total);
    const clip = pyramidClipPath(top, bottom);
    const rowHeight = Math.round((bottom - top) * PYRAMID_HEIGHT_PX);
    const scoreText = stage.score !== null ? stage.score.toFixed(1) : '-';
    const priorityChip = stage.isPriority
      ? '<span class="pyramid-flag">Priorité</span>'
      : '';
    return `<div class="pyramid-row pyr-l${stage.level} status-${stage.status} ${stage.isPriority ? 'is-priority' : ''}" style="clip-path:${clip};height:${rowHeight}px">
      <div class="pyramid-inner">
        <span class="pyramid-num">${String(stage.level).padStart(2, '0')}</span>
        <span class="pyramid-text">
          <span class="pyramid-desc">${stage.labelDesc}</span>
          <span class="pyramid-key">${stage.labelKey}${priorityChip}</span>
        </span>
        <span class="pyramid-score">${scoreText}</span>
      </div>
    </div>`;
  }).join('');

  const priorityStage = levels.find(s => s.key === priorityKey);
  const caption = priorityStage
    ? `Levier prioritaire : <strong>${priorityStage.labelFull}</strong> - l'étage fragile le plus bas. On consolide de la base vers le sommet.`
    : 'Tous les étages sont sains. La base de l\'équipe est solide.';

  return `
    <div class="pyramid">${rows}</div>
    <div class="pyramid-caption">${caption}</div>
    <div class="pyramid-legend">
      <span class="legend-item"><span class="legend-dot status-healthy"></span>Sain (&ge;3.5)</span>
      <span class="legend-item"><span class="legend-dot status-fragile"></span>Fragile (2.5-3.5)</span>
      <span class="legend-item"><span class="legend-dot status-critical"></span>Critique (&lt;2.5)</span>
    </div>`;
}

window.showPyramid = function () {
  if (!lastPyramidContext) return;
  const { scores, teamName, roundLabel, responseCount } = lastPyramidContext;

  let overlay = document.getElementById('pyramid-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'pyramid-overlay';
    overlay.className = 'info-overlay';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closePyramid();
    });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="info-modal pyramid-modal">
      <button class="info-close" onclick="closePyramid()" aria-label="Close">&times;</button>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.25rem">
        <div class="info-section-title" style="margin:0">Pyramide de Lencioni</div>
        <button class="btn btn-outline btn-sm" onclick="exportPyramidPDF()" style="font-size:12px">Export PDF</button>
      </div>
      <div class="info-meta" style="margin-bottom:1rem">
        <div><span class="info-meta-label">Équipe</span>${escapeHtml(teamName)}</div>
        <div><span class="info-meta-label">Round</span>${escapeHtml(roundLabel)}</div>
        <div><span class="info-meta-label">Réponses</span>${responseCount}</div>
      </div>
      ${buildPyramidContent(scores)}
    </div>`;
  overlay.style.display = 'flex';
};

window.closePyramid = function () {
  const overlay = document.getElementById('pyramid-overlay');
  if (overlay) overlay.style.display = 'none';
};

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

  // Build alias map from all participants across all rounds of this team.
  const allNames = [];
  roundList.forEach(round => round.responses.forEach(r => allNames.push(`${r.first_name} ${r.last_name}`)));
  const aliasMap = Object.fromEntries(
    [...new Set(allNames)].sort().map((n, i) => [n, `Participant ${String.fromCharCode(65 + i)}`])
  );

  roundList.forEach(round => {
    round.responses.forEach(r => {
      const key = `${r.first_name} ${r.last_name}`;
      if (!participantMap[key]) participantMap[key] = { name: aliasMap[key] || key, rounds: {} };
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
  const dispersion = calcDispersion(rResp);
  const qStats = calcQuestionStats(rResp);
  const aliasMap = buildAliasMap(rResp);
  const vals = Object.values(sc).filter(v => v !== null);
  const ov = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;

  lastPyramidContext = {
    scores: sc,
    teamName: ct.name,
    roundLabel: rRound ? rRound.label : '-',
    responseCount: rResp.length,
  };

  const printDate = new Date().toLocaleDateString();
  const compareMeta = cRound ? ` <span style="opacity:0.6">vs</span> <strong>${escapeHtml(cRound.label)}</strong>` : '';

  el.innerHTML = `
  <div class="print-header">
    <div class="print-header-brand">
      <div class="print-header-mark"></div>
      <div class="print-header-name">Team<span>Pulse</span></div>
      <div class="print-header-title">Team Health Assessment</div>
    </div>
    <div class="print-header-meta">
      <span>Team: <strong>${escapeHtml(ct.name)}</strong></span>
      <span>Round: <strong>${rRound ? escapeHtml(rRound.label) : '-'}</strong>${compareMeta}</span>
      <span>Responses: <strong>${rResp.length}</strong></span>
      <span>Generated: <strong>${printDate}</strong></span>
    </div>
  </div>

  <div class="card no-print">
    <div class="card-title">Team</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${teamList.map(t => `<button class="team-pill ${t.id === state.rTeamId ? 'active' : ''}" onclick="selectResultTeam('${t.id}')">${escapeHtml(t.name)}</button>`).join('')}
    </div>
  </div>

  <div class="card mt no-print">
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

  ${buildSynthesisBlock(sc, dispersion)}

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
          <div class="bar-label">${label}${dispBadge(dispersion[cat])}</div>
          <div class="bar-track">
            ${cs !== null ? `<div class="bar-fill2" style="width:${cp}%;background:${COL[cat]}"></div>` : ''}
            <div class="bar-fill" style="width:${p}%;background:${COL[cat]}"><span>${s !== null ? s.toFixed(2) : '-'}</span></div>
          </div>
          <div class="bar-score">${s !== null ? s.toFixed(1) : '-'}</div>
        </div>`;
      }).join('')}
    </div>
  </div>

  ${buildTopBottomSection(qStats)}

  <div class="card mt">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
      Individual responses
      <div class="no-print" style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm" onclick="showPyramid()">Pyramide</button>
        <button class="btn btn-outline btn-sm" onclick="exportCSV()">Export CSV</button>
        <button class="btn btn-outline btn-sm" onclick="fetchResults()">Refresh</button>
      </div>
    </div>
    <div style="overflow-x:auto">
      <table class="responses-table">
        <thead><tr><th>#</th><th>Participant</th><th>Date</th>${Object.values(CAT).map(l => `<th>${l}</th>`).join('')}<th>Avg</th><th>Notes</th></tr></thead>
        <tbody>
          ${rResp.map((r, i) => {
            const rs = calcScores([r]);
            const v2 = Object.values(rs).filter(v => v !== null);
            const ov2 = v2.length ? (v2.reduce((a, b) => a + b, 0) / v2.length) : null;
            const alias = aliasMap[`${r.first_name} ${r.last_name}`] || `Participant ${i + 1}`;
            const comments = Object.entries(r.answers || {})
              .filter(([, a]) => a && typeof a === 'object' && a.comment && a.comment.trim())
              .map(([qn, a]) => ({ q: Qs.find(q => q.n === Number(qn)), text: a.comment.trim() }))
              .filter(c => c.q);
            const rowId = 'comments-' + r.id;
            return `<tr>
              <td style="color:var(--ink3)">${i + 1}</td>
              <td style="font-weight:500">${escapeHtml(alias)} <button class="info-btn no-print" onclick="showResponseInfo('${r.id}')" title="Response details">&#9432;</button></td>
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
  ${buildLongitudinalSection(ct, roundList)}

  <div class="print-footer">TeamPulse - Lencioni team health assessment - generated on ${printDate}</div>`;
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

window.exportCSV = function () {
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

  const ct = teamMap[state.rTeamId];
  if (!ct || !state.rRoundId) return;
  const rRound = ct.rounds[state.rRoundId];
  if (!rRound) return;

  const catKeys = Object.keys(CAT);
  const headers = ['Participant', 'Date', ...Object.values(CAT), 'Avg'];
  const aliasMap = buildAliasMap(rRound.responses);

  const rows = rRound.responses.map((r, i) => {
    const rs = calcScores([r]);
    const vals = Object.values(rs).filter(v => v !== null);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const alias = aliasMap[`${r.first_name} ${r.last_name}`] || `Participant ${i + 1}`;
    return [
      `"${alias}"`,
      new Date(r.submitted_at).toLocaleDateString(),
      ...catKeys.map(cat => rs[cat] !== null ? rs[cat].toFixed(2) : ''),
      avg !== null ? avg.toFixed(2) : '',
    ];
  });

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `teampulse-${rRound.label.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

window.showResponseInfo = function (id) {
  const r = state.allResponses.find(x => x.id === id);
  if (!r) return;

  const scores = calcScores([r]);
  const validScores = Object.values(scores).filter(v => v !== null);
  const overall = validScores.length ? (validScores.reduce((a, b) => a + b, 0) / validScores.length) : null;
  const teamName = r.rounds && r.rounds.teams ? r.rounds.teams.name : 'Unknown';
  const roundLabel = r.rounds ? r.rounds.label : 'Unknown';
  const submittedAt = new Date(r.submitted_at).toLocaleString();

  const comments = Object.entries(r.answers || {})
    .filter(([, a]) => a && typeof a === 'object' && a.comment && a.comment.trim())
    .map(([qn, a]) => ({ q: Qs.find(q => q.n === Number(qn)), text: a.comment.trim() }))
    .filter(c => c.q);

  const scoreRows = Object.keys(CAT).map(cat => {
    const v = scores[cat];
    return `<div class="info-score-row">
        <span class="info-score-label">${escapeHtml(CAT[cat])}</span>
        <span class="score-pill ${v !== null ? 'score-' + Math.round(v) : ''}">${v !== null ? v.toFixed(1) : '-'}</span>
      </div>`;
  }).join('');

  const commentsHtml = comments.length
    ? comments.map(c => `<div class="comment-block"><div class="comment-q">Q${c.q.n} &mdash; ${escapeHtml(CAT[c.q.cat] || c.q.cat)}: "${escapeHtml(c.q.text)}"</div><div class="comment-text">${escapeHtml(c.text)}</div></div>`).join('')
    : '<div class="text-sm" style="color:var(--ink3)">No comments for this response.</div>';

  let overlay = document.getElementById('info-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'info-overlay';
    overlay.className = 'info-overlay';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeResponseInfo();
    });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="info-modal">
      <button class="info-close" onclick="closeResponseInfo()" aria-label="Close">&times;</button>
      <div class="info-name">${escapeHtml(r.first_name)} ${escapeHtml(r.last_name)}</div>
      <div class="info-meta">
        <div><span class="info-meta-label">Team</span>${escapeHtml(teamName)}</div>
        <div><span class="info-meta-label">Round</span>${escapeHtml(roundLabel)}</div>
        <div><span class="info-meta-label">Submitted</span>${escapeHtml(submittedAt)}</div>
        <div><span class="info-meta-label">Overall</span>${overall !== null ? overall.toFixed(2) : '-'}</div>
      </div>
      <div class="info-section-title">Scores by dimension</div>
      <div class="info-scores">${scoreRows}</div>
      <div class="info-section-title">Comments</div>
      <div class="info-comments">${commentsHtml}</div>
    </div>`;
  overlay.style.display = 'flex';
};

window.closeResponseInfo = function () {
  const overlay = document.getElementById('info-overlay');
  if (overlay) overlay.style.display = 'none';
};

// Draws the pyramid geometry directly to a canvas (avoids clip-path print issues).
function buildPyramidCanvas(scores) {
  const { levels, priorityKey } = buildPyramidData(scores);
  const total = levels.length;
  const SCALE = 2;
  const W = 580;
  const GAP = 3;

  const bandRows = [...levels].reverse().map((stage, topIndex) => {
    const { top, bottom } = pyramidBandFractions(topIndex, total);
    return { ...stage, top, bottom, h: Math.round((bottom - top) * PYRAMID_HEIGHT_PX) };
  });

  const pyrH = bandRows.reduce((s, b) => s + b.h + GAP, 0) - GAP;
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = (pyrH + 90) * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, pyrH + 90);

  const CX = W / 2;
  const BAND_COLORS = ['#071440', '#0C2872', '#1451B8', '#1E8FCE', '#38C4DE'];
  const STATUS_COLORS = { healthy: '#15803D', fragile: '#C2620E', critical: '#CB3F1C' };
  const EL_GAP = 7;
  const NUM_W = 26;
  const CHIP_W = 46, CHIP_H = 14;
  const SCORE_W = 36, SCORE_H = 20;

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function bandPath(top, bottom, h, y0) {
    const hwTop = top * W / 2;
    const hwBot = bottom * W / 2;
    ctx.beginPath();
    if (top === 0) {
      ctx.moveTo(CX, y0);
      ctx.lineTo(CX + hwBot, y0 + h);
      ctx.lineTo(CX - hwBot, y0 + h);
    } else {
      ctx.moveTo(CX - hwTop, y0);
      ctx.lineTo(CX + hwTop, y0);
      ctx.lineTo(CX + hwBot, y0 + h);
      ctx.lineTo(CX - hwBot, y0 + h);
    }
    ctx.closePath();
  }

  let y = 0;
  bandRows.forEach(band => {
    bandPath(band.top, band.bottom, band.h, y);
    ctx.fillStyle = BAND_COLORS[band.level - 1];
    ctx.fill();

    ctx.save();
    bandPath(band.top, band.bottom, band.h, y);
    ctx.clip();

    const tY = y + band.h - 18;

    // Measure widths to lay out the group centered without any overlap
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    const keyLabel = band.labelKey.toUpperCase();
    const keyW = ctx.measureText(keyLabel).width;
    const totalW = NUM_W + EL_GAP + keyW
      + (band.isPriority ? EL_GAP + CHIP_W : 0)
      + (band.score !== null ? EL_GAP + SCORE_W : 0);

    let cx = CX - totalW / 2;

    // Number
    ctx.font = '800 18px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(band.level).padStart(2, '0'), cx, tY);
    cx += NUM_W + EL_GAP;

    // Descriptor (small) stacked above Key (bold), both centered on the key column
    const textCX = cx + keyW / 2;
    ctx.font = '400 8px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.textAlign = 'center';
    ctx.fillText(band.labelDesc, textCX, tY - 10);
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(keyLabel, textCX, tY + 3);
    cx += keyW;

    // PRIORITÉ chip — inside clip, right after the key text
    if (band.isPriority) {
      cx += EL_GAP;
      rrect(cx, tY - CHIP_H / 2 + 3, CHIP_W, CHIP_H, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill();
      ctx.font = '700 7px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#1A1A1A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PRIORITÉ', cx + CHIP_W / 2, tY + 3);
      cx += CHIP_W;
    }

    // Score badge — always last, never overlaps anything
    if (band.score !== null) {
      cx += EL_GAP;
      rrect(cx, tY - SCORE_H / 2, SCORE_W, SCORE_H, 10);
      ctx.fillStyle = STATUS_COLORS[band.status] || 'rgba(255,255,255,0.25)';
      ctx.fill();
      ctx.font = '700 11px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(band.score.toFixed(1), cx + SCORE_W / 2, tY);
    }

    ctx.restore();
    y += band.h + GAP;
  });

  // Caption
  const priorityStage = levels.find(s => s.key === priorityKey);
  const caption = priorityStage
    ? `Levier prioritaire : ${priorityStage.labelFull} — l'étage fragile le plus bas.`
    : "Tous les étages sont sains. La base de l'équipe est solide.";
  ctx.font = '400 12px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#6A655B';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(caption, CX, y + 10);

  // Legend
  const legendItems = [
    { label: 'Sain (≥3.5)', color: '#15803D' },
    { label: 'Fragile (2.5-3.5)', color: '#C2620E' },
    { label: 'Critique (<2.5)', color: '#CB3F1C' },
  ];
  ctx.font = '400 12px Inter, system-ui, sans-serif';
  const iGap = 18;
  const iWidths = legendItems.map(it => 14 + 5 + ctx.measureText(it.label).width);
  const legendTotalW = iWidths.reduce((a, b) => a + b, 0) + iGap * (legendItems.length - 1);
  let lx = CX - legendTotalW / 2;
  const ly = y + 40;
  legendItems.forEach((item, i) => {
    rrect(lx, ly - 6, 12, 12, 3);
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.fillStyle = '#6A655B';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, lx + 17, ly);
    lx += iWidths[i] + iGap;
  });

  return canvas;
}

window.exportPyramidPDF = function () {
  if (!lastPyramidContext) return;
  const { scores, teamName, roundLabel, responseCount } = lastPyramidContext;

  const btn = document.querySelector('#pyramid-overlay [onclick="exportPyramidPDF()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Génération...'; }

  try {
    const canvas = buildPyramidCanvas(scores);
    const imgData = canvas.toDataURL('image/png');

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>
      <title>Pyramide de Lencioni — ${escapeHtml(teamName)} — ${escapeHtml(roundLabel)}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#fff;padding:2cm;font-family:Inter,system-ui,sans-serif;}
        h2{font-size:18px;font-weight:800;margin-bottom:0.4rem;}
        .meta{font-size:13px;color:#6A655B;display:flex;gap:2rem;margin-bottom:1.5rem;}
        .meta strong{color:#1A1A1A;}
        img{max-width:100%;height:auto;display:block;}
        @page{margin:1.5cm;}
      </style>
    </head><body>
      <h2>Pyramide de Lencioni</h2>
      <div class="meta">
        <span>Équipe <strong>${escapeHtml(teamName)}</strong></span>
        <span>Round <strong>${escapeHtml(roundLabel)}</strong></span>
        <span>Réponses <strong>${responseCount}</strong></span>
      </div>
      <img src="${imgData}">
    </body></html>`);
    doc.close();

    iframe.addEventListener('load', () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    });
  } catch (e) {
    alert('Export échoué : ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Export PDF'; }
  }
};
