# BrainDocs / BrainTools — Distribution Playbook

Goal: paying users in the funnel within 14 days. Strategy: programmatic SEO + Trojan-horse direct outreach + revenue ladder.

## 1. Programmatic SEO (live)
750 long-tail landing pages are generated at:
- `https://braindocs-7qqx.onrender.com/l/{service}-{niche}-{city}-{state}`
  - e.g. `/l/estimate-mobile-mechanic-san-antonio-tx`
- Sitemap: `/sitemap.xml` (752 URLs) · Robots: `/robots.txt`
- Every page: unique title/meta, FAQ JSON-LD, pre-filled builder link, $3.99 / $19 / $49 CTAs.

**Indexing (needs ~1 hour of manual work):**
1. Go to https://search.google.com/search-console and add the domain `https://braindocs-7qqx.onrender.com` (verify via DNS/meta).
2. Submit `https://braindocs-7qqx.onrender.com/sitemap.xml`.
3. Request indexing for the 10 highest-intent pages (mechanic/roofer/plumber estimate + invoice for San Antonio, Houston, Austin, Dallas).
4. Do the same at https://www.bing.com/webmasters (indexnow auto-pings).

## 2. Trojan-horse outreach (20 messages/day, 7 days)
High-intent targets = people actively advertising a service. Sources:
- Craigslist San Antonio + Houston: Services → "labor gigs", "skilled trade", "automotive", "real estate"
- Facebook Groups (search "San Antonio small business", "Texas contractors", "mobile mechanics", "cleaning business owners")
- Nextdoor (contractor listings), Thumbtack/HomeAdvisor profiles (public contact), local FB marketplace services

**Pitch template (personalize each one):**
> "Hey [Name], saw your [service] listing. I built a free tool that makes instant itemized [quotes/invoices] for [niche] — pre-filled with common line items. I made a sample for you here: [pre-filled builder link]. No account, works on your phone. If you want your business name and rates baked in, tell me and I'll send a custom version. Free to try — $3.99 only if you want the watermark off."

Pre-filled sample links (copy into messages):
- Mobile mechanic estimate: `https://braindocs-7qqx.onrender.com/l/estimate-mobile-mechanic-san-antonio-tx`
- Roofer quote: `https://braindocs-7qqx.onrender.com/l/quote-roofer-houston-tx`
- Lawn care invoice: `https://braindocs-7qqx.onrender.com/l/invoice-lawn-care-austin-tx`
- Detailer estimate: `https://braindocs-7qqx.onrender.com/l/estimate-detailer-dallas-tx`

Routine: 20 personalized messages/day → ~5 replies → ~2–3 paid unlocks (≈$10–15/day Phase 1).

## 3. Revenue ladder (pricing live)
- Phase 1 (Days 1–14): Pay-per-use **$3.99** — already live.
- Phase 2 (Days 15–30): **Founder Lifetime $49, capped at 50** — already live. Target: 30 × $49 = **$1,470**.
- Phase 3 (Month 2+): **Pro $19/mo** — already live. 200 subs × $19 = **$3,800/mo**.

## 4. Keep-alive / ops (automated)
- GitHub Action pings all BrainAdvisor apps every 10 min + daily revenue email to 1034jcd@gmail.com (secrets: STRIPE_SECRET_KEY, SMTP_USER, SMTP_PASS, ADMIN_EMAIL).

## 5. Founder-access loop
- "Request a template" section (index) + email 1034jcd@gmail.com. Ship requested templates within 24h to build evangelists.

## 6. $1M scale roadmap (executing)
**B2B-first pricing (live):** Base $3.99 · Pro $19/mo · Business White-Label $49/mo (logo on PDFs, saved history) · Founder Lifetime $49 (cap 50).
- Volume math: 333 businesses × $250/mo = $1M ARR → we target contractors/property managers/auto shops via niche pages + outreach, not consumers.
- Lock-in moat (live): Saved Documents history in localStorage + white-label branding raise switching cost; Pro/Business get 50 saved, free gets 3.
- Portfolio multiplier: `pages.js` + `renderLanding()` are the modular engine. Each niche (mechanic, roofer, plumber…) is data, not code — 85% shared. New niche variant = new data row + (optionally) a re-branded service. Launch strategy: after BrainDocs hits ~$3k/mo, spin up 2–3 niche variants (e.g. DetailPro, TradeQuotes) from this same repo.
- Expansion revenue (future): SMS/WhatsApp client notifications (~$0.10/text, needs paid SMS API), custom-domain white-label ($50–100/mo, needs Render paid plan).
- Exit: at $15–20k/mo ARR with near-zero churn, portfolio is worth ~4–5x ARR ($700k–$1.2M) on Acquire.com/Flippa.
