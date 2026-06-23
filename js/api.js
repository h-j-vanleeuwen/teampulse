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
export const addTeamDB     = (name, expected) => api('teams', { method: 'POST', body: JSON.stringify(expected ? { name, expected_participants: expected } : { name }) });
export const updateTeamDB  = (id, data)   => api('teams?id=eq.' + id, { method: 'PATCH', body: JSON.stringify(data) });
export const delTeamDB     = id           => api('teams?id=eq.' + id, { method: 'DELETE', prefer: '' });

export const getRounds     = ()           => api('rounds?select=*,teams(name)&order=created_at.asc');
export const addRoundDB    = (teamId, label) => api('rounds', {
  method: 'POST',
  body: JSON.stringify({ team_id: teamId, label, questions: JSON.stringify(Array.from({ length: 37 }, (_, i) => i + 1)) }),
});
export const updateRoundQs = (id, qs)     => api('rounds?id=eq.' + id, { method: 'PATCH', body: JSON.stringify({ questions: JSON.stringify([...qs]) }) });
export const delRoundDB    = id           => api('rounds?id=eq.' + id, { method: 'DELETE', prefer: '' });
export const getRoundById  = id           => api('rounds?id=eq.' + id + '&select=*,teams(name)');

export const saveResp      = (roundId, firstName, lastName, answers) => api('responses', {
  method: 'POST',
  body: JSON.stringify({ round_id: roundId, first_name: firstName, last_name: lastName, answers }),
});
export const getResponses  = ()           => api('responses?select=*,rounds(id,label,team_id,teams(name))&order=submitted_at.desc');

export const getPinDB      = ()           => api('settings?key=eq.admin_pin&select=value');
export const setPinDB      = hash         => api('settings?key=eq.admin_pin', { method: 'PATCH', body: JSON.stringify({ value: hash }) });

export const getQOrder     = ()           => api('settings?key=eq.q_order&select=value');
export const setQOrder     = (value)      => api('settings', { method: 'POST', body: JSON.stringify({ key: 'q_order', value: JSON.stringify(value) }), prefer: 'resolution=merge-duplicates,return=minimal' });
