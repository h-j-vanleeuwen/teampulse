import { getResponses, getQOrder, setQOrder } from './api.js';
import { Qs, CAT, COL } from './config.js';
import { state } from './state.js';
import { buildPyramidData } from './pyramid.js';
import { t, getCat, getQs } from './i18n.js';

// Snapshot of the currently rendered round, so the pyramid modal can rebuild
// itself from the exact scores on screen without re-walking the state tree.
let lastPyramidContext = null;

// Custom question order per category, persisted in DB. Keyed by catKey → [qn, ...]
let customQOrder = {};

export async function initResultsOrder() {
  try {
    const rows = await getQOrder();
    if (rows?.[0]?.value) customQOrder = JSON.parse(rows[0].value);
  } catch {}
}

function qText(q) {
  return getQs().find(tq => tq.n === q.n)?.text || q.text;
}

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
  const cat = getCat();
  Object.entries(sc).forEach(([c, v]) => {
    if (v !== null && (dir === 'max' ? v > best : v < best)) { best = v; name = cat[c]; }
  });
  return name;
}

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

function calcQuestionStats(responses) {
  const stats = {};
  Qs.forEach(q => {
    const vals = [];
    responses.forEach(r => {
      const a = r.answers[q.n];
      const v = a && typeof a === 'object' ? a.score : a;
      if (v !== undefined && v !== null) vals.push(Number(v));
    });
    if (vals.length) {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const delta = vals.length > 1
        ? Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length)
        : 0;
      stats[q.n] = { q, avg, delta };
    }
  });
  return stats;
}

function dispBadge(d) {
  if (d === null) return '';
  if (d < 0.7) return `<span class="disp-badge disp-ok">${t('disp.consensual')}</span>`;
  if (d < 1.2) return `<span class="disp-badge disp-mid">${t('disp.shared')}</span>`;
  return `<span class="disp-badge disp-bad">${t('disp.divergent')}</span>`;
}

function buildAliasMap(responses) {
  const names = [...new Set(responses.map(r => `${r.first_name} ${r.last_name}`))].sort();
  return Object.fromEntries(names.map((n, i) => [n, `Participant ${String.fromCharCode(65 + i)}`]));
}


function buildAllResponsesBlock(rResp, aliasMap) {
  if (!rResp.length) return '';
  const cat = getCat();
  const answeredNums = new Set();
  rResp.forEach(r => Object.keys(r.answers || {}).forEach(n => answeredNums.add(Number(n))));
  const activeQs = Qs.filter(q => answeredNums.has(q.n));
  if (!activeQs.length) return '';

  const groups = Object.keys(CAT).map(catKey => {
    const qs = activeQs.filter(q => q.cat === catKey);
    if (!qs.length) return '';
    const qBlocks = qs.map(q => {
      const pRows = rResp.map((r, i) => {
        const alias = aliasMap[`${r.first_name} ${r.last_name}`] || `Participant ${i + 1}`;
        const a = r.answers?.[q.n];
        const score = a && typeof a === 'object' ? a.score : (typeof a === 'number' ? a : null);
        const comment = a && typeof a === 'object' && a.comment ? a.comment.trim() : '';
        if (score === null) return '';
        return `<div class="allresp-p-row">
          <span class="allresp-p-alias">${alias}</span>
          <span class="allresp-p-score">${score}<span class="allresp-p-max">/5</span></span>
          ${comment ? `<span class="allresp-p-comment">${escapeHtml(comment)}</span>` : ''}
        </div>`;
      }).join('');
      return `<div class="allresp-q-block">
        <div class="allresp-q-text"><span class="allresp-q-num">${q.n}.</span> ${escapeHtml(qText(q))}</div>
        ${pRows}
      </div>`;
    }).join('');
    return `<div class="allresp-group">
      <div class="allresp-cat-label" style="color:${COL[catKey]}">${escapeHtml(cat[catKey])}</div>
      ${qBlocks}
    </div>`;
  }).filter(Boolean).join('');

  return `<div class="card mt allresp-card no-pdf">
    <div class="card-title">Réponses par question</div>
    ${groups}
  </div>`;
}

