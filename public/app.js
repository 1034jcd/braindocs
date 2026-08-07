const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

const COLORS = {
  ink: rgb(0.06, 0.1, 0.16),
  accent: rgb(0, 0.9, 1),
  gold: rgb(0.83, 0.68, 0.45),
  gray: rgb(0.45, 0.5, 0.58),
  red: rgb(0.85, 0.2, 0.2),
};

let currentTemplate = "invoice";

function fmtMoney(n) {
  return "$" + Number(n || 0).toFixed(2);
}

function readItems() {
  return [...document.querySelectorAll(".item-row")].map((row) => ({
    desc: row.querySelector(".i-desc").value || "Item",
    qty: Number(row.querySelector(".i-qty").value || 0),
    rate: Number(row.querySelector(".i-rate").value || 0),
  })).filter((i) => i.qty > 0 || i.rate > 0);
}

function updateTotal() {
  const total = readItems().reduce((s, i) => s + i.qty * i.rate, 0);
  document.getElementById("total").textContent = fmtMoney(total);
}

function setTemplate(tpl) {
  currentTemplate = tpl;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tpl === tpl));
  document.body.classList.toggle("tpl-notice", tpl === "notice");
  const num = document.getElementById("f_num");
  const date = document.getElementById("f_date");
  const due = document.getElementById("f_due");
  const today = new Date().toISOString().split("T")[0];
  if (!date.value) date.value = today;
  if (tpl === "invoice") {
    num.value = num.value || "INV-0001";
    document.getElementById("lbl_client").innerHTML = 'Client / company <input id="f_client" required>';
    document.getElementById("lbl_num").innerHTML = "Invoice # <input id=\"f_num\" value=\"INV-0001\">";
    document.getElementById("lbl_due").innerHTML = "Due date <input id=\"f_due\" type=\"date\">";
    if (!due.value) { const d = new Date(); d.setDate(d.getDate() + 15); due.value = d.toISOString().split("T")[0]; }
  } else if (tpl === "quote") {
    num.value = num.value || "Q-0001";
    document.getElementById("lbl_client").innerHTML = 'Client / company <input id="f_client" required>';
    document.getElementById("lbl_num").innerHTML = "Quote # <input id=\"f_num\" value=\"Q-0001\">";
    document.getElementById("lbl_due").innerHTML = "Valid until <input id=\"f_due\" type=\"date\">";
    if (!due.value) { const d = new Date(); d.setDate(d.getDate() + 30); due.value = d.toISOString().split("T")[0]; }
  } else {
    document.getElementById("lbl_client").innerHTML = 'Job / project name <input id="f_client" placeholder="e.g., Roof repair">';
    document.getElementById("lbl_num").innerHTML = "Notice # <input id=\"f_num\" value=\"NTC-0001\">";
    document.getElementById("lbl_due").innerHTML = "Date <input id=\"f_due\" type=\"date\">";
  }
  document.getElementById("f_num").value = num.value;
  document.getElementById("f_date").value = date.value;
  document.getElementById("f_due").value = due.value;
}

// ── PDF drawing helpers ─────────────────────────────────────────────────────
function wrap(text, font, size, maxWidth) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLines(page, text, font, size, x, y, maxWidth, lineGap) {
  for (const line of wrap(text, font, size, maxWidth)) {
    page.drawText(line, { x, y, size, font, color: COLORS.ink });
    y -= size + (lineGap || 4);
  }
  return y;
}

function drawItems(page, font, bold, items, startY) {
  let y = startY;
  const colX = [50, 330, 430, 520];
  page.drawText("Description", { x: colX[0], y, size: 9, font: bold, color: COLORS.gray });
  page.drawText("Qty", { x: colX[1], y, size: 9, font: bold, color: COLORS.gray });
  page.drawText("Rate", { x: colX[2], y, size: 9, font: bold, color: COLORS.gray });
  page.drawText("Amount", { x: colX[3], y, size: 9, font: bold, color: COLORS.gray });
  y -= 16;
  page.drawLine({ start: { x: 48, y: y + 6 }, end: { x: 560, y: y + 6 }, thickness: 1, color: COLORS.gray });
  for (const it of items) {
    if (y < 70) { y = startY; page.drawText("(continued on next page)", { x: 50, y, size: 8, font, color: COLORS.gray }); }
    page.drawText(String(it.desc).slice(0, 48), { x: colX[0], y, size: 10, font, color: COLORS.ink });
    page.drawText(String(it.qty), { x: colX[1], y, size: 10, font, color: COLORS.ink });
    page.drawText(fmtMoney(it.rate), { x: colX[2], y, size: 10, font, color: COLORS.ink });
    page.drawText(fmtMoney(it.qty * it.rate), { x: colX[3], y, size: 10, font, color: COLORS.ink });
    y -= 20;
  }
  return y - 6;
}

