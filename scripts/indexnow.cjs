// Resubmits all pSEO URLs to IndexNow (Bing/Yahoo/DuckDuckGo/ChatGPT) — run weekly.
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const HOST = 'braindocs-7qqx.onrender.com';
const KEY = 'bd7f3a9c2e1d4b5a8f6c0e3d9a2b1c4d';

function urls() {
  const out = execSync('node -e "import(\'./pages.js\').then(m => console.log(JSON.stringify(m.PAGES.map(p => m.pageUrl(p)))))"', { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  return JSON.parse(out);
}

function submit(payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
    const req = https.request('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
    req.setTimeout(90000, () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
    req.write(body); req.end();
  });
}

(async () => {
  const list = urls();
  const payload = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: list };
  const r = await submit(payload);
  console.log('IndexNow status:', r.status, '| urls:', list.length, '|', r.body.slice(0, 120));
  process.exit(r.status === 200 ? 0 : 1);
})();
