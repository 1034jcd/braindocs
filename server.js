import express from "express";
import Stripe from "stripe";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 10000;
const here = path.dirname(fileURLToPath(import.meta.url));

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const priceSingle = process.env.STRIPE_PRICE_SINGLE ?? "";
const pricePro = process.env.STRIPE_PRICE_PRO ?? "";
const baseUrl = (process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`).replace(/\/+$/, "");
const ownerEmail = process.env.OWNER_EMAIL ?? "1034jcd@gmail.com";

let stripe = null;
function getStripe() {
  if (!stripe && secretKey) stripe = new Stripe(secretKey);
  return stripe;
}
const isConfigured = Boolean(secretKey && priceSingle && pricePro);

app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.static(path.join(here, "public")));

function mailer() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
}

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers["x-forwarded-for"]?.toString() || req.ip || "anon",
});

app.get("/api/healthz", (_req, res) => res.json({ ok: true, service: "braindocs" }));

app.post("/api/stripe/checkout", checkoutLimiter, async (req, res) => {
  const { mode, email } = req.body ?? {};
  if (!isConfigured) return res.status(500).json({ ok: false, message: "Payments are not configured yet." });

  let price = priceSingle;
  let isSubscription = false;
  if (mode === "pro") { price = pricePro; isSubscription = true; }
  if (!price) return res.status(500).json({ ok: false, message: "No price configured for this option." });

  try {
    const srv = getStripe();
    const session = await srv.checkout.sessions.create({
      mode: isSubscription ? "subscription" : "payment",
      line_items: [{ price, quantity: 1 }],
      success_url: `${baseUrl}/paid?session_id={CHECKOUT_SESSION_ID}&mode=${mode ?? "single"}`,
      cancel_url: `${baseUrl}/`,
      customer_email: email && email.includes("@") ? email.trim() : undefined,
      metadata: { app: "braindocs", mode: mode ?? "single", email: email ?? "" },
      managed_payments: { enabled: false },
    });
    res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("checkout error", String(err));
    res.status(500).json({ ok: false, message: "Could not start checkout. Try again." });
  }
});

app.get("/api/verify", async (req, res) => {
  const sessionId = String(req.query.session_id ?? "");
  if (!sessionId || !secretKey) return res.json({ ok: false, paid: false });
  try {
    const srv = getStripe();
    if (!srv) return res.json({ ok: true, paid: false });
    const session = await srv.checkout.sessions.retrieve(sessionId);
    res.json({ ok: true, paid: session.payment_status === "paid", mode: session.metadata?.mode ?? "single" });
  } catch {
    res.json({ ok: true, paid: false });
  }
});

app.post("/api/stripe/webhook", async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!webhookSecret || !signature || !req.rawBody) return res.status(400).json({ error: "missing" });
  let event;
  try {
    const srv = getStripe();
    if (!srv) return res.status(400).json({ error: "missing" });
    event = srv.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("webhook verify failed", String(err));
    return res.status(400).json({ error: "invalid signature" });
  }
  console.log("webhook event", event.type);
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const amount = (s.amount_total ?? 0) / 100;
    console.log("payment completed", s.id, amount, s.customer_email);
    const m = mailer();
    if (m) {
      try {
        await m.sendMail({
          from: `"BrainDocs" <${process.env.GMAIL_USER}>`,
          to: ownerEmail,
          subject: `🧾 BrainDocs — New payment $${amount.toFixed(2)}`,
          text: `Payment completed!\nSession: ${s.id}\nAmount: $${amount.toFixed(2)}\nEmail: ${s.customer_email ?? "n/a"}\nMode: ${s.metadata?.mode ?? "n/a"}`,
        });
      } catch (e) { console.error("notify email failed", e.message); }
    }
  }
  res.json({ received: true });
});

app.get("/paid", (_req, res) => {
  res.sendFile(path.join(here, "public", "paid.html"));
});

app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(here, "public", "index.html"));
});

app.listen(PORT, () => console.log(`BrainDocs live on ${baseUrl} (port ${PORT})`));