function watermark(page, font, unlocked, type) {
  if (unlocked) {
    page.drawText(type === "pro" ? "PRO" : "PAID", {
      x: 210, y: 360, size: 90, font, color: COLORS.green, opacity: 0.08, rotate: degrees(35),
    });
    return;
  }
  page.drawText("PREVIEW", {
    x: 170, y: 340, size: 96, font, color: COLORS.red, opacity: 0.16, rotate: degrees(35),
  });
  page.drawText("Watermark-free download — $2.99 or go Pro", {
    x: 50, y: 40, size: 9, font, color: COLORS.gray,
  });
}

// ── Build the PDF ───────────────────────────────────────────────────────────
async function generatePDF() {
  const status = document.getElementById("status");
  status.textContent = "Building PDF…";
  status.className = "status";
  try {
    const unlock = getUnlock();
    const biz = document.getElementById("f_biz").value || "Your Business";
    const email = document.getElementById("f_email").value || "";
    const phone = document.getElementById("f_phone").value || "";
    const client = document.getElementById("f_client").value || "";
    const num = document.getElementById("f_num").value || "DOC-0001";
    const date = document.getElementById("f_date").value || "";
    const due = document.getElementById("f_due").value || "";
    const notes = document.getElementById("f_notes").value || "";
    const items = currentTemplate === "notice" ? [] : readItems();
    const total = items.reduce((s, i) => s + i.qty * i.rate, 0);

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([612, 792]);
    const W = 612;

    // header band
    page.drawRectangle({ x: 0, y: 740, width: W, height: 52, color: COLORS.accent });
    page.drawText("BrainDocs", { x: 50, y: 758, size: 18, font: bold, color: rgb(0.02, 0.13, 0.18) });
    page.drawText("by BrainAdvisor", { x: 50, y: 744, size: 8, font, color: rgb(0.02, 0.13, 0.18) });

    let y = 690;
    if (currentTemplate === "notice") {
      y = 660;
      const tenant = document.getElementById("f_tenant").value || "Tenant";
      const addr = document.getElementById("f_addr").value || "";
      const rent = document.getElementById("f_rent").value || "";
      const rentdue = document.getElementById("f_rentdue").value || "";
      page.drawText("TEXAS THREE-DAY NOTICE TO PAY RENT OR VACATE", { x: 50, y: 700, size: 14, font: bold, color: COLORS.red });
      page.drawLine({ start: { x: 48, y: 690 }, end: { x: 560, y: 690 }, thickness: 1.5, color: COLORS.ink });
      page.drawText("TO:", { x: 50, y: y, size: 10, font: bold, color: COLORS.ink }); y -= 16;
      y = drawLines(page, tenant, font, 10, 50, y, 480);
      y -= 10;
      page.drawText("RE: " + (addr || "Property address"), { x: 50, y: y, size: 10, font, color: COLORS.ink }); y -= 22;
      const body = "You are hereby notified that you owe " + fmtMoney(rent) +
        " in unpaid rent for the above property, due on " + (rentdue || date) +
        ". Unless the full amount is paid within three (3) days from the date this notice is served, your lease will terminate and eviction proceedings may be filed against you.";
      y = drawLines(page, body, font, 11, 50, y, 500, 6);
      y -= 14;
      page.drawText("Dated: " + date, { x: 50, y: y, size: 10, font, color: COLORS.ink }); y -= 16;
      page.drawText("Landlord / Agent: " + biz, { x: 50, y: y, size: 10, font, color: COLORS.ink }); y -= 16;
      page.drawText("Contact: " + [email, phone].filter(Boolean).join("  |  "), { x: 50, y: y, size: 10, font, color: COLORS.ink });
      page.drawText("Note: This is a general-purpose template, not legal advice. Local rules may vary.", { x: 50, y: 58, size: 8, font, color: COLORS.gray });
    } else {
      const title = currentTemplate === "invoice" ? "INVOICE" : "QUOTE / ESTIMATE";
      page.drawText(title, { x: 50, y: y, size: 24, font: bold, color: COLORS.ink }); y -= 8;
      page.drawText(num + "    Date: " + date + (due ? "    " + (currentTemplate === "invoice" ? "Due" : "Valid until") + ": " + due : ""), { x: 50, y: y, size: 9, font, color: COLORS.gray }); y -= 24;
      page.drawText("FROM", { x: 50, y: y, size: 9, font: bold, color: COLORS.gray }); y -= 14;
      y = drawLines(page, biz, bold, 11, 50, y, 240); y -= 6;
      y = drawLines(page, [email, phone].filter(Boolean).join("  "), font, 9, 50, y, 240); y -= 12;
      page.drawText("TO", { x: 330, y: y, size: 9, font: bold, color: COLORS.gray }); y -= 14;
      y = drawLines(page, client, font, 11, 330, y, 240); y -= 20;
      const end = drawItems(page, font, bold, items, y);
      page.drawLine({ start: { x: 48, y: end }, end: { x: 560, y: end }, thickness: 1, color: COLORS.ink });
      page.drawText("TOTAL", { x: 430, y: end - 16, size: 12, font: bold, color: COLORS.ink });
      page.drawText(fmtMoney(total), { x: 520, y: end - 16, size: 12, font: bold, color: COLORS.green, textAlign: "right" });
      if (notes) {
        const ny = end - 44;
        page.drawText("Notes", { x: 50, y: ny, size: 9, font: bold, color: COLORS.gray });
        drawLines(page, notes, font, 9, 50, ny - 14, 500);
      }
      page.drawText("Generated with BrainDocs by BrainAdvisor — brainadvisor.onrender.com", { x: 50, y: 58, size: 8, font, color: COLORS.gray });
    }

    watermark(page, font, unlock && (unlock.type === "pro" || unlock.type === "lifetime" || unlock.downloadsLeft > 0), unlock?.type);

    const bytes = await doc.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (num || "braindocs") + ".pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);

    if (unlock && unlock.type === "single") {
      unlock.downloadsLeft = (unlock.downloadsLeft || 1) - 1;
      if (unlock.downloadsLeft <= 0) localStorage.removeItem("braindocs_unlock");
      else localStorage.setItem("braindocs_unlock", JSON.stringify(unlock));
    }

    status.textContent = "PDF downloaded" + (isUnlocked() ? "" : " (watermarked — remove it for $2.99)");
    refreshUnlockUI();
  } catch (err) {
    console.error(err);
    status.textContent = "Could not build PDF — please try again.";
    status.className = "status err";
  }
}

