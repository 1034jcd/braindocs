// AI outreach generator — Gemini personalizes cold emails per prospect.
// Default: DRY RUN (writes outreach/review-<date>.md). Use --send to email via Gmail SMTP.
// Usage: node scripts/ai-outreach.cjs [--send]
// Env: GEMINI_API_KEY, (optional SMTP_USER/SMTP_PASS/ADMIN_EMAIL for sending)
const fs = require('fs');
const path = require('path');
const https = require('https');

const SK = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.AI_MODEL || 'gemini-3.5-flash';
const ROOT = path.join(__dirname, '..');
const APP_NAME = process.env.APP_NAME || 'BrainDocs';
const APP_LINK = process.env.APP_LINK || 'https://braindocs-7qqx.onrender.com';
const CSV = process.argv.includes('--csv') ? process.argv[process.argv.indexOf('--csv') + 1] : path.join(ROOT, 'prospects.csv');
const SEND = process.argv.includes('--send');
const DAILY_CAP = Number(process.env.OUTREACH_DAILY_CAP || '20');

function gemini(system, user) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 700 } });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(SK)}`;
    const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { const j = JSON.parse(d); resolve((j.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '').trim()); } catch (e) { reject(e); } });
    });
    req.on('error', reject); req.setTimeout(60000, () => req.destroy(new Error('timeout')));
    req.write(body); req.end();
  });
}

function parseCsv(file) {
  if (!fs.existsSync(file)) { console.error('Missing CSV:', file, '— copy prospects.example.csv to prospects.csv and fill in real leads.'); process.exit(1); }
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(l => {
    const cells = l.split(',');
    const row = {};
    headers.forEach((h, i) => row[h] = (cells[i] || '').trim());
    return row;
  }).filter(r => r.name && !r.name.toLowerCase().startsWith('example'));
}

async function main() {
  if (!SK) { console.error('No GEMINI_API_KEY set.'); process.exit(1); }
  const prospects = parseCsv(CSV);
  console.log(`Loaded ${prospects.length} prospects.`);
  if (!prospects.length) { console.log('No real prospects (all rows look like examples). Copy prospects.example.csv -> prospects.csv and add real leads.'); process.exit(0); }
  const system = `You write short, natural, personalized cold emails for a free-to-try web tool called ${APP_NAME}. Rules: first line must reference the prospect's business/niche/city specifically; be helpful, not salesy; mention it is free to try with a low one-time fee only if they want the watermark off; keep under 110 words; include the link ${APP_LINK}/l/{slug} where slug is the best-matching landing page for their niche (e.g. estimate-mobile-mechanic-san-antonio-tx, quote-plumber-houston-tx, invoice-lawn-care-austin-tx, estimate-detailer-dallas-tx, quote-roofer-el-paso-tx, estimate-painter-san-antonio-tx, invoice-house-cleaner-san-antonio-tx, estimate-handyman-corpus-christi-tx, estimate-electrician-dallas-tx). No fake claims, no guarantees of income.`;
  const lines = ['# AI outreach — ' + new Date().toISOString().split('T')[0], ''];
  const sent = [];
  for (const p of prospects) {
    const user = `Prospect: ${p.name}, ${p.business}, ${p.niche}, ${p.city}, ${p.state}${p.website ? ', ' + p.website : ''}.`;
    try {
      const email = await gemini(system, user);
      lines.push(`## ${p.business} (${p.name} — ${p.city}, ${p.state})`, '', 'To: ' + (p.email || '?'), email, '');
      sent.push({ ...p, email });
      console.log('✓ drafted for', p.business);
    } catch (e) { console.error('✗ failed for', p.business, e.message); }
  }
  const out = path.join(ROOT, 'outreach', 'review-' + new Date().toISOString().split('T')[0] + '.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, lines.join('\n'));
  console.log('Review file:', out);

  if (SEND) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) { console.log('--send requires SMTP_USER/SMTP_PASS. Skipping send.'); process.exit(0); }
    const nodemailer = require(path.join(ROOT, 'node_modules', 'nodemailer'));
    const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    const batch = sent.filter(p => p.email && p.email.includes('@')).slice(0, DAILY_CAP);
    console.log('Sending', batch.length, 'emails (cap ' + DAILY_CAP + '/day).');
    for (const p of batch) {
      const body = p.email + '\n\nYou are receiving this because you are a business owner. Unsubscribe: reply with "unsubscribe" and you will not be contacted again.';
      try {
        await t.sendMail({ from: process.env.SMTP_USER, to: p.email, subject: 'A free tool for ' + p.business, text: body });
        console.log('sent ->', p.email);
        await new Promise(r => setTimeout(r, 45000)); // rate limit for deliverability
      } catch (e) { console.error('send failed ->', p.email, e.message); }
    }
  }
}
main();
