# The 5&2 Foundation — Go-Live Guide

Three files:
- `index.html` — deploy-ready website (volunteer form wired to Supabase, with a fallback so it works before keys are set)
- `the52foundation-schema.sql` — the database, for a **new, separate** Foundation Supabase project
- this guide

> Standing rule honored throughout: this is its own Supabase project, its own keys, its own domain — **nothing shared with Restore & Rise.**

---

## Part A — Supabase (5 minutes)
1. Go to supabase.com → **New project**. Name it something like `the52foundation`. (Do **not** reuse the Restore & Rise project.)
2. Open **SQL Editor** → paste all of `the52foundation-schema.sql` → **Run**. You should see the four tables created.
3. Go to **Project Settings → API** and copy two things:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - **anon public** key (safe to expose — RLS limits it to inserts only)
4. Open `index.html`, find the two lines near the bottom, and paste your values:
   ```js
   const SUPABASE_URL      = 'https://YOUR-PROJECT-REF.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
   ```
   Save. (Before this step the form still shows the thank-you message but stores nothing.)

**To read volunteer signups:** Supabase Dashboard → Table Editor → `volunteer_signups`. Never put the *service_role* key in the website.

---

## Part B — Deploy to Vercel
**Fastest (no Git):** vercel.com → **Add New → Project → Deploy** and drop the folder containing `index.html`. It's a static site — no build command, no framework, nothing to configure.

**Git route:** put `index.html` in a repo, import it in Vercel, Framework preset = **Other**, no build command.

---

## Part C — Domain: the52foundation.org
1. In the Vercel project → **Settings → Domains** → add `the52foundation.org` and `www.the52foundation.org`.
2. Vercel will show you the exact DNS records. In **Namecheap → Domain List → Manage → Advanced DNS**, add what Vercel shows. These are typically:
   - **A record** — Host `@` → `76.76.21.21`
   - **CNAME** — Host `www` → `cname.vercel-dns.com`

   Use exactly what the Vercel dashboard displays — that's the source of truth if the values differ.
3. Give DNS a few minutes (sometimes up to a couple hours). Vercel issues HTTPS automatically once it verifies.

---

## Not in this deploy (on purpose)
- **Donations** — the give buttons don't charge anyone yet. Real payments need a processor (Stripe Payment Links or Checkout), which needs your Stripe account. Ask me and I'll wire it. (The `donation_intents` table can log button clicks as analytics, but that is not a charge.)
- **The AI Operations Suite** — it calls the Anthropic API directly, which works in your Claude preview but would break, and be unprotected, on a public URL. Putting it online needs a login plus a small server-side proxy holding the API key. That's a separate build whenever you're ready.
