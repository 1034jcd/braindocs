import express from "express";
import Stripe from "stripe";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import https from "node:https";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 10000;
const here = path.dirname(fileURLToPath(import.meta.url));

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const priceSingle = process.env.STRIPE_PRICE_SINGLE ?? "";
const pricePro = process.env.STRIPE_PRICE_PRO ?? "";
const priceLifetime = process.env.STRIPE_PRICE_LIFETIME ?? "";
const baseUrl = (process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`).replace(/\/+$/, "");
const ownerEmail = process.env.OWNER_EMAIL ?? "1034jcd@gmail.com";

let stripe = null;
function getStripe() {
  if (!stripe && secretKey) stripe = new Stripe(secretKey);
  return stripe;
}
const isConfigured = Boolean(secretKey && (priceSingle || pricePro || priceLifetime));

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
  if (mode === "lifetime") { price = priceLifetime; isSubscription = false; }
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


// ── AI providers (free stack: DeepSeek key > Gemini key > OpenCode Zen keyless) ──
const geminiKey = process.env.GEMINI_API_KEY ?? "";
const aiModel = process.env.AI_MODEL ?? "gemini-3.5-flash";

function callHTTPS(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(u, { method: "POST", headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on("error", reject);
    req.setTimeout(90000, () => { req.destroy(new Error("AI request timeout")); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function geminiText(systemMsg, userMsg) {
  if (!geminiKey) throw new Error("no gemini key");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`;
  const resp = await callHTTPS(url, { "Content-Type": "application/json" }, {
    system_instruction: { parts: [{ text: systemMsg }] },
    contents: [{ parts: [{ text: userMsg }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  });
  const text = resp.data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text) throw new Error("gemini empty: " + JSON.stringify(resp.data).slice(0, 200));
  return text;
}

async function geminiVision(prompt, mimeType, b64) {
  if (!geminiKey) throw new Error("no gemini key");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${aiModel}:generateContent?key=${encodeURIComponent(geminiKey)}`;
  const resp = await callHTTPS(url, { "Content-Type": "application/json" }, {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: b64 } }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  });
  const text = resp.data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  if (!text) throw new Error("gemini vision empty: " + JSON.stringify(resp.data).slice(0, 200));
  return text;
}

async function deepseekChat(systemMsg, userMsg) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("no deepseek key");
  const resp = await callHTTPS("https://api.deepseek.com/v1/chat/completions", {
    "Content-Type": "application/json",
    Authorization: "Bearer " + key,
  }, {
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }],
    max_tokens: 2048,
    temperature: 0.7,
  });
  const text = resp.data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("deepseek empty: " + JSON.stringify(resp.data).slice(0, 200));
  return text;
}

async function zenChat(systemMsg, userMsg) {
  const zenKey = process.env.OPENCODE_ZEN_API_KEY || "public";
  const resp = await callHTTPS("https://opencode.ai/zen/v1/chat/completions", {
    "Content-Type": "application/json",
    Authorization: "Bearer " + zenKey,
    "User-Agent": "opencode/1.4.3",
    "X-Opencode-Client-Id": Math.random().toString(36).slice(2),
    "X-Opencode-Session-Id": Math.random().toString(36).slice(2),
    "X-Opencode-Request-Id": Math.random().toString(36).slice(2),
  }, {
    model: process.env.ZEN_MODEL || "big-pickle",
    messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }],
    max_tokens: 2048,
    temperature: 0.7,
  });
  const text = resp.data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("zen empty: " + JSON.stringify(resp.data).slice(0, 200));
  return text;
}

async function aiChat(systemMsg, userMsg) {
  const errors = [];
  if (process.env.DEEPSEEK_API_KEY) { try { return await deepseekChat(systemMsg, userMsg); } catch (e) { errors.push("deepseek:" + e.message); } }
  if (geminiKey) { try { return await geminiText(systemMsg, userMsg); } catch (e) { errors.push("gemini:" + e.message); } }
  try { return await zenChat(systemMsg, userMsg); } catch (e) { errors.push("zen:" + e.message); }
  throw new Error("All AI providers failed — " + errors.join(" | "));
}

const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => req.headers["x-forwarded-for"]?.toString() || req.ip || "anon" });

app.get("/api/ai/status", (_req, res) => {
  res.json({
    ok: true,
    providers: {
      deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
      gemini: Boolean(geminiKey),
      opencodeZen: true,
      model: aiModel,
    },
  });
});

app.post("/api/ai/review", aiLimiter, async (req, res) => {
  const { review, businessType } = req.body ?? {};
  if (!review || String(review).trim().length < 10) {
    return res.status(400).json({ ok: false, message: "Paste a customer review (at least 10 characters)." });
  }
  const system = "You are a customer-relations assistant for a small business owner. You write short, genuine, brand-safe replies to online reviews. Never argue, never admit liability, never promise refunds. US English, each reply under 90 words.";
  const user = `Business type: ${String(businessType || "small business")}\n\nCustomer review:\n"""${review}"""\n\nWrite THREE reply variants, each labeled on its own line, separated by a blank line:\n1. Warm & Polite\n2. Professional\n3. SEO-Friendly (natural local keywords, not robotic)`;
  try {
    const raw = await aiChat(system, user);
    const variants = raw.split(/\n\s*\n/).map((v) => v.replace(/^\s*\d\.\s*[^\n]+\n?/i, "").trim()).filter((v) => v.length > 5).slice(0, 3);
    res.json({ ok: true, variants: variants.length ? variants : [raw.trim()] });
  } catch (err) {
    console.error("ai review failed:", err.message);
    res.status(502).json({ ok: false, message: "AI is temporarily unavailable — try again in a minute." });
  }
});

app.post("/api/ai/estimate", aiLimiter, async (req, res) => {
  const { image, mimeType, jobType } = req.body ?? {};
  if (!image || !mimeType || String(image).length < 100) {
    return res.status(400).json({ ok: false, message: "Upload a photo of the job first." });
  }
  const prompt = `You are an experienced contractor's estimator. Look at the uploaded photo and create a fair, itemized bid for: ${String(jobType || "this job")}. Rates in USD, reasonable for Texas, 3-8 line items. Reply with ONLY JSON, no markdown, in this exact shape: {"summary":"one sentence describing the job","items":[{"desc":"line item","qty":1,"rate":99.99}]}`;
  try {
    const raw = await geminiVision(prompt, mimeType, image);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed.items) || !parsed.items.length) throw new Error("no items");
    parsed.items = parsed.items.map((it) => ({ desc: String(it.desc || "Item"), qty: Number(it.qty) || 1, rate: Number(it.rate) || 0 }));
    res.json({ ok: true, estimate: parsed });
  } catch (err) {
    console.error("ai estimate failed:", err.message);
    res.status(502).json({ ok: false, message: "Could not read the photo — try a clearer picture, or try again in a minute." });
  }
});

app.get("/paid", (_req, res) => {
  res.sendFile(path.join(here, "public", "paid.html"));
});

app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(here, "public", "index.html"));
});

app.listen(PORT, () => console.log(`BrainDocs live on ${baseUrl} (port ${PORT})`));
