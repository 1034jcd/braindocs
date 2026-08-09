#!/usr/bin/env node
/* Create (or reuse) shareable Stripe Payment Links for all BrainDocs tiers.
   Usage: node scripts/payment-links.cjs [path-to-.env] */
const fs = require("fs");
const Stripe = require("stripe");

const envPath = process.argv[2] || "/root/Expert advise/.env";
const envRaw = fs.readFileSync(envPath, "utf8");
const get = (k) => {
  const m = envRaw.match(new RegExp(`^${k}=(.+)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
};

const key = get("STRIPE_SECRET_KEY");
if (!key) { console.error("STRIPE_SECRET_KEY not found in " + envPath); process.exit(1); }

const stripe = new Stripe(key);
const TAX_CODE = "txcd_10103001"; // eligible for Managed Payments (digital goods)
const TIERS = {
  single:   { label: "Single Document", priceId: get("STRIPE_PRICE_SINGLE") || "price_1U1ekKPOPXDmUKH9VplAoeGZ" },
  pro:      { label: "Pro Monthly",     priceId: get("STRIPE_PRICE_PRO") || "price_1U1ekLPOPXDmUKH9ZFZ6V7PL" },
  lifetime: { label: "Founder Lifetime", priceId: get("STRIPE_PRICE_LIFETIME") || "price_1U1ekMPOPXDmUKH9zzpSdrwU" },
  business: { label: "Business White-Label", priceId: get("STRIPE_PRICE_BUSINESS") || "price_1U1epTPOPXDmUKH9ra0QoO8U" },
};

(async () => {
  const out = {};
  for (const [tier, cfg] of Object.entries(TIERS)) {
    const price = await stripe.prices.retrieve(cfg.priceId).catch((e) => null);
    if (!price) { console.log(`[${tier}] price missing: ${cfg.priceId}`); continue; }
    const amt = (price.unit_amount ?? 0) / 100;
    const sub = price.type === "recurring" ? ` /${price.recurring.interval}` : " once";
    console.log(`[${tier}] price OK: $${amt}${sub}`);

    const product = await stripe.products.retrieve(price.product);
    if (product.tax_code !== TAX_CODE) {
      await stripe.products.update(product.id, { tax_code: TAX_CODE });
      console.log(`[${tier}] tax_code set on product ${product.id}`);
    }

    const existing = await stripe.paymentLinks.list({ active: true, limit: 100 });
    const found = existing.data.find((pl) => pl.line_items?.[0]?.price === price.id);
    if (found) {
      console.log(`[${tier}] reusing link: ${found.url}`);
      out[tier] = { url: found.url, priceId: price.id, amount: amt };
      continue;
    }
    const pl = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      after_completion: { type: "redirect", redirect: { url: "https://braindocs-7qqx.onrender.com/paid?mode=" + tier } },
    });
    console.log(`[${tier}] created link: ${pl.url}`);
    out[tier] = { url: pl.url, priceId: price.id, amount: amt };
  }
  fs.writeFileSync("/root/braindocs/outreach/payment-links.json", JSON.stringify(out, null, 2) + "\n");
  console.log("\nSaved to outreach/payment-links.json");
})().catch((e) => { console.error(e.message); process.exit(1); });
