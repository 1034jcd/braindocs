#!/usr/bin/env node
/* Remove placeholder/directory emails from prospects.csv. Idempotent. */
const fs = require("fs");
const p = "outreach/prospects.csv";
const ls = fs.readFileSync(p, "utf8").trim().split(/\r?\n/);
const h = ls[0].split(",").map(x => x.trim());
const BAD = /example|name@|test@|domain\.com|@mysa|@expertise|@power\.com|sample@|news@|noreply@|no-reply@/i;
const out = [ls[0]];
for (const l of ls.slice(1)) {
  const c = l.split(","); const o = {};
  h.forEach((k, i) => o[k] = (c[i] || "").trim());
  if (!o.email || !o.email.includes("@")) continue;
  if (BAD.test(o.email)) o.status = "junk";
  out.push(h.map(k => o[k] || "").join(","));
}
fs.writeFileSync(p, out.join("\n") + "\n");
console.log("clean done: " + (out.length - 1) + " rows kept");
