#!/usr/bin/env node
/* World prospect collector: trades businesses in cities across the globe.
   Safe: per-city caps, marketplace blocklist, country column, incremental saves.
   Usage: node outreach/collect-world.cjs [--city "London" ...] [--max 120]
*/
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "prospects.csv");
const UA = "BrainAdvisorBot/1.0 (+contact: 1034jcd@gmail.com; https://1034jcd.github.io/brainadvisor-hub/)";
const NICHES = ["mobile mechanic", "plumber", "roofer", "lawn care", "painter", "electrician", "handyman", "house cleaner", "pressure washing", "auto detailer", "hvac", "pest control", "locksmith", "mover", "landscaper", "tree service", "fencing contractor", "concrete contractor", "solar installer", "glass repair"];
const CITIES = [
  ["New York","US"],["Los Angeles","US"],["Chicago","US"],["Houston","US"],["Phoenix","US"],["Philadelphia","US"],["San Antonio","US"],["San Diego","US"],["Dallas","US"],["Austin","US"],["Miami","US"],["Atlanta","US"],["Seattle","US"],["Denver","US"],["Boston","US"],["Las Vegas","US"],
  ["Portland","US"],["Nashville","US"],["Charlotte","US"],["Tampa","US"],["Orlando","US"],["Raleigh","US"],["Salt Lake City","US"],["Kansas City","US"],["Columbus","US"],["Toronto","CA"],["Vancouver","CA"],["Montreal","CA"],["Calgary","CA"],["Ottawa","CA"],["Edmonton","CA"],["London","GB"],
  ["Manchester","GB"],["Birmingham","GB"],["Leeds","GB"],["Glasgow","GB"],["Liverpool","GB"],["Bristol","GB"],["Dublin","IE"],["Sydney","AU"],["Melbourne","AU"],["Brisbane","AU"],["Perth","AU"],["Adelaide","AU"],["Auckland","NZ"],["Berlin","DE"],["Munich","DE"],["Frankfurt","DE"],
  ["Hamburg","DE"],["Paris","FR"],["Lyon","FR"],["Madrid","ES"],["Barcelona","ES"],["Rome","IT"],["Milan","IT"],["Amsterdam","NL"],["Brussels","BE"],["Lisbon","PT"],["Zurich","CH"],["Vienna","AT"],["Stockholm","SE"],["Copenhagen","DK"],["Oslo","NO"],["Helsinki","FI"],
  ["Warsaw","PL"],["Prague","CZ"],["Athens","GR"],["Mexico City","MX"],["Guadalajara","MX"],["Monterrey","MX"],["São Paulo","BR"],["Rio de Janeiro","BR"],["Buenos Aires","AR"],["Bogotá","CO"],["Lima","PE"],["Santiago","CL"],["Medellín","CO"],["Quito","EC"],["Montevideo","UY"],["Tokyo","JP"],
  ["Osaka","JP"],["Seoul","KR"],["Singapore","SG"],["Hong Kong","HK"],["Taipei","TW"],["Bangkok","TH"],["Manila","PH"],["Jakarta","ID"],["Kuala Lumpur","MY"],["Mumbai","IN"],["Delhi","IN"],["Bangalore","IN"],["Hyderabad","IN"],["Chennai","IN"],["Dubai","AE"],["Abu Dhabi","AE"],
  ["Tel Aviv","IL"],["Istanbul","TR"],["Karachi","PK"],["Lahore","PK"],["Ho Chi Minh City","VN"],["Hanoi","VN"],["Shanghai","CN"],["Beijing","CN"],["Shenzhen","CN"],["Guangzhou","CN"],["Johannesburg","ZA"],["Cape Town","ZA"],["Nairobi","KE"],["Lagos","NG"],["Accra","GH"],["Cairo","EG"],
  ["Casablanca","MA"],["Riyadh","SA"],["Doha","QA"],["Kuwait City","KW"],["Amman","JO"],["San Francisco","US"],["Washington DC","US"],["Detroit","US"],["Minneapolis","US"],["Pittsburgh","US"],["Cincinnati","US"],["Oklahoma City","US"],["New Orleans","US"],["Louisville","US"],["Milwaukee","US"],["Albuquerque","US"],
  ["El Paso","US"],["Fresno","US"],["Sacramento","US"],["San Jose","US"],["St. Louis","US"],["Baltimore","US"],["Richmond","US"],["Tucson","US"],["Memphis","US"],["Omaha","US"],["Jacksonville","US"],["Edinburgh","GB"],["Cardiff","GB"],["Belfast","GB"],["Nottingham","GB"],["Sheffield","GB"],
  ["Newcastle","GB"],["Leicester","GB"],["Cork","IE"],["Valencia","ES"],["Seville","ES"],["Marseille","FR"],["Toulouse","FR"],["Naples","IT"],["Turin","IT"],["Dusseldorf","DE"],["Cologne","DE"],["Stuttgart","DE"],["Krakow","PL"],["Bucharest","RO"],["Sofia","BG"],["Zagreb","HR"],
  ["Belgrade","RS"],["Riga","LV"],["Vilnius","LT"],["Tallinn","EE"],["Reykjavik","IS"],["Luxembourg","LU"],["Pune","IN"],["Ahmedabad","IN"],["Kolkata","IN"],["Colombo","LK"],["Dhaka","BD"],["Kathmandu","NP"],["Islamabad","PK"],["Tehran","IR"],["Muscat","OM"],["Manama","BH"],
  ["Dammam","SA"],["Jeddah","SA"],["Marrakech","MA"],["Tunis","TN"],["Algiers","DZ"],["Khartoum","SD"],["Addis Ababa","ET"],["Dar es Salaam","TZ"],["Kampala","UG"],["Lusaka","ZM"],["Harare","ZW"],["Windhoek","NA"],["Gaborone","BW"],["Maputo","MZ"],["Port Louis","MU"],["Brasilia","BR"],
  ["Porto Alegre","BR"],["Curitiba","BR"],["Belo Horizonte","BR"],["Fortaleza","BR"],["Salvador","BR"],["Recife","BR"],["Panama City","PA"],["San Jose","CR"],["Guatemala City","GT"],["San Salvador","SV"],["Tegucigalpa","HN"],["Managua","NI"],["Santo Domingo","DO"],["San Juan","PR"],["Kingston","JM"],["Port of Spain","TT"],
  ["Guayaquil","EC"],["Asuncion","PY"],["La Paz","BO"],["Cochabamba","BO"],["Wellington","NZ"],["Christchurch","NZ"],["Port Moresby","PG"],["Surabaya","ID"],["Bandung","ID"],["Medan","ID"],["Phnom Penh","KH"],["Vientiane","LA"],["Yangon","MM"],["Chittagong","BD"]
];
const BLOCK = /yelp|facebook|instagram|linkedin|thumbtack|homeadvisor|angieslist|yellowpages|mapquest|superpages|bbb\.org|airtasker|care\.com|handyman\.com|tidy\.com|thumbtack|angie|nextdoor|trustpilot|consumeraffairs|expertise\.com|mysanantonio|statesman\.com|wrench\.com|yourmechanic|bookmobilemechanic|fyi\.group/i;
const args = process.argv.slice(2);
const cityArg = args.indexOf("--city"); const cities = cityArg >= 0 ? args.slice(cityArg + 1).filter(a => !a.startsWith("--")).map(c => [c, "XX"]) : CITIES;
const maxArg = args.indexOf("--max"); const MAX_TOTAL = maxArg >= 0 ? Number(args[maxArg + 1]) : 2000;

