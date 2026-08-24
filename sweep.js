// The 5&2 Foundation — Monthly Security Sweep ("the watchman keeps watch").
// Runs real, non-destructive checks against the live stack, has Ezekiel write
// a plain-language report, and stores it in Supabase.
//
// Trigger: Vercel Cron (see vercel.json) or manually with the CRON_SECRET.
// Env required: SITE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
// Env optional: SUITE_URL, ANTHROPIC_API_KEY, SWEEP_TABLES (comma list)

function b64urlDecode(s) { try { return Buffer.from(s, 'base64url').toString('utf8'); } catch { return ''; } }

export default async function handler(req, res) {
  // Only allow authorized triggers (Vercel Cron sends this header when CRON_SECRET is set).
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (secret && auth !== 'Bearer ' + secret) return res.status(401).json({ error: 'unauthorized' });

  const SITE_URL = process.env.SITE_URL;
  const SUITE_URL = process.env.SUITE_URL || '';
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const ANON = process.env.SUPABASE_ANON_KEY;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const TABLES = (process.env.SWEEP_TABLES ||
    'volunteer_signups,contact_messages,partner_inquiries,donation_intents')
    .split(',').map(s => s.trim()).filter(Boolean);

  const findings = [];
  const add = (area, severity, status, detail) => findings.push({ area, severity, status, detail });

  // 1. Site reachable + security headers
  if (SITE_URL) {
    try {
      const r = await fetch(SITE_URL, { redirect: 'manual' });
      const h = r.headers;
      const wanted = {
        'strict-transport-security': 'HSTS',
        'x-content-type-options': 'X-Content-Type-Options',
        'x-frame-options': 'X-Frame-Options',
        'content-security-policy': 'Content-Security-Policy',
        'referrer-policy': 'Referrer-Policy',
        'permissions-policy': 'Permissions-Policy',
      };
      const missing = Object.keys(wanted).filter(k => !h.get(k));
      if (missing.length) add('Security headers', 'medium', 'warn', 'Missing: ' + missing.map(k => wanted[k]).join(', ') + '. Add them in the site\'s vercel.json (see README).');
      else add('Security headers', 'info', 'pass', 'All recommended headers present.');
    } catch (e) { add('Site reachability', 'high', 'fail', 'Could not fetch the site: ' + e.message); }

    // 1b. http -> https redirect
    try {
      const r = await fetch(SITE_URL.replace(/^https:/, 'http:'), { redirect: 'manual' });
      const loc = r.headers.get('location') || '';
      if (r.status >= 300 && r.status < 400 && loc.startsWith('https:')) add('HTTPS redirect', 'info', 'pass', 'HTTP redirects to HTTPS.');
      else add('HTTPS redirect', 'medium', 'warn', 'HTTP may not redirect to HTTPS (status ' + r.status + ').');
    } catch (e) { add('HTTPS redirect', 'info', 'info', 'Could not test HTTP redirect (' + e.message + ').'); }

    // 4. Exposed secret / placeholders in HTML
    try {
      const html = await (await fetch(SITE_URL)).text();
      if (/service_role/i.test(html)) add('Exposed secret', 'critical', 'fail', 'The string "service_role" appears in the site HTML — a secret key may be exposed. Remove it immediately.');
      else add('Exposed secret', 'info', 'pass', 'No service_role string in the site HTML.');
      if (/YOUR-PROJECT-REF|YOUR-ANON-PUBLIC-KEY/.test(html)) add('Config placeholders', 'high', 'fail', 'Supabase placeholders were never replaced — the volunteer form is not saving anything.');
    } catch (e) { /* covered above */ }
  }

  // 2. Supabase RLS read probe — anon must NOT be able to read rows
  if (SUPABASE_URL && ANON) {
    for (const t of TABLES) {
      try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(t)}?select=*&limit=1`,
          { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
        let rows = []; try { rows = await r.json(); } catch { }
        if (Array.isArray(rows) && rows.length > 0)
          add('RLS read · ' + t, 'critical', 'fail', 'The PUBLIC key can READ rows from "' + t + '". This data is exposed. Ensure RLS is ON and anon has no SELECT policy.');
        else
          add('RLS read · ' + t, 'info', 'pass', 'Public key cannot read "' + t + '" (RLS is blocking reads).');
      } catch (e) { add('RLS read · ' + t, 'medium', 'warn', 'Could not probe "' + t + '": ' + e.message); }
    }

    // 3. Published key must be the anon key, not service_role
    try {
      const parts = String(ANON).split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(b64urlDecode(parts[1]) || '{}');
        if (payload.role && payload.role !== 'anon')
          add('Public key role', 'critical', 'fail', 'The key configured for the site has role="' + payload.role + '". This must be the ANON key, never service_role.');
        else
          add('Public key role', 'info', 'pass', 'Published key role is "anon".');
      }
    } catch (e) { add('Public key role', 'info', 'info', 'Could not decode the anon key.'); }
  }

  // 5. Operations Suite proxy must reject unauthenticated calls
  if (SUITE_URL) {
    try {
      const r = await fetch(SUITE_URL.replace(/\/$/, '') + '/api/anthropic', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }] }),
      });
      if (r.status === 401) add('Suite login enforced', 'info', 'pass', 'The Operations Suite proxy rejects calls with no token (401).');
      else add('Suite login enforced', 'critical', 'fail', 'The suite proxy returned ' + r.status + ' with NO token — it may not be enforcing login. Check SESSION_SECRET.');
    } catch (e) { add('Suite login enforced', 'info', 'info', 'Could not reach the suite proxy: ' + e.message); }
  }

  // Rank + summarize
  const rank = { critical: 0, high: 1, medium: 2, info: 3 };
  findings.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
  const counts = findings.reduce((m, f) => { m[f.severity] = (m[f.severity] || 0) + 1; return m; }, {});
  const worst = (findings.find(f => f.status === 'fail') || {}).severity || 'none';

  // 6. Ezekiel writes the monthly report
  let narrative = '';
  if (ANTHROPIC_API_KEY) {
    try {
      const prompt = `You are Ezekiel, the Threat Watchman on The 5&2 Foundation's Cybersecurity team (Ezekiel 33 — the watchman who warns the city). Write this month's short security report for a small, non-technical nonprofit team. Be calm and reassuring, never alarmist. Start with the overall standing in one line, then briefly note what is healthy, then list anything to fix — most urgent first — each with one simple next step. Under ~350 words. Frame security as faithful stewardship of what's been entrusted.

Automated findings (JSON): ${JSON.stringify(findings)}`;
      const ar = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
      });
      const ad = await ar.json();
      narrative = (ad.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n\n') || '';
    } catch (e) { narrative = '(Report write-up skipped: ' + e.message + ')'; }
  }

  const report = { ran_at: new Date().toISOString(), worst_failing_severity: worst, counts, findings, narrative };

  // 7. Store in Supabase (service_role, server-only)
  if (SUPABASE_URL && SERVICE) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/security_sweeps`, {
        method: 'POST',
        headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ worst_severity: worst, summary: narrative, findings }),
      });
    } catch (e) { /* non-fatal */ }
  }

  return res.status(200).json(report);
}
