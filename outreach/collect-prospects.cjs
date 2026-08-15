#!/usr/bin/env node
/* Automated prospect collector: bookmobilemechanic.com directories ->
   business websites -> contact emails. Appends new rows to prospects.csv.
   Usage: node outreach/collect-prospects.cjs [--dry]  */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname);
const CSV = path.join(OUT, "prospects.csv");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";
const NICHES = { "mobile-mechanic": "mobile mechanic" };
const CITIES = ["san-antonio", "austin", "houston"];

async function get(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.text();
    } catch { /* retry */ }
    await new Promise(res => setTimeout(res, 1500));
  }
  return "";
}

function emailsFrom(html) {
  const out = new Set();
  for (const m of html.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    const e = m[0].toLowerCase().replace(/\.(png|jpg|jpeg|gif|webp)$/, "");
    if (/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/.test(e)) continue;
    if (/example\.|sentry\.|wixpress\.|godaddy\.|schema\.org|@2x/.test(e)) continue;
    out.add(e);
  }
  return [...out];
}

function loadExisting() {
  if (!fs.existsSync(CSV)) return [];
  const lines = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map(l => {
    const c = l.split(",");
    return { name: c[0] || "", business: c[1] || "", niche: c[2] || "", city: c[3] || "", state: c[4] || "", source: c[5] || "", link: c[6] || "", contact: c[7] || "", email: c[8] || "", status: c[9] || "" };
  });
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function main() {
  const dry = process.argv.includes("--dry");
  const existing = loadExisting();
  const seenEmails = new Set(existing.map(r => r.email.toLowerCase()).filter(Boolean));
  const seenSites = new Set(existing.map(r => r.link).filter(l => l.includes("//")));

  const leads = []; // {name, website, city}
  for (const city of CITIES) {
    const dir = await get(`https://bookmobilemechanic.com/states/texas/${city}`);
    const re = new RegExp("\\/states\\/texas\\/" + city + "\\/([a-z0-9-]+)", "g");
    const slugs = [...new Set([...dir.matchAll(re)].map(m => m[1]))];
    for (const slug of slugs) {
      const page = await get(`https://bookmobilemechanic.com/states/texas/${city}/${slug}`);
      const title = (page.match(/<title>(.*?)<\/title>/s) || [])[1]?.replace(/<[^>]+>/g, "").replace(/\|.*/, "").trim() || slug.replace(/-/g, " ");
      const sites = [...new Set((page.match(/https?:\/\/(?:www\.)?([a-z0-9-]+\.(?:com|net|org|biz|us|co))/gi) || []).map(u => u.toLowerCase()))]
        .filter(s => !/bookmobilemechanic|googletagmanager|schema|w3\.org|tailwindcss/.test(s));
      if (sites.length) leads.push({ name: title, website: "https://" + sites[0].replace(/^https?:\/\//, ""), city: city.replace(/-/g, " ") });
      await sleep(400);
    }
    console.log(`[dir] ${city}: ${slugs.length} businesses, ${leads.length} with sites so far`);
    await sleep(800);
  }

  const found = [];
  for (const lead of leads) {
    const site = lead.website;
    if (seenSites.has(site)) continue;
    let emails = [];
    for (const p of ["", "/contact", "/contact-us", "/contactus", "/about", "/about-us"]) {
      const html = await get(site + p);
      emails = emailsFrom(html);
      if (emails.length) break;
      await sleep(300);
    }
    if (emails.length) {
      const email = emails[0];
      if (!seenEmails.has(email)) {
        const row = { name: lead.name, business: lead.name, niche: "mobile mechanic", city: lead.city, state: "TX", source: "bookmobilemechanic", link: site, contact: email, email, status: "new" };
        found.push(row);
        seenEmails.add(email);
        seenSites.add(site);
        console.log(`[lead] ${lead.name} | ${email} | ${site}`);
        if (!dry) fs.appendFileSync(CSV, `\n${[row.name,row.business,row.niche,row.city,row.state,row.source,row.link,row.contact,row.email,row.status,""].join(",")}\n`);
      }
    } else {
      console.log(`[skip] no email on ${site}`);
    }
    await sleep(400);
  }

  // --- DDG niche search: broader small-business coverage ---
  const NICHES = ["plumber", "roofer", "lawn care", "painter", "electrician", "handyman", "house cleaner", "pressure washing", "auto detailer"];
  const seenDdg = new Set();
  for (const city of ["San Antonio", "Austin", "Houston"]) {
    for (const niche of NICHES) {
      const q = encodeURIComponent(`${niche} ${city} TX website`);
      const html = await get(`https://html.duckduckgo.com/html/?q=${q}`);
      const urls = [...new Set([...html.matchAll(/uddg=([^"&]+)/g)].map(m => { try { return decodeURIComponent(m[1]); } catch { return ""; } }))]
        .filter(u => /^https?:\/\//.test(u) && !/yelp|facebook|instagram|linkedin|duckduckgo|w3\.org|yelp\.com|bbb\.org|yellowpages|mapquest|superpages|angieslist|thumbtack|homeadvisor|bbb/.test(u));
      for (const u of urls) {
        let dom = "";
        try { dom = new URL(u).hostname.replace(/^www\./, ""); } catch { continue; }
        if (seenDdg.has(dom) || seenSites.has(u) || seenEmails.has(dom)) continue;
        seenDdg.add(dom);
        let emails = [];
        for (const p2 of ["", "/contact", "/contact-us", "/contactus", "/about", "/about-us"]) {
          const h = await get("https://www." + dom + p2);
          emails = emailsFrom(h);
          if (emails.length) break;
          await sleep(250);
        }
        if (emails.length) {
          const email = emails[0];
          if (!seenEmails.has(email)) {
            const row = { name: "", business: dom, niche: niche, city: city, state: "TX", source: "ddg", link: "https://" + dom, contact: email, email, status: "new" };
            found.push(row); seenEmails.add(email); seenSites.add(u);
            console.log(`[ddg-lead] ${dom} | ${email} | ${niche} | ${city}`);
            if (!dry) fs.appendFileSync(CSV, `\n${[row.name,row.business,row.niche,row.city,row.state,row.source,row.link,row.contact,row.email,row.status,""].join(",")}\n`);
          }
        }
        await sleep(300);
      }
      await sleep(700);
    }
  }
  console.log(`\nTOTAL NEW PROSPECTS: ${found.length} (saved incrementally)`);
}

main().catch(e => { console.error("ERR", e.message); process.exit(1); });