const robotsCache = new Map();
async function robotsAllow(host) {
  try {
    const u = new URL(host.startsWith("http") ? host : "https://" + host);
    const key = u.hostname;
    if (robotsCache.has(key)) return robotsCache.get(key);
    let allow = true;
    try {
      const r = await fetch(u.origin + "/robots.txt", { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const txt = (await r.text()).slice(0, 100000);
        const lines = txt.split(/\r?\n/);
        let inUa = false;
        for (const raw of lines) {
          const line = raw.trim();
          const [k, ...v] = line.split(":");
          const val = (v.join(":").trim() || "").toLowerCase();
          if (/^user-agent$/i.test(k)) inUa = val.includes("*") || val.includes("brainadvisorbot");
          else if (/^disallow$/i.test(k) && inUa && val === "/") { allow = false; break; }
        }
      }
    } catch { /* no robots.txt = allowed */ }
    robotsCache.set(key, allow);
    return allow;
  } catch { return true; }
}
const lastHit = new Map();
async function polite(url) {
  try {
    const u = new URL(url);
    const k = u.hostname;
    const wait = Math.max(0, (lastHit.get(k) || 0) + 1400 - Date.now());
    if (wait) await new Promise(r => setTimeout(r, wait));
    lastHit.set(k, Date.now());
  } catch {}
  await new Promise(r => setTimeout(r, 500 + Math.random() * 400)); // global jitter
}
async function get(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    await polite(url);
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
      if (r.status === 429) {
        const retry = Number(r.headers.get("retry-after") || "30") * 1000;
        await new Promise(res => setTimeout(res, Math.min(retry, 60000)));
        continue;
      }
      if (r.ok) { const b = await r.arrayBuffer(); return Buffer.from(b).toString("utf8").slice(0, 2 * 1024 * 1024); }
    } catch {}
    await new Promise(res => setTimeout(res, 1500));
  }
  return "";
}
function emailsFrom(html) {
  const out = new Set();
  for (const m of html.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    const e = m[0].toLowerCase();
    if (/(example|name@|test@|domain\.com|sample@|your@|user@|you@|@2x|\.png|\.jpg|\.webp|noreply|no-reply|news@|admin@|webmaster@|support@|care\.com|@mysa|@expertise|@power\.com|stderr\.)/.test(e)) continue;
    out.add(e);
  }
  return [...out];
}
function loadExisting() {
  if (!fs.existsSync(OUT)) return [];
  const ls = fs.readFileSync(OUT, "utf8").trim().split(/\r?\n/).filter(Boolean);
  if (ls.length < 2) return [];
  const h = ls[0].split(",").map(x => x.trim());
  return ls.slice(1).map(l => { const c = l.split(","); const o = {}; h.forEach((k, i) => o[k] = (c[i] || "").trim()); return o; });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const STATE = path.join(__dirname, "world-state.json");
function loadState() { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { ci: 0, ni: 0 }; } }
function saveState(ci, ni) { try { fs.writeFileSync(STATE, JSON.stringify({ ci, ni })); } catch {} }

