#!/usr/bin/env node
/* Deterministic CAN-SPAM outreach sender (no AI dependency).
   Usage:
     node outreach/send-batch.cjs                 # dry run: previews what would send
     node outreach/send-batch.cjs --send          # actually sends (rate-limited, capped)
   Input: prospects.csv at repo root or outreach/prospects.csv
   Columns: name,business,niche,city,state,email   (rows without email are skipped)
   Env: SMTP_USER, SMTP_PASS (or .env at /root/Expert advise/.env)
*/
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const SEND = process.argv.includes("--send");
const DAILY_CAP = Number(process.env.OUTREACH_DAILY_CAP || 15);
const ROOT = path.join(__dirname, "..");

function env(k) {
  if (process.env[k]) return process.env[k];
  try {
    const raw = fs.readFileSync("/root/Expert advise/.env", "utf8");
    const m = raw.match(new RegExp(`^${k}=(.+)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch { return ""; }
}

const LINKS = {
  docs: "https://braindocs-7qqx.onrender.com",
  pay: "https://buy.stripe.com/28E8wR9ZR0RR2Yz7e12Ry02",
};

function prefill(niche, city) {
  const slugs = { "mobile mechanic":"estimate-mobile-mechanic", plumber:"estimate-plumber", roofer:"quote-roofer", "lawn care":"invoice-lawn-care", detailer:"estimate-detailer", painter:"estimate-painter", cleaner:"quote-house-cleaner", electrician:"estimate-electrician", handyman:"estimate-handyman", "pressure washing":"estimate-handyman" };
  const s = slugs[niche] || "estimate-handyman";
  const citySlug = (city || "san-antonio").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  return `https://braindocs-7qqx.onrender.com/l/${s}-${citySlug}-tx`;
}

function emailFor(row) {
  const niche = row.niche || "handyman";
  const sample = prefill(niche, row.city);
  return {
    subject: `A free ${niche} quote/invoice builder (30 seconds, no account)`,
    text: `Hi ${row.name || "there"},

Saw your ${niche} business in ${row.city || "San Antonio"}. Hand-typed estimates are the #1 way trades lose jobs — they look sloppy and eat time.

I built a free tool that turns a job into a clean, itemized PDF quote or invoice in 30 seconds, pre-filled with ${niche} line items. I made a sample with your kind of work here:
${sample}

No account, works on your phone, free to use. The $3.99 one-time fee only removes the watermark when you want a client-ready copy: ${LINKS.pay}

If you want your business name and rates baked in, reply and I'll send a custom version free.

Best,
1034jcd@gmail.com
BrainDocs (a BrainAdvisor tool)

P.S. You're receiving this because your business info is publicly listed. Reply "unsubscribe" and I'll remove you immediately — no hard feelings.`,
  };
}

function loadProspects() {
  for (const p of [path.join(ROOT, "prospects.csv"), path.join(ROOT, "outreach", "prospects.csv")]) {
    if (!fs.existsSync(p)) continue;
    const lines = fs.readFileSync(p, "utf8").trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) continue;
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map(l => {
      const c = l.split(",");
      const o = {};
      headers.forEach((h, i) => o[h] = (c[i] || "").trim());
      return o;
    }).filter(r => r.email && r.email.includes("@") && r.status !== "junk");
  }
  return [];
}

function alreadySent(email) {
  const log = path.join(ROOT, "outreach", "sent-log.csv");
  if (!fs.existsSync(log)) return false;
  return fs.readFileSync(log, "utf8").split(/\r?\n/).some(l => l.startsWith(email + ","));
}

(async () => {
  const user = env("SMTP_USER"), pass = env("SMTP_PASS");
  if (!user || !pass) { console.error("SMTP creds missing"); process.exit(1); }
  const rows = loadProspects();
  const toSend = rows.filter(r => !alreadySent(r.email)).slice(0, DAILY_CAP);
  console.log(`Prospects with email: ${rows.length} | to send today (cap ${DAILY_CAP}): ${toSend.length}`);
  if (!toSend.length) { console.log("Nothing to send — add real rows to prospects.csv (name,business,niche,city,state,email)."); return; }
  for (const r of toSend) {
    console.log(`\nTO: ${r.email} (${r.name || r.business || "?"} — ${r.niche || "?"}, ${r.city || "?"})`);
    console.log("SUBJ:", emailFor(r).subject);
    console.log("BODY:", emailFor(r).text.split("\n").slice(0, 4).join(" "), "...");
  }
  if (!SEND) { console.log("\nDRY RUN — pass --send to actually send."); return; }
  const t = nodemailer.createTransport({ host: env("SMTP_HOST") || "smtp.gmail.com", port: Number(env("SMTP_PORT") || 587), secure: false, auth: { user, pass } });
  const logPath = path.join(ROOT, "outreach", "sent-log.csv");
  for (const r of toSend) {
    const m = emailFor(r);
    try {
      const info = await t.sendMail({ from: user, to: r.email, subject: m.subject, text: m.text });
      fs.appendFileSync(logPath, `${r.email},${new Date().toISOString()},${info.messageId}\n`);
      console.log("SENT", r.email, info.messageId);
    } catch (e) {
      console.log("FAIL", r.email, e.message.slice(0, 120));
    }
    await new Promise(res => setTimeout(res, 45000)); // 45s spacing protects deliverability
  }
  console.log("Batch done. Log:", logPath);
})().catch(e => { console.error(e); process.exit(1); });
