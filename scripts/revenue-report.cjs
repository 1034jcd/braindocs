// BrainDocs daily revenue report — Stripe balance + charges + subscriptions, emailed via SMTP.
// Requires env: STRIPE_SECRET_KEY, SMTP_USER, SMTP_PASS, REPORT_TO.
const https = require('https');
const nodemailer = require('nodemailer');

const SK = process.env.STRIPE_SECRET_KEY || '';
const REPORT_TO = process.env.REPORT_TO || process.env.ADMIN_EMAIL || '';

function stripe(path) {
  return new Promise((resolve) => {
    https.get('https://api.stripe.com/v1/' + path, {
      headers: { Authorization: 'Basic ' + Buffer.from(SK + ':').toString('base64') }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({ error: { message: 'parse failed' } }); } });
    }).on('error', e => resolve({ error: { message: e.message } }));
  });
}

(async () => {
  if (!SK) { console.log('No STRIPE_SECRET_KEY — skipping report.'); process.exit(0); }
  const [bal, charges, subs] = await Promise.all([
    stripe('balance'),
    stripe('charges?limit=100'),
    stripe('subscriptions?limit=100&status=all')
  ]);
  let todayTotal = 0, paid = 0, paidAmount = 0;
  for (const c of (charges.data || [])) {
    if (c.status === 'succeeded') { paid++; paidAmount += c.amount / 100; }
    if ((c.created || 0) > Date.now() / 1000 - 86400) todayTotal += (c.amount || 0) / 100;
  }
  const active = (subs.data || []).filter(s => s.status === 'active').length;
  const avail = (bal.available || []).map(b => `${(b.amount/100).toFixed(2)} ${b.currency.toUpperCase()}`).join(', ') || '0.00 USD';
  const err = (bal.error && bal.error.message) || '';

  const lines = [
    `🧾 BrainDocs daily revenue report`,
    `Available balance: ${avail}`,
    `Charges (succeeded): ${paid} — total $${paidAmount.toFixed(2)}`,
    `Last 24h charges: $${todayTotal.toFixed(2)}`,
    `Active subscriptions: ${active}`,
    `Reported: ${new Date().toISOString()}`
  ];
  console.log(lines.join('\n'));
  if (err) console.log('Stripe note:', err);

  if (!process.env.SMTP_PASS || !REPORT_TO) { console.log('No SMTP/report-to — skipping email.'); process.exit(0); }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'), secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: REPORT_TO,
      subject: `🧾 BrainDocs daily revenue — ${avail}`,
      text: lines.join('\n')
    });
    console.log('Report emailed to', REPORT_TO);
  } catch (e) {
    console.error('Report email failed:', e.message);
  }
})();
