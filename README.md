# The 5&2 Foundation — Monthly Security Sweep

A small scheduled function that checks your live stack once a month, has **Ezekiel** (your Threat Watchman) write the results up in plain language, and saves the report to Supabase. *The watchman keeps watch.*

```
52-security-sweep/
├── api/sweep.js          the checks + Ezekiel write-up + storage
├── vercel.json           runs it monthly (9:00 on the 1st)
├── security_sweeps.sql   one table to add to your Supabase project
└── README.md
```

## Setup
1. Run `security_sweeps.sql` in your Foundation Supabase project (SQL Editor).
2. Deploy this folder as its own Vercel project (Framework preset: **Other**, no build command).
3. Add these environment variables in Vercel → Settings → Environment Variables:

   | Name | Value |
   |------|-------|
   | `SITE_URL` | `https://the52foundation.org` |
   | `SUPABASE_URL` | your Foundation project URL |
   | `SUPABASE_ANON_KEY` | the **anon** (public) key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** key (server-only — never in any website) |
   | `CRON_SECRET` | a long random string (`openssl rand -hex 32`) |
   | `ANTHROPIC_API_KEY` | your Anthropic key (for Ezekiel's write-up) — optional |
   | `SUITE_URL` | the Operations Suite app URL, to test its login — optional |

4. Redeploy. It now runs on the 1st of each month. **To run it on demand**, POST to `/api/sweep` with header `Authorization: Bearer <CRON_SECRET>`.
5. Read reports in Supabase → Table Editor → `security_sweeps` (newest first).

> Vercel cron availability and frequency depend on your plan — confirm monthly scheduling is allowed on yours. The on-demand trigger works on any plan.

## What it checks (all real, all non-destructive)
- **Supabase RLS** — tries to read each table with the public key; flags CRITICAL if any rows come back.
- **Published key** — decodes it to confirm it's the anon key, not service_role.
- **Exposed secrets / placeholders** — scans the site HTML for `service_role` or unreplaced Supabase placeholders.
- **Operations Suite login** — confirms the proxy rejects calls with no token (401).
- **Security headers + HTTPS redirect** — reports missing headers and whether HTTP forwards to HTTPS.

## What it is NOT
This is a focused standards check for *your* stack — **not** a full penetration test. A few times a year, also run:
- **Supabase → Advisors → Security Advisor** (in your dashboard) — catches RLS/config issues.
- **Mozilla Observatory** (observatory.mozilla.org) — headers & TLS grade.
- **Qualys SSL Labs** (ssllabs.com/ssltest) — certificate/TLS depth.

## Likely first finding: missing security headers
Static sites often ship without them. Add this to the **website's** `vercel.json` (test after — a strict CSP can block things):
```json
{
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
      { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co; img-src 'self' data:;" }
    ]}
  ]
}
```
