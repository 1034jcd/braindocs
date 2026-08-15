#!/usr/bin/env node
/* CAN-SPAM follow-up (one, ~3 days after first send, different angle). */
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const SEND = process.argv.includes("--send");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "outreach");

function env(k) {
  if (process.env[k]) return process.env[k];
  try {
    const raw = fs.readFileSync("/root/Expert advise/.env", "utf8");
    const m = raw.match(new RegExp("^" + k + "=(.+)$", "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch { return ""; }
}

function loadCsv(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(l => {
    const c = l.split(",");
    const o = {};
    headers.forEach((h, i) => o[h] = (c[i] || "").trim());
    return o;
  }).filter(r => r.email && r.email.includes("@"));
}

const prospects = loadCsv(path.join(OUT, "prospects.csv"));
const sent = new Set(fs.existsSync(path.join(OUT, "sent-log.csv")) ? fs.readFileSync(path.join(OUT, "sent-log.csv"), "utf8").split(/\r?\n/).filter(Boolean).map(l => l.split(",")[0]) : []);
const done = new Set(fs.existsSync(path.join(OUT, "followup-log.csv")) ? fs.readFileSync(path.join(OUT, "followup-log.csv"), "utf8").split(/\r?\n/).filter(Boolean).map(l => l.split(",")[0]) : []);

function followupFor(row) {
  const name = row.name || row.business || "there";
  const city = row.city || "San Antonio";
  const niche = row.niche || "business";
  const link = "https://braindocs-7qqx.onrender.com/l/estimate-mobile-mechanic-san-antonio-tx";
  return {
    subject: "Re: your " + city + " " + niche + " estimate - quick nudge",
    text: "Hi " + name + ",\n\n" +
      "Quick follow-up on the free " + niche + " estimate builder I sent last week - it's ready to use right now:\n" + link + "\n\n" +
      "Two things that make it worth 30 seconds:\n" +
      "1. It turns a job into a clean itemized PDF quote in under a minute, pre-filled with " + niche + " line items.\n" +
      "2. No account, works on your phone, and the watermark removal is a one-time $3.99 - no subscription.\n\n" +
      "If you reply with your business name and rates, I'll send you a custom version with your branding baked in - free.\n\n" +
      "Best,\nJohn (BrainAdvisor / BrainDocs)\n1034jcd@gmail.com\n\n" +
      "P.S. Your contact came from your public business listing. Reply \"unsubscribe\" and I won't email again."
  };
}

const toSend = prospects.filter(r => sent.has(r.email) && !done.has(r.email));
console.log("Prospects: " + prospects.length + " | sent before: " + sent.size + " | follow-ups due: " + toSend.length);
for (const r of toSend) {
  console.log("\nTO: " + r.email + " (" + (r.name || r.business) + ")");
  console.log("SUBJ:", followupFor(r).subject);
  console.log("BODY:", followupFor(r).text.split("\n").slice(0, 4).join(" "), "...");
}
if (!toSend.length) { console.log("No follow-ups due."); process.exit(0); }
if (!SEND) { console.log("\nDRY RUN - pass --send to send."); process.exit(0); }

(async () => {
  const user = env("SMTP_USER"), pass = env("SMTP_PASS");
  if (!user || !pass) { console.error("SMTP creds missing"); process.exit(1); }
  const t = nodemailer.createTransport({ host: env("SMTP_HOST") || "smtp.gmail.com", port: Number(env("SMTP_PORT") || 587), secure: false, auth: { user, pass } });
  for (const r of toSend) {
    const m = followupFor(r);
    try {
      const info = await t.sendMail({ from: user, to: r.email, subject: m.subject, text: m.text });
      fs.appendFileSync(path.join(OUT, "followup-log.csv"), r.email + "," + new Date().toISOString() + "," + info.messageId + "\n");
      console.log("SENT", r.email, info.messageId);
    } catch (e) {
      console.log("FAIL", r.email, e.message.slice(0, 120));
    }
    await new Promise(res => setTimeout(res, 45000));
  }
  console.log("Follow-up batch done. Log:", path.join(OUT, "followup-log.csv"));
})().catch(e => { console.error(e); process.exit(1); });
