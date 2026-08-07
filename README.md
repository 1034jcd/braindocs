# BrainDocs — by BrainAdvisor

Professional documents in seconds. Invoices, quotes/estimates, and Texas landlord notices (3-Day Notice). Fill a form, download a clean PDF. No designer, no lawyer, no hassle.

- **Free** — all 3 templates, watermarked PDF
- **Single** — $2.99 one-time, one watermark-free PDF
- **Pro** — $9/mo, unlimited watermark-free PDFs, cancel anytime

Part of the **BrainAdvisor** family of apps → https://brainadvisor.onrender.com

## Tech
- Express 5 + Stripe Checkout + nodemailer (SMTP receipts/alerts)
- Client-side PDF generation via pdf-lib (zero server compute)
- Free-tier friendly: static assets served by Express, no database

## Local
```bash
npm install
PORT=10000 PUBLIC_BASE_URL=http://localhost:10000 \
STRIPE_SECRET_KEY=... STRIPE_PRICE_SINGLE=... STRIPE_PRICE_PRO=... \
STRIPE_WEBHOOK_SECRET=... GMAIL_USER=... GMAIL_APP_PASSWORD=... OWNER_EMAIL=... \
node server.js
```

## Deploy (Render)
Web service, Node runtime, build `npm install --production`, start `node server.js`, health check `/api/healthz`.
Required env: `PUBLIC_BASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_SINGLE`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `OWNER_EMAIL`.

## Legal
Templates are general-purpose, informational documents — not legal advice, not affiliated with any court or agency. 14-day refund policy. Payments handled by Stripe; card details never touch this server.
