// Security leak scanner — greps tracked files for hardcoded secrets.
// Usage: node scripts/security-scan.cjs   (set SMTP_USER/SMTP_PASS/ADMIN_EMAIL to email results)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const PATTERNS = [
  [/sk_live_[A-Za-z0-9_]{10,}/g, 'Stripe live secret key'],
  [/pk_live_[A-Za-z0-9_]{10,}/g, 'Stripe live publishable key'],
  [/whsec_[A-Za-z0-9]{10,}/g, 'Stripe webhook secret'],
  [/AKIA[0-9A-Z]{16}/g, 'AWS access key'],
  [/\bAIza[0-9A-Za-z\-_]{20,}\b/g, 'Google API key'],
  [/\bAQ\.[A-Za-z0-9\-_]{20,}\b/g, 'Google OAuth token'],
  [/ghp_[A-Za-z0-9]{20,}/g, 'GitHub token'],
  [/Bearer [A-Za-z0-9\-_.]{20,}/g, 'Bearer token'],
  [/(password|passwd|secret|api[_-]?key)\s*[=:]\s*["']?[^"'\s]{8,}/gi, 'Possible credential assignment'],
];

function trackedFiles() {
  try {
    return execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch { return []; }
}

async function main() {
  const findings = [];
  for (const f of trackedFiles()) {
    if (/\.(png|jpe?g|gif|svg|ico|woff2?|ttf|lock|min\.js)$/i.test(f)) continue;
    let src;
    try { src = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { continue; }
    const srcLines = src.split("\n");
    for (const [re, label] of PATTERNS) {
      for (const m of src.matchAll(re)) {
        if (label === "Possible credential assignment") {
          const line = srcLines.find((l) => l.includes(m[0].slice(0, 8))) || "";
          if (line.includes("process.env") || line.includes("??") || line.includes("||")) continue;
        }
        findings.push({ file: f, label, match: String(m[0]).slice(0, 14) + "…" });
      }
    }
  }
  const unique = [];
  for (const f of findings) if (!unique.some(x => x.file === f.file && x.label === f.label && x.match === f.match)) unique.push(f);

  const lines = ['# Security scan — ' + new Date().toISOString(), '', unique.length ? 'Found ' + unique.length + ' potential leak(s):' : '✅ No obvious secrets in tracked files.', ''];
  for (const f of unique) lines.push(`- ${f.file}: ${f.label} (${f.match})`);
  console.log(lines.join('\n'));

  if (unique.length && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.ADMIN_EMAIL) {
    try {
      const nodemailer = require(path.join(ROOT, 'node_modules', 'nodemailer'));
      const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      await t.sendMail({ from: process.env.SMTP_USER, to: process.env.ADMIN_EMAIL, subject: '⚠️ SECURITY SCAN: potential leaks in repo', text: lines.join('\n') });
      console.log('Alert emailed.');
    } catch (e) { console.error('Email failed:', e.message); }
  }
  process.exit(unique.length ? 1 : 0);
}
main();