function buildTopBottomSection(qStats) {
  const cat = getCat();
  const cols = Object.keys(CAT).map(catKey => {
    const statsMap = Object.fromEntries(
      Object.values(qStats).filter(s => s.q.cat === catKey).map(s => [s.q.n, s])
    );
    if (!Object.keys(statsMap).length) return '';

    // Apply custom order if set, otherwise sort by delta desc
    let catList;
    if (customQOrder[catKey]) {
      catList = customQOrder[catKey].map(n => statsMap[n]).filter(Boolean);
      const ordered = new Set(customQOrder[catKey]);
      const rest = Object.values(statsMap).filter(s => !ordered.has(s.q.n)).sort((a, b) => b.delta - a.delta);
      catList = [...catList, ...rest];
    } else {
      catList = Object.values(statsMap).sort((a, b) => b.delta - a.delta);
    }

    const rows = catList.map(s => `
      <div class="topbot-q-row" draggable="true" data-qn="${s.q.n}" data-cat="${catKey}">
        <span class="topbot-drag-handle no-print">⠿</span>
        <span class="topbot-text">${escapeHtml(qText(s.q))}</span>
        <span class="topbot-avg">${s.avg.toFixed(1)}</span>
        <span class="topbot-delta">Δ ${s.delta.toFixed(2)}</span>
      </div>`).join('');

    return `<div class="topbot-cat" data-cat="${catKey}">
      <div class="topbot-cat-title" style="color:${COL[catKey]}">${escapeHtml(cat[catKey])}</div>
      ${rows}
    </div>`;
  }).filter(Boolean).join('');

  if (!cols) return '';

  return `
  <div class="card mt questions-card">
    <div class="card-title">${t('results.top_questions')}</div>
    <div class="topbot-list">${cols}</div>
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
  const rows = [...levels].reverse().map((stage, topIndex) => {
    const { top, bottom } = pyramidBandFractions(topIndex, total);
    const clip = pyramidClipPath(top, bottom);
    const rowHeight = Math.round((bottom - top) * PYRAMID_HEIGHT_PX);
    const scoreText = stage.score !== null ? stage.score.toFixed(1) : '';
    return `<div class="pyramid-row pyr-l${stage.level}" style="clip-path:${clip};height:${rowHeight}px">
      <div class="pyramid-inner">
        <span class="pyramid-text">
          <span class="pyramid-desc">${stage.labelDesc}</span>
          <span class="pyramid-key">${stage.labelKey}${scoreText ? `<span class="pyramid-score">${scoreText}</span>` : ''}</span>
        </span>
      </div>
    </div>`;
  }).join('');

  return `<div class="pyramid">${rows}</div>`;
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
      <div class="pyr-modal-topbar">
        <img src="/assets/cbtw-logo.svg" alt="CBTW">
        <div class="pyr-modal-toplabel">${t('pyramid.title')}</div>
      </div>
      <div class="pyr-modal-body">
        <div class="pyr-modal-header">
          <div class="pyr-modal-team-block">
            <div class="pyr-modal-team">${escapeHtml(teamName)}</div>
            <div class="pyr-modal-round">${escapeHtml(roundLabel)}</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="exportPyramidPDF()" style="font-size:12px;flex-shrink:0">${t('results.export_pdf')}</button>
        </div>
        <div class="pyr-modal-meta">${responseCount} ${t('pyramid.responses').toLowerCase()}</div>
        <div class="pyr-modal-divider"></div>
        ${buildPyramidContent(scores)}
      </div>
    </div>`;
  overlay.style.display = 'flex';
};

window.closePyramid = function () {
  const overlay = document.getElementById('pyramid-overlay');
  if (overlay) overlay.style.display = 'none';
};

export async function fetchResults() {
  document.getElementById('results-body').innerHTML =
    `<div class="empty-state"><div style="font-size:24px">&#9203;</div><div>${t('results.loading')}</div></div>`;
  try {
    state.allResponses = await getResponses();
    renderResults();
  } catch (e) {
    document.getElementById('results-body').innerHTML =
      `<div class="alert alert-error">${t('results.could_not_load')}${e.message}</div>`;
  }
}

