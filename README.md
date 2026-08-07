# BrainDocs — by BrainAdvisor

Professional documents in seconds. Invoices, quotes/estimates, and Texas landlord notices (3-Day Notice). Fill a form, download a clean PDF. No designer, no lawyer, no hassle.

- **Free** — all 3 templates, watermarked PDF
- **Single** — $3.99 one-time, one watermark-free PDF
- **Pro** — $19/mo, unlimited watermark-free PDFs + AI tools, cancel anytime
- **Lifetime Pass** — $49 one-time (first 50 buyers), unlimited forever

Part of the **BrainAdvisor** family of apps → https://brainadvisor.onrender.com

## AI Tools (BrainTools)
- **Review Responder** — paste a customer review, get 3 ready-to-post replies (warm / professional / SEO-friendly).
- **Scope Estimator** — upload a job photo, get an itemized AI estimate, push it into the BrainDocs builder.
- Provider stack (server-side, keys never exposed): DeepSeek (if `DEEPSEEK_API_KEY`) → Gemini (`GEMINI_API_KEY`, free tier) → OpenCode Zen (keyless fallback). Vision requires Gemini.
- Free limits: 3 AI replies/day + 1 photo estimate/day (localStorage gated); Lifetime Pass or Pro removes limits.

## Tech
- Express 5 + Stripe Checkout + nodemailer (SMTP receipts/alerts)
- Client-side PDF generation via pdf-lib (zero server compute)
- Free-tier friendly: static assets served by Express, no database

## Local
```bash
npm install
PORT=10000 PUBLIC_BASE_URL=http://localhost:10000 \
STRIPE_SECRET_KEY=... STRIPE_PRICE_SINGLE=... STRIPE_PRICE_PRO=... STRIPE_PRICE_LIFETIME=... \
STRIPE_WEBHOOK_SECRET=... GMAIL_USER=... GMAIL_APP_PASSWORD=... OWNER_EMAIL=... GEMINI_API_KEY=... \
node server.js
```

## Deploy (Render)
Web service, Node runtime, build `npm install --production`, start `node server.js`, health check `/api/healthz`.
Required env: `PUBLIC_BASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_SINGLE`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_LIFETIME`, `STRIPE_WEBHOOK_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `OWNER_EMAIL`. Optional: `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `AI_MODEL`, `ZEN_MODEL`.

## Legal
Templates are general-purpose, informational documents — not legal advice, not affiliated with any court or agency. 14-day refund policy. Payments handled by Stripe; card details never touch this server.