// ── Unlock state ────────────────────────────────────────────────────────────
function getUnlock() {
  try { return JSON.parse(localStorage.getItem("braindocs_unlock") || "null"); } catch { return null; }
}
function isUnlocked() {
  const u = getUnlock();
  return Boolean(u && (u.type === "pro" || u.type === "lifetime" || u.downloadsLeft > 0));
}
function refreshUnlockUI() {
  const u = getUnlock();
  const badge = document.createElement("div");
  const existing = document.getElementById("unlock-badge");
  if (existing) existing.remove();
  if (u) {
    badge.id = "unlock-badge";
    badge.style.cssText = "position:fixed;bottom:14px;right:14px;z-index:99;background:#04202e;color:#00e5ff;border:1px solid #00e5ff;border-radius:999px;padding:8px 14px;font-size:0.8rem;font-weight:700;";
    badge.textContent = u.type === "pro" ? "⚡ Pro — unlimited PDFs" : u.type === "lifetime" ? "👑 Lifetime Pass — unlimited" : "🧾 " + u.downloadsLeft + " download(s) left";
    document.body.appendChild(badge);
  }
}

async function startCheckout(mode) {
  const email = document.getElementById("f_email").value || undefined;
  const btn = document.getElementById(mode === "single" ? "buy-single" : "buy-pro");
  const old = btn.textContent;
  btn.textContent = "Opening secure checkout…";
  btn.disabled = true;
  try {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, email }),
    });
    const data = await res.json();
    if (data.url) { window.location.href = data.url; return; }
    throw new Error(data.message || "Checkout failed");
  } catch (err) {
    const status = document.getElementById("status");
    status.textContent = err.message || "Checkout failed. Try again.";
    status.className = "status err";
  } finally {
    btn.textContent = old;
    btn.disabled = false;
  }
}