function buildLongitudinalSection(ct, roundList) {
  const participantMap = {};

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
    <div class="card-title">${t('results.evolution')}</div>
    <div style="overflow-x:auto">
      <table class="responses-table longi-table">
        <thead><tr><th>${t('results.participant')}</th>${headers}<th>${t('results.trend')}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function renderResults() {
  const el = document.getElementById('results-body');
  const cat = getCat();

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
    el.innerHTML = `<div class="empty-state card"><div class="empty-icon">&#128202;</div><div class="font-bold" style="margin-bottom:8px">${t('results.no_data')}</div><div class="text-sm">${t('results.no_data_sub')}</div></div>`;
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
    <div class="print-header-topbar">
      <img src="/assets/cbtw-logo.svg" alt="CBTW">
      <div class="print-header-title">${t('results.health_assessment')}</div>
    </div>
    <div class="print-header-identity">
      <div class="print-header-teamname">${escapeHtml(ct.name)}</div>
      <div class="print-header-detail">${rRound ? escapeHtml(rRound.label) : '-'}${compareMeta} &middot; ${rResp.length} ${t('results.responses').toLowerCase()} &middot; ${printDate}</div>
    </div>
  </div>

  <div class="card no-print">
    <div class="card-title">${t('results.team')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${teamList.map(t_ => `<button class="team-pill ${t_.id === state.rTeamId ? 'active' : ''}" onclick="selectResultTeam('${t_.id}')">${escapeHtml(t_.name)}</button>`).join('')}
    </div>
  </div>

  <div class="card mt no-print">
    <div class="card-title">${t('results.round')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap${roundList.length > 1 ? ';margin-bottom:1rem' : ''}">
      ${roundList.map(r => `<button class="team-pill ${r.id === state.rRoundId ? 'active' : ''}" onclick="selectResultRound('${r.id}')">${escapeHtml(r.label)} <span style="opacity:0.6;font-size:11px">${r.responses.length}</span></button>`).join('')}
    </div>
    ${roundList.length > 1 ? `
    <div style="font-size:12px;color:var(--ink3);margin-bottom:6px">${t('results.compare')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="team-pill ${!state.cRoundId ? 'active' : ''}" onclick="selectCompareRound(null)" style="font-size:12px">${t('results.compare_none')}</button>
      ${roundList.filter(r => r.id !== state.rRoundId).map(r => `<button class="team-pill ${r.id === state.cRoundId ? 'compare' : ''}" onclick="selectCompareRound('${r.id}')" style="font-size:12px">${escapeHtml(r.label)}</button>`).join('')}
    </div>` : ''}
  </div>

  <div class="stats-grid mt">
    <div class="stat-card"><div class="stat-label">${t('results.responses')}</div><div class="stat-value">${rResp.length}</div></div>
    <div class="stat-card"><div class="stat-label">${t('results.overall')}</div><div class="stat-value">${ov.toFixed(1)}<span class="stat-max">/5</span></div></div>
    <div class="stat-card"><div class="stat-label">${t('results.strongest')}</div><div class="stat-value" style="font-size:18px;padding-top:8px">${ext(sc, 'max')}</div></div>
    <div class="stat-card"><div class="stat-label">${t('results.focus')}</div><div class="stat-value" style="font-size:18px;padding-top:8px">${ext(sc, 'min')}</div></div>
  </div>

  <div class="card mt scores-card">
    <div class="card-title">${t('results.scores')}</div>
    ${cSc ? `<div style="display:flex;gap:16px;margin-bottom:1rem">
      <div class="legend-item"><div class="legend-dot" style="background:var(--accent)"></div>${escapeHtml(rRound.label)}</div>
      <div class="legend-item"><div class="legend-dot" style="background:var(--amber);opacity:0.55"></div>${escapeHtml(cRound.label)}</div>
    </div>` : ''}
    <div class="bar-chart">
      ${Object.entries(cat).map(([catKey, label]) => {
        const s = sc[catKey];
        const cs = cSc ? cSc[catKey] : null;
        const p = s !== null ? (s / 5 * 100).toFixed(1) : 0;
        const cp = cs !== null ? (cs / 5 * 100).toFixed(1) : 0;
        return `<div class="bar-row">
          <div class="bar-label">${label}${dispBadge(dispersion[catKey])}</div>
          <div class="bar-track">
            ${cs !== null ? `<div class="bar-fill2" style="width:${cp}%;background:${COL[catKey]}"></div>` : ''}
            <div class="bar-fill" style="width:${p}%;background:${COL[catKey]}"><span>${s !== null ? s.toFixed(2) : '-'}</span></div>
          </div>
          <div class="bar-score">${s !== null ? s.toFixed(1) : '-'}</div>
        </div>`;
      }).join('')}
    </div>
  </div>

  ${buildTopBottomSection(qStats)}

  <div class="pyramid-pdf-embed"></div>

  <div class="card mt no-pdf">
    <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
      ${t('results.individual')}
      <div class="no-print" style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm" onclick="showPyramid()">${t('results.pyramid')}</button>
        <button class="btn btn-outline btn-sm" onclick="exportPagePDF()">${t('results.export_pdf')}</button>
        <button class="btn btn-outline btn-sm" onclick="exportCSV()">${t('results.export_csv')}</button>
        <button class="btn btn-outline btn-sm" onclick="fetchResults()">${t('results.refresh')}</button>
      </div>
    </div>
    <div style="overflow-x:auto">
      <table class="responses-table">
        <thead><tr><th>#</th><th>${t('results.participant')}</th><th>${t('results.date')}</th>${Object.values(cat).map(l => `<th>${l}</th>`).join('')}<th>${t('results.avg')}</th><th>${t('results.notes')}</th></tr></thead>
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
              ${Object.keys(cat).map(catKey => { const v = rs[catKey]; return `<td><span class="score-pill ${v !== null ? 'score-' + Math.round(v) : ''}">${v !== null ? v.toFixed(1) : '-'}</span></td>`; }).join('')}
              <td><strong>${ov2 !== null ? ov2.toFixed(2) : '-'}</strong></td>
              <td><button class="btn-comments ${comments.length ? 'has-comments' : ''}" onclick="toggleComments('${rowId}')" ${!comments.length ? 'disabled' : ''}>${comments.length ? '&#128172; ' + comments.length : '-'}</button></td>
            </tr>
            <tr class="comments-row" id="${rowId}" style="display:none">
              <td colspan="${7 + Object.keys(cat).length}">
                ${comments.map(c => `<div class="comment-block"><div class="comment-q">Q${c.q.n} &mdash; ${escapeHtml(cat[c.q.cat] || c.q.cat)}: "${escapeHtml(qText(c.q))}"</div><div class="comment-text">${escapeHtml(c.text)}</div></div>`).join('')}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>
  ${buildAllResponsesBlock(rResp, aliasMap)}
  ${buildLongitudinalSection(ct, roundList)}

`;
  initQuestionsOrderDrag();
}

function initQuestionsOrderDrag() {
  let dragSrc = null;

  document.querySelectorAll('.topbot-q-row[draggable]').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragSrc = row;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.classList.add('dragging'), 0);
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      document.querySelectorAll('.topbot-q-row').forEach(r => r.classList.remove('drag-over'));
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragSrc || row === dragSrc) return;
      if (row.dataset.cat !== dragSrc.dataset.cat) return;
      document.querySelectorAll('.topbot-q-row').forEach(r => r.classList.remove('drag-over'));
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === row || row.dataset.cat !== dragSrc.dataset.cat) return;
      const parent = row.parentElement;
      const rows = [...parent.querySelectorAll('.topbot-q-row')];
      const srcIdx = rows.indexOf(dragSrc);
      const tgtIdx = rows.indexOf(row);
      parent.insertBefore(dragSrc, srcIdx < tgtIdx ? row.nextSibling : row);
      customQOrder[dragSrc.dataset.cat] = [...parent.querySelectorAll('.topbot-q-row')].map(r => Number(r.dataset.qn));
      setQOrder(customQOrder).catch(() => {});
      row.classList.remove('drag-over');
    });
  });
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

  const cat = getCat();
  const catKeys = Object.keys(cat);
  const headers = [t('results.participant'), t('results.date'), ...Object.values(cat), t('results.avg')];
  const aliasMap = buildAliasMap(rRound.responses);

  const rows = rRound.responses.map((r, i) => {
    const rs = calcScores([r]);
    const vals = Object.values(rs).filter(v => v !== null);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const alias = aliasMap[`${r.first_name} ${r.last_name}`] || `Participant ${i + 1}`;
    return [
      `"${alias}"`,
      new Date(r.submitted_at).toLocaleDateString(),
      ...catKeys.map(catKey => rs[catKey] !== null ? rs[catKey].toFixed(2) : ''),
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

  const cat = getCat();
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

  const scoreRows = Object.keys(cat).map(catKey => {
    const v = scores[catKey];
    return `<div class="info-score-row">
        <span class="info-score-label">${escapeHtml(cat[catKey])}</span>
        <span class="score-pill ${v !== null ? 'score-' + Math.round(v) : ''}">${v !== null ? v.toFixed(1) : '-'}</span>
      </div>`;
  }).join('');

  const commentsHtml = comments.length
    ? comments.map(c => `<div class="comment-block"><div class="comment-q">Q${c.q.n} &mdash; ${escapeHtml(cat[c.q.cat] || c.q.cat)}: "${escapeHtml(qText(c.q))}"</div><div class="comment-text">${escapeHtml(c.text)}</div></div>`).join('')
    : `<div class="text-sm" style="color:var(--ink3)">${t('results.no_comments')}</div>`;

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
        <div><span class="info-meta-label">${t('pyramid.team')}</span>${escapeHtml(teamName)}</div>
        <div><span class="info-meta-label">${t('pyramid.round')}</span>${escapeHtml(roundLabel)}</div>
        <div><span class="info-meta-label">${t('results.submitted')}</span>${escapeHtml(submittedAt)}</div>
        <div><span class="info-meta-label">${t('results.overall_score')}</span>${overall !== null ? overall.toFixed(2) : '-'}</div>
      </div>
      <div class="info-section-title">${t('results.scores_section')}</div>
      <div class="info-scores">${scoreRows}</div>
      <div class="info-section-title">${t('results.comments_section')}</div>
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
  canvas.height = pyrH * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, pyrH);

  const CX = W / 2;
  const BAND_COLORS = ['#1C1C1C', '#1E9FD8', '#F4D93B', '#F7A81C', '#EC4F26'];

  function bandTextColor(hex, alpha = 1) {
    const r = parseInt(hex.slice(1,3),16)/255;
    const g = parseInt(hex.slice(3,5),16)/255;
    const b = parseInt(hex.slice(5,7),16)/255;
    const lum = 0.299*r + 0.587*g + 0.114*b;
    const [rv,gv,bv] = lum > 0.5 ? [26,26,26] : [255,255,255];
    return alpha < 1 ? `rgba(${rv},${gv},${bv},${alpha})` : `rgb(${rv},${gv},${bv})`;
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

    const bandColor = BAND_COLORS[band.level - 1];
    const tY_desc = y + band.h - 24;
    const tY_key  = y + band.h - 11;

    // Desc — centered, dimmed
    ctx.font = '400 8px Inter, system-ui, sans-serif';
    ctx.fillStyle = bandTextColor(bandColor, 0.68);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(band.labelDesc, CX, tY_desc);

    // Key + score inline, centered as a group
    const keyLabel = band.labelKey.toUpperCase();
    const scoreStr = band.score !== null ? band.score.toFixed(1) : '';
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    const keyW = ctx.measureText(keyLabel).width;
    ctx.font = '500 10px Inter, system-ui, sans-serif';
    const scoreW = scoreStr ? ctx.measureText(scoreStr).width + 7 : 0;
    const lineW = keyW + scoreW;
    let lx = CX - lineW / 2;

    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.fillStyle = bandTextColor(bandColor);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(keyLabel, lx, tY_key);

    if (scoreStr) {
      ctx.font = '500 10px Inter, system-ui, sans-serif';
      ctx.fillStyle = bandTextColor(bandColor, 0.62);
      ctx.fillText(scoreStr, lx + keyW + 7, tY_key);
    }

    ctx.restore();
    y += band.h + GAP;
  });

  return canvas;
}

window.exportPagePDF = function () {
  if (!lastPyramidContext) return;

  const pyramidImg = buildPyramidCanvas(lastPyramidContext.scores).toDataURL('image/png');

  // Clone results body, strip screen-only and individual-responses elements
  const resultsBody = document.getElementById('results-body');
  if (!resultsBody) return;
  const clone = resultsBody.cloneNode(true);
  clone.querySelectorAll('.no-print, .no-pdf, .pyramid-pdf-embed').forEach(el => el.remove());

  // Insert pyramid image just before the print footer
  const logoUrl = `${location.origin}/assets/cbtw-logo.svg`;
  const pyramidBlock = document.createElement('div');
  pyramidBlock.style.cssText = 'page-break-before:always;';
  pyramidBlock.innerHTML = `
    <div style="background:#F4D93B;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin-left:-1.5cm;margin-right:-1.5cm;padding:14px 1.5cm;display:flex;align-items:center;justify-content:space-between;">
      <img src="${logoUrl}" style="height:18px;filter:brightness(0);" alt="CBTW">
      <span style="font-size:11px;color:rgba(0,0,0,0.45);text-transform:uppercase;letter-spacing:0.07em;font-weight:500;">${t('pyramid.title')}</span>
    </div>
    <div style="margin-top:2rem;">
      <img src="${pyramidImg}" style="max-width:100%;height:auto;display:block;">
    </div>`;
  const footer = clone.querySelector('.print-footer');
  footer ? clone.insertBefore(pyramidBlock, footer) : clone.appendChild(pyramidBlock);

  const cssBase = location.origin + '/css/style.css';
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head>
    <base href="${location.origin}">
    <title>TeamPulse — ${escapeHtml(lastPyramidContext.teamName)} — ${escapeHtml(lastPyramidContext.roundLabel)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="${cssBase}">
    <style>
      body{background:#fff;padding:0 1.5cm 1.5cm;}
      .print-header,.print-footer{display:block!important;}
      .bar-fill,.bar-fill2{animation:none!important;}
      @page{margin:0;}
    </style>
  </head><body>
    ${clone.innerHTML}
  </body></html>`);
  doc.close();

  iframe.addEventListener('load', () => {
    // Wait for external CSS + fonts to apply before opening print dialog
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 2000);
    }, 400);
  });
};