async function main() {
  const dry = process.argv.includes("--dry");
  const resume = process.argv.includes("--resume");
  const existing = loadExisting();
  const seenEmails = new Set(existing.map(r => (r.email || "").toLowerCase()).filter(Boolean));
  const seenSites = new Set(existing.map(r => r.link).filter(l => l && l.includes("//")));
  let total = 0;
  console.log(`Cities: ${cities.length} | cap ${MAX_TOTAL} | existing rows ${existing.length}`);
  const st = resume ? loadState() : { ci: 0, ni: 0 };
  console.log(`resume: ${resume} from city#${st.ci} niche#${st.ni}`);
  for (let ci = 0; ci < cities.length; ci++) {
    const [city, country] = cities[ci];
    for (let ni = 0; ni < NICHES.length; ni++) {
      if (ci < st.ci || (ci === st.ci && ni < st.ni)) continue;
      const niche = NICHES[ni];
      if (total >= MAX_TOTAL) break;
      const q = encodeURIComponent(`${niche} ${city} website contact`);
      const html = await get(`https://html.duckduckgo.com/html/?q=${q}`);
      const urls = [...new Set([...html.matchAll(/uddg=([^"&]+)/g)].map(m => { try { return decodeURIComponent(m[1]); } catch { return ""; } }))]
        .filter(u => /^https?:\/\//.test(u) && !BLOCK.test(u));
      for (const u of urls.slice(0, 6)) {
        if (total >= MAX_TOTAL) break;
        let dom = ""; try { dom = new URL(u).hostname.replace(/^www\./, ""); } catch { continue; }
        if (seenSites.has(u) || seenSites.has("https://" + dom)) continue;
        if (!(await robotsAllow(dom))) { console.log(`[robots] skip ${dom}`); continue; }
        let emails = [];
        for (const p of ["", "/contact", "/contact-us", "/about"]) {
          const h = await get("https://" + dom + p);
          emails = emailsFrom(h);
          if (emails.length) break;
          await sleep(200);
        }
        if (emails.length) {
          const email = emails[0].toLowerCase();
          if (!seenEmails.has(email)) {
            const row = { name: "", business: dom, niche, city, state: country === "US" ? "TX" : "", country, source: "ddg-world", link: "https://" + dom, contact: email, email, status: "new", notes: "" };
            seenEmails.add(email); seenSites.add(u); total++;
            console.log(`[lead] ${dom} | ${email} | ${niche} | ${city}, ${country}`);
            if (!dry) fs.appendFileSync(OUT, `\n${[row.name,row.business,row.niche,row.city,row.state,row.country,row.source,row.link,row.contact,row.email,row.status,row.notes].join(",")}\n`);
          }
        }
        await sleep(250);
      }
      await sleep(400);
    }
    saveState(ci + 1, 0);
    console.log(`[city] ${city}: done (${total} total)`);
  }
  saveState(0, 0);
  console.log(`TOTAL NEW: ${total}`);
}
main().catch(e => { console.error("ERR", e.message); process.exit(1); });