// ── Niche presets (hyper-niche positioning) ─────────────────────────────────
const PRESETS = {
  generic: {
    label: "Generic / other",
    items: [{ desc: "Labor / service", qty: 1, rate: 100.0 }],
  },
  mechanic: {
    label: "Mobile auto mechanic",
    items: [
      { desc: "Mobile service call", qty: 1, rate: 49.0 },
      { desc: "Diagnostic scan", qty: 1, rate: 65.0 },
      { desc: "Labor (per hour)", qty: 1, rate: 95.0 },
      { desc: "Oil change — parts + oil", qty: 1, rate: 42.0 },
      { desc: "Brake pads (set) + labor", qty: 1, rate: 165.0 },
    ],
  },
  plumber: {
    label: "Independent plumber",
    items: [
      { desc: "Service call", qty: 1, rate: 65.0 },
      { desc: "Labor (per hour)", qty: 1, rate: 110.0 },
      { desc: "Fixture installation", qty: 1, rate: 89.0 },
      { desc: "Water heater repair", qty: 1, rate: 150.0 },
      { desc: "Parts & materials (at cost)", qty: 1, rate: 0.0 },
    ],
  },
};

function loadPreset(name) {
  const p = PRESETS[name] || PRESETS.generic;
  const rows = document.getElementById("items");
  rows.innerHTML = "";
  p.items.forEach((it) => addItemRow(it.desc, it.qty, it.rate));
  document.getElementById("preset").value = name;
  updateTotal();
}

function addItemRow(desc, qty, rate) {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = '<input class="i-desc" placeholder="Description"><input class="i-qty" type="number" min="0" value="1"><input class="i-rate" type="number" min="0" step="0.01" value="0"><button type="button" class="remove-item">✕</button>';
  row.querySelector(".i-desc").value = desc || "";
  row.querySelector(".i-qty").value = qty ?? 1;
  row.querySelector(".i-rate").value = rate ?? 0;
  row.querySelector(".remove-item").addEventListener("click", () => { row.remove(); updateTotal(); });
  document.getElementById("items").appendChild(row);
}


// ── State: autosave, share links, live preview ──────────────────────────────
function collectState() {
  const g = (id) => document.getElementById(id)?.value || "";
  return {
    tpl: currentTemplate,
    preset: g("preset"),
    biz: g("f_biz"), email: g("f_email"), phone: g("f_phone"),
    client: g("f_client"), num: g("f_num"), date: g("f_date"), due: g("f_due"),
    notes: g("f_notes"), items: readItems(),
    tenant: g("f_tenant"), addr: g("f_addr"), rent: g("f_rent"), rentdue: g("f_rentdue"),
  };
}

function hydrate(st) {
  if (!st || typeof st !== "object") return;
  setTemplate(st.tpl === "notice" ? "notice" : (st.tpl === "quote" ? "quote" : "invoice"));
  const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
  set("preset", st.preset || "generic");
  set("f_biz", st.biz); set("f_email", st.email); set("f_phone", st.phone);
  set("f_client", st.client); set("f_num", st.num); set("f_date", st.date); set("f_due", st.due);
  set("f_notes", st.notes);
  set("f_tenant", st.tenant); set("f_addr", st.addr); set("f_rent", st.rent); set("f_rentdue", st.rentdue);
  const rows = document.getElementById("items");
  rows.innerHTML = "";
  (Array.isArray(st.items) && st.items.length ? st.items : [{ desc: "Labor / service", qty: 1, rate: 100 }])
    .forEach((it) => addItemRow(it.desc, it.qty, it.rate));
  updateTotal();
  renderPreview();
}

function saveDraft() {
  try { localStorage.setItem("braindocs_draft", JSON.stringify(collectState())); } catch (e) {}
}

