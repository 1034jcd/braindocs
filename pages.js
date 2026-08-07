// ── Programmatic SEO: [Service] + [Niche] + [Location] landing pages ────────
export const LOCATIONS = [
  { city: "San Antonio", state: "TX" }, { city: "Houston", state: "TX" },
  { city: "Austin", state: "TX" }, { city: "Dallas", state: "TX" },
  { city: "Fort Worth", state: "TX" }, { city: "El Paso", state: "TX" },
  { city: "Corpus Christi", state: "TX" }, { city: "Lubbock", state: "TX" },
  { city: "Waco", state: "TX" }, { city: "McAllen", state: "TX" },
  { city: "Amarillo", state: "TX" }, { city: "Arlington", state: "TX" },
  { city: "Plano", state: "TX" }, { city: "Garland", state: "TX" },
  { city: "Miami", state: "FL" }, { city: "Orlando", state: "FL" },
  { city: "Tampa", state: "FL" }, { city: "Los Angeles", state: "CA" },
  { city: "San Diego", state: "CA" }, { city: "Phoenix", state: "AZ" },
  { city: "Las Vegas", state: "NV" }, { city: "Atlanta", state: "GA" },
  { city: "Charlotte", state: "NC" }, { city: "Denver", state: "CO" },
  { city: "Nashville", state: "TN" },
];

export const NICHES = [
  { slug: "mobile-mechanic", label: "Mobile Mechanic", items: [
    { desc: "Mobile service call", qty: 1, rate: 49 }, { desc: "Diagnostic scan", qty: 1, rate: 65 },
    { desc: "Labor (per hour)", qty: 1, rate: 95 }, { desc: "Oil change — parts + oil", qty: 1, rate: 42 },
    { desc: "Brake pads (set) + labor", qty: 1, rate: 165 } ] },
  { slug: "plumber", label: "Plumber", items: [
    { desc: "Service call", qty: 1, rate: 65 }, { desc: "Labor (per hour)", qty: 1, rate: 110 },
    { desc: "Fixture installation", qty: 1, rate: 89 }, { desc: "Water heater repair", qty: 1, rate: 150 } ] },
  { slug: "lawn-care", label: "Lawn Care", items: [
    { desc: "Mowing (per visit)", qty: 1, rate: 45 }, { desc: "Hedge trimming", qty: 1, rate: 60 },
    { desc: "Leaf cleanup", qty: 1, rate: 75 }, { desc: "Fertilizer application", qty: 1, rate: 55 } ] },
  { slug: "detailer", label: "Detailer", items: [
    { desc: "Exterior wash & wax", qty: 1, rate: 89 }, { desc: "Interior detailing", qty: 1, rate: 129 },
    { desc: "Engine bay clean", qty: 1, rate: 45 }, { desc: "Headlight restoration", qty: 1, rate: 49 } ] },
  { slug: "roofer", label: "Roofing Contractor", items: [
    { desc: "Roof inspection", qty: 1, rate: 0 }, { desc: "Shingle replacement (per sq)", qty: 1, rate: 380 },
    { desc: "Leak repair", qty: 1, rate: 220 }, { desc: "Gutter cleaning", qty: 1, rate: 90 } ] },
  { slug: "painter", label: "Painter", items: [
    { desc: "Prep work", qty: 1, rate: 120 }, { desc: "Interior painting (per room)", qty: 1, rate: 350 },
    { desc: "Exterior paint (per sq ft)", qty: 1, rate: 1.75 }, { desc: "Trim & doors", qty: 1, rate: 90 } ] },
  { slug: "house-cleaner", label: "House Cleaner", items: [
    { desc: "Standard clean (per hour)", qty: 1, rate: 35 }, { desc: "Deep clean (per hour)", qty: 1, rate: 45 },
    { desc: "Move-out clean", qty: 1, rate: 199 }, { desc: "Window cleaning", qty: 1, rate: 60 } ] },
  { slug: "handyman", label: "Handyman", items: [
    { desc: "Hourly labor", qty: 1, rate: 65 }, { desc: "Minor repairs (flat)", qty: 1, rate: 85 },
    { desc: "Fixture install", qty: 1, rate: 95 }, { desc: "Trip charge", qty: 1, rate: 35 } ] },
  { slug: "electrician", label: "Electrician", items: [
    { desc: "Service call / trip", qty: 1, rate: 75 }, { desc: "Outlet install", qty: 1, rate: 120 },
    { desc: "Light fixture install", qty: 1, rate: 110 }, { desc: "Panel work (estimate)", qty: 1, rate: 450 } ] },
  { slug: "food-truck", label: "Food Truck", items: [
    { desc: "Catering event (per hour)", qty: 1, rate: 120 }, { desc: "Per-person meal", qty: 1, rate: 15 },
    { desc: "Travel / setup fee", qty: 1, rate: 75 } ] },
];

export const SERVICES = [
  { slug: "estimate", tpl: "quote", label: "Estimate", title: "Estimate Template", h1: "Estimate Template" },
  { slug: "invoice", tpl: "invoice", label: "Invoice", title: "Invoice Template", h1: "Invoice Template" },
  { slug: "quote", tpl: "quote", label: "Quote", title: "Quote Template", h1: "Quote Template" },
];

function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export const PAGES = [];
for (const svc of SERVICES) {
  for (const n of NICHES) {
    for (const loc of LOCATIONS) {
      const slug = `${svc.slug}-${n.slug}-${slugify(loc.city)}-${loc.state.toLowerCase()}`;
      const title = `${n.label} ${svc.title} — ${loc.city}, ${loc.state} | BrainDocs`;
      PAGES.push({ slug, svc, n, loc, title });
    }
  }
}
export function pageUrl(p) { return `https://braindocs-7qqx.onrender.com/l/${p.slug}`; }