window.exportPyramidPDF = function () {
  if (!lastPyramidContext) return;
  const { scores, teamName, roundLabel, responseCount } = lastPyramidContext;

  const btn = document.querySelector('#pyramid-overlay [onclick="exportPyramidPDF()"]');
  if (btn) { btn.disabled = true; btn.textContent = t('results.loading'); }

  try {
    const canvas = buildPyramidCanvas(scores);
    const imgData = canvas.toDataURL('image/png');

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    const printDate = new Date().toLocaleDateString();
    const logoUrl = `${location.origin}/assets/cbtw-logo.svg`;
    doc.write(`<!DOCTYPE html><html><head>
      <title>TeamPulse — ${escapeHtml(teamName)} — ${escapeHtml(roundLabel)}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#fff;font-family:Inter,system-ui,sans-serif;color:#1A1A1A;}
        .topbar{background:#F4D93B;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:16px 1.5cm;display:flex;align-items:center;justify-content:space-between;}
        .topbar img{height:20px;filter:brightness(0);}
        .topbar-label{font-size:11px;color:rgba(0,0,0,0.45);text-transform:uppercase;letter-spacing:0.07em;font-weight:500;}
        .content{padding:32px 1.5cm 40px;}
        .team-block{display:flex;align-items:baseline;justify-content:space-between;gap:2rem;margin-bottom:4px;}
        .team{font-size:30px;font-weight:800;color:#1A1A1A;line-height:1.1;letter-spacing:-0.02em;}
        .round{font-size:14px;font-weight:500;color:#6A655B;white-space:nowrap;}
        .meta{font-size:12px;color:#A39D8F;margin-bottom:24px;}
        .divider{height:1px;background:#E8E3D8;margin-bottom:24px;}
        img.pyramid{max-width:100%;height:auto;display:block;}
        @page{margin:0;}
      </style>
    </head><body>
      <div class="topbar">
        <img src="${logoUrl}" alt="CBTW">
        <div class="topbar-label">${t('pyramid.title')}</div>
      </div>
      <div class="content">
        <div class="team-block">
          <div class="team">${escapeHtml(teamName)}</div>
          <div class="round">${escapeHtml(roundLabel)}</div>
        </div>
        <div class="meta">${responseCount} ${t('pyramid.responses').toLowerCase()} &middot; ${printDate}</div>
        <div class="divider"></div>
        <img class="pyramid" src="${imgData}">
      </div>
    </body></html>`);
    doc.close();

    iframe.addEventListener('load', () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    });
  } catch (e) {
    alert(t('alert.export_failed') + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('results.export_pdf'); }
  }
};
