import { SB, KEY } from './config.js';

async function api(path, opts = {}) {
  const r = await fetch(SB + '/rest/v1/' + path, {
    ...opts,
    headers: {
      'apikey': KEY,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || 'return=representation',
      ...(opts.headers || {}),
    },
  });
  if (!r.ok) throw new Error(await r.text());
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export const getTeams      = ()           => api('teams?select=*&order=created_at.asc');
export const addTeamDB     = name         => api('teams', { method: 'POST', body: JSON.stringify({ name }) });
export const delTeamDB     = id           => api('teams?id=eq.' + id, { method: 'DELETE', prefer: '' });

export const getRounds     = ()           => api('rounds?select=*,teams(name)&order=created_at.asc');
export const addRoundDB    = (teamId, label, expected, sendIndividualResult) => api('rounds', {
  method: 'POST',
  body: JSON.stringify({ team_id: teamId, label, questions: JSON.stringify(Array.from({ length: 37 }, (_, i) => i + 1)), ...(expected ? { expected_participants: expected } : {}), send_individual_result: !!sendIndividualResult }),
});
export const updateRoundDB = (id, data)   => api('rounds?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(data) });
export const updateRoundQs = (id, qs)     => api('rounds?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ questions: JSON.stringify([...qs]) }) });
export const delRoundDB    = id           => api('rounds?id=eq.' + id, { method: 'DELETE', prefer: '' });
export const getRoundById  = id           => api('rounds?id=eq.' + id + '&select=*,teams(name)');

export const saveResp      = (roundId, firstName, lastName, answers, email) => api('responses', {
  method: 'POST',
  body: JSON.stringify({ round_id: roundId, first_name: firstName, last_name: lastName, answers, ...(email ? { email } : {}) }),
});
export const getResponses  = ()           => api('responses?select=*,rounds(id,label,team_id,teams(name))&order=submitted_at.desc');

// Fire-and-forget call to the Supabase Edge Function that emails the participant
// their individual result. Never throws to the caller — a failed email must not
// block the survey submission flow; errors are only logged.
export async function sendResultEmail(payload) {
  try {
    const r = await fetch(SB + '/functions/v1/send-result-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': 'Bearer ' + KEY },
      body: JSON.stringify(payload),
    });
    if (!r.ok) console.error('sendResultEmail failed:', await r.text());
  } catch (e) {
    console.error('sendResultEmail failed:', e);
  }
}

export const getPinDB      = ()           => api('settings?key=eq.admin_pin&select=value');
export const setPinDB      = hash         => api('settings?key=eq.admin_pin', { method: 'PATCH', body: JSON.stringify({ value: hash }) });

export const getQOrder     = ()           => api('settings?key=eq.q_order&select=value');
export const setQOrder     = (value)      => api('settings', { method: 'POST', body: JSON.stringify({ key: 'q_order', value: JSON.stringify(value) }), prefer: 'resolution=merge-duplicates,return=minimal' });
