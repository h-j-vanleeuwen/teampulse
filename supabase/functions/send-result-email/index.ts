// Supabase Edge Function: send-result-email
//
// Emails a survey participant their individual Lencioni result right after
// they submit the questionnaire. Called from js/survey.js (via
// js/api.js#sendResultEmail), unauthenticated (survey takers have no
// Supabase session), so this function must be deployed with
// --no-verify-jwt. See README.md in this folder for the full deployment
// steps.
//
// The client is the source of truth for *content*: it already knows which
// categories the admin chose to reveal (round.email_categories) and has the
// localized question text (current survey language), so it sends the
// filtered, per-question breakdown directly — this function only turns that
// payload into an HTML email and sends it via Resend.
//
// Required secret: RESEND_API_KEY (https://resend.com)
// Optional secret: RESEND_FROM (defaults to Resend's shared sandbox sender,
//   which only delivers to the Resend account's own email until a domain is
//   verified — verify your domain in Resend and set RESEND_FROM for
//   production sending to arbitrary participants)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'TeamPulse <onboarding@resend.dev>';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Same 5 Lencioni categories as js/config.js, duplicated here because this
// function runs in Deno, isolated from the browser ES modules. Only used to
// order sections and pick a dot color — labels come from the client payload
// (already localized in the participant's survey language).
const CAT_ORDER = ['Confiance', 'Conflit', 'Engagement', 'Responsabilite', 'Resultats'];
const COL: Record<string, string> = {
  Confiance: '#2D5BE3',
  Conflit: '#E8820A',
  Engagement: '#1A7A4A',
  Responsabilite: '#8E44AD',
  Resultats: '#C0392B',
};
function escapeHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type Answer = { cat: string; catLabel?: string; qn: number; text: string; score: number; comment?: string };

function buildEmailHtml(payload: {
  firstName: string; teamName: string; roundLabel: string;
  scores: Record<string, number | null>; categories: string[]; answers: Answer[];
}) {
  const cats = (payload.categories?.length ? payload.categories : CAT_ORDER)
    .filter(c => CAT_ORDER.includes(c));

  const sections = cats.map(cat => {
    const catAnswers = (payload.answers || []).filter(a => a.cat === cat);
    if (!catAnswers.length) return '';
    const label = catAnswers[0].catLabel || cat;
    const score = payload.scores?.[cat] ?? null;
    const scoreText = score === null ? '—' : score.toFixed(1) + ' / 5';

    const rows = catAnswers.map(a => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">
          <div>${escapeHtml(a.text)}</div>
          ${a.comment ? `<div style="color:#888;font-size:13px;font-style:italic;margin-top:4px;">“${escapeHtml(a.comment)}”</div>` : ''}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;white-space:nowrap;">${a.score} / 5</td>
      </tr>`).join('');

    return `
    <div style="margin-top:22px;">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:6px;">
        <div>
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${COL[cat]};margin-right:8px;"></span>
          <strong style="font-size:15px;">${escapeHtml(label)}</strong>
        </div>
        <div>
          <span style="font-weight:600;">${scoreText}</span>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;">
    <h2 style="margin-bottom:4px;">Bonjour ${escapeHtml(payload.firstName)},</h2>
    <p style="color:#555;margin-top:0;">Voici votre résultat individuel pour <strong>${escapeHtml(payload.teamName)}</strong> — ${escapeHtml(payload.roundLabel)}.</p>
    <p style="color:#888;font-size:12px;">Échelle : 1 (Jamais) à 5 (Toujours).</p>
    ${sections}
    <p style="color:#888;font-size:12px;margin-top:24px;">Envoyé automatiquement par TeamPulse.</p>
  </div>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY secret is not set');
    return new Response(JSON.stringify({ ok: false, error: 'Email sending is not configured' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { to, firstName, teamName, roundLabel, scores, categories, answers } = body || {};
  if (typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid recipient email' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const html = buildEmailHtml({
    firstName: firstName || '',
    teamName: teamName || '',
    roundLabel: roundLabel || '',
    scores: scores || {},
    categories: Array.isArray(categories) ? categories : [],
    answers: Array.isArray(answers) ? answers : [],
  });

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject: `Votre résultat individuel — ${roundLabel || 'TeamPulse'}`,
        html,
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error('Resend error:', errText);
      return new Response(JSON.stringify({ ok: false, error: errText }), {
        status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Resend call failed:', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
