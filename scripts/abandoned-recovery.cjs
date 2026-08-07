// Abandoned-checkout recovery — emails buyers who started checkout but didn't pay.
// Env: STRIPE_SECRET_KEY, SMTP_USER, SMTP_PASS, ADMIN_EMAIL
const https = require('https');
const path = require('path');

const SK = process.env.STRIPE_SECRET_KEY || '';

function stripe(qs) {
  return new Promise((resolve) => {
    https.get('https://api.stripe.com/v1/' + qs, {
      headers: { Authorization: 'Basic ' + Buffer.from(SK + ':').toString('base64') }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ data: [] }); } });
    }).on('error', () => resolve({ data: [] }));
  });
}

(async () => {
  if (!SK) { console.log('No STRIPE_SECRET_KEY — skipping.'); process.exit(0); }
  const cutoff = Math.floor(Date.now() / 1000) - 48 * 3600;
  const sessions = await stripe('checkout/sessions?limit=100&payment_status=unpaid&created[gte]=' + cutoff);
  const candidates = (sessions.data || []).filter(s => s.customer_email && s.customer_email.includes('@') && s.mode === 'payment');
  console.log('Unpaid sessions (48h):', (sessions.data || []).length, '| with email:', candidates.length);
  if (!candidates.length || !process.env.SMTP_PASS) { console.log('Nothing to recover.'); process.exit(0); }
  const nodemailer = require(path.join(__dirname, '..', 'node_modules', 'nodemailer'));
  const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  const seen = new Set();
  for (const s of candidates) {
    if (seen.has(s.customer_email)) continue;
    seen.add(s.customer_email);
    const amount = ((s.amount_total || 0) / 100).toFixed(2);
    try {
      await t.sendMail({
        from: process.env.SMTP_USER,
        to: s.customer_email,
        subject: 'Your BrainDocs document is ready to unlock',
        text: `Hi! You started unlocking a BrainDocs document ($${amount}) but didn't finish checkout. Your document is still waiting — no account needed, just tap the link below to finish and download your watermark-free PDF:\n\nhttps://braindocs-7qqx.onrender.com/\n\nIf you hit any snag, reply here and I'll help personally.\n\n— BrainDocs (part of the BrainAdvisor family)\n\nUnsubscribe: reply "unsubscribe" and you won't hear from us again.`
      });
      console.log('recovery sent ->', s.customer_email);
      await new Promise(r => setTimeout(r, 30000));
    } catch (e) { console.error('failed ->', s.customer_email, e.message); }
  }
})();
