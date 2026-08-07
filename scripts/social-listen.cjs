// Social listening — finds high-intent pain-point posts on Reddit and drafts helpful replies with BrainDocs link.
// Writes outreach/listen-<date>.md and emails it to the owner for one-click review (review BEFORE posting).
// Env: GEMINI_API_KEY, SMTP_USER, SMTP_PASS, ADMIN_EMAIL
const fs = require('fs');
const path = require('path');
const https = require('https');

const SK = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.AI_MODEL || 'gemini-3.5-flash';
const ROOT = path.join(__dirname, '..');
const APP_NAME = process.env.APP_NAME || 'BrainDocs';
const APP_LINK = process.env.APP_LINK || 'https://braindocs-7qqx.onrender.com';

const KEYWORDS = ['quote template', 'estimate software', 'invoice app', 'how do I make an invoice', 'estimate sheet', 'free quote generator', 'invoice for small business', 'make an invoice'];
const SUBS = ['smallbusiness', 'Entrepreneur', 'Construction', 'Plumbing', 'MechanicAdvice', 'landscaping', 'freelance', 'sweatystartup'];

function get(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { headers: { 'User-Agent': 'BrainDocs-market-bot/1.0' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j && j.data) resolve(j); else resolve(null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null)); req.setTimeout(20000, () => { req.destroy(); resolve(null); });
  });
}

function gemini(system, user) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 400 } });
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

async function main() {
  if (!SK) { console.error('No GEMINI_API_KEY set.'); process.exit(1); }
  const posts = [];
  const seen = new Set();
  for (const sub of SUBS) {
    for (const kw of KEYWORDS) {
      try {
        const j = await get(`https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(kw)}&restrict_sr=1&sort=new&limit=4`);
        if (!j) continue;
        for (const c of (j.data?.children || [])) {
          const p = c.data;
          if (!p || seen.has(p.id)) continue;
          seen.add(p.id);
          posts.push({ sub, id: p.id, title: p.title, url: 'https://reddit.com' + p.permalink, selftext: (p.selftext || '').slice(0, 500) });
        }
      } catch (e) { /* skip sub/keyword */ }
    }
  }
  console.log('Found', posts.length, 'candidate posts.');
  if (!posts.length) {
    console.log('No Reddit candidates today — generating daily post hooks instead.');
    const systemHooks = `You are the social media manager for ${APP_NAME}. Write 5 short social posts (under 280 characters each) with hooks about the pain of manual paperwork, each ending with the link ${APP_LINK}. Natural, not spammy, no emoji spam.`;
    const linesHooks = ['# Daily post hooks — ' + new Date().toISOString().split('T')[0], ''];
    try {
      const raw = await gemini(systemHooks, 'Write the 5 posts as a numbered list, one per line.');
      linesHooks.push(raw);
    } catch (e) { linesHooks.push('Gemini unavailable: ' + e.message); }
    const outH = path.join(ROOT, 'outreach', 'hooks-' + new Date().toISOString().split('T')[0] + '.md');
    fs.mkdirSync(path.dirname(outH), { recursive: true });
    fs.writeFileSync(outH, linesHooks.join('\n'));
    console.log('Hooks file:', outH);
    const nodemailerH = require(path.join(ROOT, 'node_modules', 'nodemailer'));
    if (process.env.SMTP_USER && process.env.SMTP_PASS && process.env.ADMIN_EMAIL) {
      try {
        const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
        await t.sendMail({ from: process.env.SMTP_USER, to: process.env.ADMIN_EMAIL, subject: '📣 ${APP_NAME} daily post hooks', text: linesHooks.join('\n') });
        console.log('Hooks emailed.');
      } catch (e) { console.error('Email failed:', e.message); }
    }
    process.exit(0);
  }
  const system = `You draft a helpful Reddit reply for a free tool (${APP_NAME}). Rules: never start with "hey", never sound like an ad; first acknowledge their actual problem from the post text; offer the tool as a free option with link ${APP_LINK}; under 90 words; no fake claims.`;
  const lines = ['# Social listening — ' + new Date().toISOString().split('T')[0], ''];
  for (const p of posts.slice(0, 12)) {
    try {
      const reply = await gemini(system, `Post in r/${p.sub}: "${p.title}"\n\n${p.selftext || ''}`);
      lines.push(`## [${p.sub}] ${p.title}`, '', p.url, '', reply, '');
      console.log('✓ drafted reply for', p.title.slice(0, 50));
    } catch (e) { console.error('✗ failed', e.message); }
  }
  const out = path.join(ROOT, 'outreach', 'listen-' + new Date().toISOString().split('T')[0] + '.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, lines.join('\n'));
  console.log('Review file:', out);

  if (process.env.SMTP_USER && process.env.SMTP_PASS && process.env.ADMIN_EMAIL) {
    try {
      const nodemailer = require(path.join(ROOT, 'node_modules', 'nodemailer'));
      const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      await t.sendMail({ from: process.env.SMTP_USER, to: process.env.ADMIN_EMAIL, subject: '🐦 Reddit leads — review before posting', text: lines.join('\n') });
      console.log('Emailed review file to', process.env.ADMIN_EMAIL);
    } catch (e) { console.error('Email failed:', e.message); }
  }
}
main();