function renderPreview() {
  const pv = document.getElementById("preview");
  if (!pv) return;
  const st = collectState();
  const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const row = (it) => "<tr><td>" + esc(it.desc) + "</td><td>" + Number(it.qty || 0) + "</td><td>" + fmtMoney(it.rate) + "</td><td>" + fmtMoney(it.qty * it.rate) + "</td></tr>";
  let html = "";
  if (st.tpl === "notice") {
    html = "<div class='pv-head'><span>BrainDocs</span><span class='pv-brand'>by BrainAdvisor</span></div>"
      + "<h4 class='pv-title pv-red'>TEXAS THREE-DAY NOTICE TO PAY RENT OR VACATE</h4>"
      + "<p><strong>TO:</strong> " + esc(st.tenant || "Tenant") + "</p>"
      + "<p><strong>RE:</strong> " + esc(st.addr || "Property address") + "</p>"
      + "<p>You are hereby notified that you owe " + fmtMoney(st.rent) + " in unpaid rent for the above property, due on " + esc(st.rentdue || st.date || "—") + ". Unless the full amount is paid within three (3) days from the date this notice is served, your lease will terminate and eviction proceedings may be filed against you.</p>"
      + "<p><strong>Dated:</strong> " + esc(st.date) + "<br><strong>Landlord / Agent:</strong> " + esc(st.biz) + "</p>";
  } else {
    const title = st.tpl === "invoice" ? "INVOICE" : "QUOTE / ESTIMATE";
    const meta = [esc(st.num), "Date: " + esc(st.date), st.due ? (st.tpl === "invoice" ? "Due: " : "Valid until: ") + esc(st.due) : ""].filter(Boolean).join("   ·   ");
    html = "<div class='pv-head'><span>BrainDocs</span><span class='pv-brand'>by BrainAdvisor</span></div>"
      + "<h4 class='pv-title'>" + title + "</h4><p class='pv-meta'>" + meta + "</p>"
      + "<div class='pv-parties'><div><p class='pv-k'>FROM</p><p>" + esc(st.biz) + "</p><p class='pv-muted'>" + esc(st.email) + "  " + esc(st.phone) + "</p></div>"
      + "<div><p class='pv-k'>TO</p><p>" + esc(st.client) + "</p></div></div>"
      + "<table class='pv-table'><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>"
      + st.items.map(row).join("") + "</tbody></table>"
      + "<p class='pv-total'>TOTAL <span>" + fmtMoney(st.items.reduce((s2, i) => s2 + i.qty * i.rate, 0)) + "</span></p>"
      + (st.notes ? "<p class='pv-k'>Notes</p><p>" + esc(st.notes) + "</p>" : "");
  }
  pv.innerHTML = html + "<p class='pv-foot'>Generated with BrainDocs by BrainAdvisor — brainadvisor.onrender.com</p>";
}

function buildShareLink() {
  try {
    const data = btoa(unescape(encodeURIComponent(JSON.stringify(collectState()))));
    return location.origin + location.pathname + "#doc=" + data;
  } catch (e) { return location.href; }
}

function copyShareLink() {
  const link = buildShareLink();
  const done = () => {
    const toast = document.getElementById("toast");
    toast.textContent = "🔗 Link copied — send it to a client or colleague!";
    toast.hidden = false;
    setTimeout(() => { toast.hidden = true; }, 2600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(done).catch(() => { prompt("Copy this link:", link); done(); });
  } else {
    prompt("Copy this link:", link);
    done();
  }
}

function restoreFromHashOrDraft() {
  let shared = null;
  try {
    const m = location.hash.match(/#doc=([^&]+)/);
    if (m) shared = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
  } catch (e) {}
  if (shared) {
    hydrate(shared);
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  } else {
    let draft = null;
    try { draft = JSON.parse(localStorage.getItem("braindocs_draft") || "null"); } catch (e) {}
    if (draft && document.getElementById("f_biz")) hydrate(draft);
  }
}

// ── Wire up ─────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach((b) =>
  b.addEventListener("click", () => setTemplate(b.dataset.tpl)));
document.getElementById("add-item").addEventListener("click", () => { addItemRow("", 1, 0); updateTotal(); });
document.getElementById("preset").addEventListener("change", (e) => loadPreset(e.target.value));
document.querySelectorAll(".item-row .remove-item").forEach((b) =>
  b.addEventListener("click", () => { b.closest(".item-row").remove(); updateTotal(); }));
document.querySelectorAll("#items input").forEach((i) => i.addEventListener("input", updateTotal));
document.getElementById("doc-form").addEventListener("input", () => { updateTotal(); renderPreview(); saveDraft(); });
document.getElementById("doc-form").addEventListener("submit", (e) => { e.preventDefault(); generatePDF(); });
document.getElementById("share").addEventListener("click", copyShareLink);
document.getElementById("buy-single").addEventListener("click", () => startCheckout("single"));
document.getElementById("buy-pro").addEventListener("click", () => startCheckout("pro"));

setTemplate("invoice");
updateTotal();
renderPreview();
restoreFromHashOrDraft();
refreshUnlockUI();
