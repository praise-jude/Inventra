import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const DAY = 24 * 60 * 60 * 1000;
function atDaysAgo(days: number, extraHours = 0): string {
  return new Date(Date.now() - days * DAY - extraHours * 60 * 60 * 1000).toISOString();
}
function monthsAgoStart(n: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1));
  return d.toISOString().slice(0, 10);
}

async function must<T>(promise: PromiseLike<{ data: T; error: unknown }>, label: string): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    console.error(`Failed: ${label}`, error);
    throw error;
  }
  return data;
}

async function main() {
  console.log("Seeding Stockwell demo data for FreshMart Co. …");

  const avaPassword = `Fresh${crypto.randomBytes(6).toString("base64url")}!2`;

  // ---------------------------------------------------------------------
  // Ava Chen (owner) — the handle_new_user trigger creates her org.
  // ---------------------------------------------------------------------
  const { data: avaUser, error: avaErr } = await admin.auth.admin.createUser({
    email: "ava@freshmart.co",
    password: avaPassword,
    email_confirm: true,
    user_metadata: { first_name: "Ava", last_name: "Chen" },
  });
  if (avaErr) throw avaErr;
  const avaId = avaUser.user!.id;

  const { data: avaProfile } = await admin.from("profiles").select("org_id").eq("id", avaId).single();
  const orgId = (avaProfile as { org_id: string }).org_id;
  console.log(`Org created: ${orgId}`);

  await admin
    .from("organizations")
    .update({
      name: "FreshMart Co.",
      currency: "USD",
      timezone: "America/New_York",
      tax_rate: 8.25,
      support_email: "hello@freshmart.co",
      plan: "growth",
      trial_ends_at: atDaysAgo(-6),
    })
    .eq("id", orgId);

  // Design's exact notification defaults differ from the schema default.
  await admin
    .from("notification_settings")
    .update({ low_stock: true, out_of_stock: true, expiring_products: false, new_purchase_orders: true, weekly_digest: true })
    .eq("org_id", orgId);

  await admin.from("integrations").update({ status: "connected", connected_at: atDaysAgo(90) }).eq("org_id", orgId).in("provider", ["stripe", "quickbooks", "webhooks"]);

  // ---------------------------------------------------------------------
  // Remaining team members join Ava's org via the invited-member trigger path.
  // ---------------------------------------------------------------------
  const teammates = [
    { first: "Marco", last: "Rossi", email: "marco@freshmart.co", role: "warehouse", status: "active" as const },
    { first: "Priya", last: "Shah", email: "priya@freshmart.co", role: "manager", status: "active" as const },
    { first: "Lin", last: "Wu", email: "lin@freshmart.co", role: "cashier", status: "active" as const },
    { first: "Diego", last: "Alvarez", email: "diego@freshmart.co", role: "admin", status: "invited" as const },
  ];
  const teamIds: Record<string, string> = { ava: avaId };
  for (const t of teammates) {
    const { data: u, error } = await admin.auth.admin.createUser({
      email: t.email,
      password: crypto.randomBytes(12).toString("base64url"),
      email_confirm: t.status === "active",
      user_metadata: { first_name: t.first, last_name: t.last, org_id: orgId, role: t.role },
    });
    if (error) throw error;
    teamIds[t.first.toLowerCase()] = u.user!.id;
    if (t.status === "active") {
      await admin.from("profiles").update({ status: "active", last_active_at: atDaysAgo(0, Math.random() * 8) }).eq("id", u.user!.id);
    }
  }
  await admin.from("profiles").update({ last_active_at: atDaysAgo(0, 0) }).eq("id", avaId);
  console.log("Team seeded.");

  // ---------------------------------------------------------------------
  // Warehouses
  // ---------------------------------------------------------------------
  const warehouseDefs = [
    { name: "WH-1 · Downtown", address: "40 Market St", manager: teamIds.priya, capacity: 5000 },
    { name: "WH-2 · Riverside", address: "12 Dock Rd", manager: teamIds.marco, capacity: 4000 },
    { name: "WH-3 · Cold Store", address: "5 Frost Ln", manager: teamIds.diego, capacity: 3000 },
  ];
  const warehouses = await must(
    admin
      .from("warehouses")
      .insert(warehouseDefs.map((w) => ({ org_id: orgId, name: w.name, address: w.address, manager_profile_id: w.manager, capacity: w.capacity })))
      .select("id, name"),
    "insert warehouses",
  );
  const whId = (name: string) => (warehouses as { id: string; name: string }[]).find((w) => w.name === name)!.id;

  // ---------------------------------------------------------------------
  // Categories & suppliers
  // ---------------------------------------------------------------------
  const categoryDefs = [
    { name: "Dairy", emoji: "🥛" },
    { name: "Bakery", emoji: "🍞" },
    { name: "Produce", emoji: "🥬" },
    { name: "Beverages", emoji: "🥤" },
    { name: "Pantry", emoji: "🥫" },
    { name: "Frozen", emoji: "❄️" },
  ];
  const categories = await must(
    admin.from("categories").insert(categoryDefs.map((c) => ({ ...c, org_id: orgId }))).select("id, name"),
    "insert categories",
  );
  const catId = (name: string) => (categories as { id: string; name: string }[]).find((c) => c.name === name)!.id;

  const supplierNames = [
    "Meadowbrook Dairy", "HappyHen Farms", "Stone Oven Bakery", "Dole Foods", "RoastLab Co.",
    "Olympus Dairy", "SunValley Produce", "Golden Fields", "IceCrop Frozen", "Highland Creamery",
  ];
  const suppliers = await must(
    admin.from("suppliers").insert(supplierNames.map((name) => ({ org_id: orgId, name }))).select("id, name"),
    "insert suppliers",
  );
  const supId = (name: string) => (suppliers as { id: string; name: string }[]).find((s) => s.name === name)!.id;

  // ---------------------------------------------------------------------
  // Products — matches the design's exact catalog.
  // ---------------------------------------------------------------------
  interface ProductDef {
    sku: string; name: string; category: string; emoji: string; brand: string;
    cost: number; price: number; reorder: number; target: number; expiryDays: number;
    supplier: string; warehouse: string; unit: string;
    variants?: { name: string; suffix: string; qtyShare: number }[];
  }
  const productDefs: ProductDef[] = [
    { sku: "MLK-001", name: "Organic Whole Milk 1L", category: "Dairy", emoji: "🥛", brand: "Meadowbrook", cost: 1.2, price: 2.49, reorder: 120, target: 412, expiryDays: 15, supplier: "Meadowbrook Dairy", warehouse: "WH-1 · Downtown", unit: "each", variants: [{ name: "Standard", suffix: "STD", qtyShare: 0.6 }, { name: "Family pack", suffix: "FAM", qtyShare: 0.4 }] },
    { sku: "EGG-012", name: "Free-Range Eggs (12pk)", category: "Dairy", emoji: "🥚", brand: "HappyHen", cost: 1.9, price: 2.9, reorder: 100, target: 88, expiryDays: 19, supplier: "HappyHen Farms", warehouse: "WH-1 · Downtown", unit: "pack" },
    { sku: "BRD-004", name: "Sourdough Loaf", category: "Bakery", emoji: "🍞", brand: "Stone Oven", cost: 1.1, price: 2.5, reorder: 60, target: 0, expiryDays: 3, supplier: "Stone Oven Bakery", warehouse: "WH-2 · Riverside", unit: "each" },
    { sku: "FRT-021", name: "Bananas (per kg)", category: "Produce", emoji: "🍌", brand: "Dole", cost: 0.55, price: 0.9, reorder: 200, target: 640, expiryDays: 8, supplier: "Dole Foods", warehouse: "WH-3 · Cold Store", unit: "kg" },
    { sku: "BEV-088", name: "Cold Brew Coffee 1L", category: "Beverages", emoji: "☕", brand: "RoastLab", cost: 1.4, price: 2.7, reorder: 80, target: 196, expiryDays: 60, supplier: "RoastLab Co.", warehouse: "WH-1 · Downtown", unit: "each", variants: [{ name: "Original · 1L", suffix: "OR", qtyShare: 0.5 }, { name: "Oat Milk · 1L", suffix: "OM", qtyShare: 0.32 }, { name: "Decaf · 1L", suffix: "DC", qtyShare: 0.18 }] },
    { sku: "DRY-033", name: "Greek Yogurt 500g", category: "Dairy", emoji: "🍨", brand: "Olympus", cost: 1.05, price: 2.2, reorder: 90, target: 54, expiryDays: 12, supplier: "Olympus Dairy", warehouse: "WH-2 · Riverside", unit: "each", variants: [{ name: "Standard", suffix: "STD", qtyShare: 0.6 }, { name: "Family pack", suffix: "FAM", qtyShare: 0.4 }] },
    { sku: "PRD-009", name: "Roma Tomatoes (kg)", category: "Produce", emoji: "🍅", brand: "SunValley", cost: 0.8, price: 1.6, reorder: 120, target: 305, expiryDays: 6, supplier: "SunValley Produce", warehouse: "WH-3 · Cold Store", unit: "kg" },
    { sku: "PAN-052", name: "Basmati Rice 5kg", category: "Pantry", emoji: "🍚", brand: "Golden Fields", cost: 4.2, price: 7.8, reorder: 40, target: 130, expiryDays: 260, supplier: "Golden Fields", warehouse: "WH-1 · Downtown", unit: "bag", variants: [{ name: "Standard", suffix: "STD", qtyShare: 0.6 }, { name: "Family pack", suffix: "FAM", qtyShare: 0.4 }] },
    { sku: "FRZ-070", name: "Frozen Peas 1kg", category: "Frozen", emoji: "🫛", brand: "IceCrop", cost: 1.3, price: 2.4, reorder: 70, target: 212, expiryDays: 160, supplier: "IceCrop Frozen", warehouse: "WH-2 · Riverside", unit: "bag" },
    { sku: "CHS-018", name: "Cheddar Cheese 250g", category: "Dairy", emoji: "🧀", brand: "Highland", cost: 1.75, price: 3.3, reorder: 60, target: 41, expiryDays: 30, supplier: "Highland Creamery", warehouse: "WH-1 · Downtown", unit: "each", variants: [{ name: "Standard", suffix: "STD", qtyShare: 0.6 }, { name: "Family pack", suffix: "FAM", qtyShare: 0.4 }] },
  ];

  const products = await must(
    admin
      .from("products")
      .insert(
        productDefs.map((p) => ({
          org_id: orgId,
          category_id: catId(p.category),
          warehouse_id: whId(p.warehouse),
          supplier_id: supId(p.supplier),
          name: p.name,
          description: `${p.name} from ${p.supplier}.`,
          emoji: p.emoji,
          brand: p.brand,
          sku: p.sku,
          unit: p.unit,
          cost_price: p.cost,
          sell_price: p.price,
          reorder_level: p.reorder,
          qty_on_hand: 0,
          expiry_date: new Date(Date.now() + p.expiryDays * DAY).toISOString().slice(0, 10),
          batch_number: `B${p.sku.replace(/-/g, "")}`,
        })),
      )
      .select("id, sku"),
    "insert products",
  );
  const prodId = (sku: string) => (products as { id: string; sku: string }[]).find((p) => p.sku === sku)!.id;

  for (const p of productDefs) {
    if (!p.variants) continue;
    await must(
      admin.from("product_variants").insert(
        p.variants.map((v) => ({
          org_id: orgId,
          product_id: prodId(p.sku),
          name: v.name,
          sku_suffix: v.suffix,
          qty_on_hand: Math.round(p.target * v.qtyShare),
        })),
      ),
      `insert variants for ${p.sku}`,
    );
  }
  console.log("Products & variants seeded.");

  // ---------------------------------------------------------------------
  // Stock movements — a real ledger. Each product gets a large historical
  // "received" baseline plus recent sale/adjustment/transfer/return/expired
  // rows; the DB trigger applies every row to qty_on_hand as it's inserted,
  // so the baseline is solved for so the final total lands on `target`.
  // ---------------------------------------------------------------------
  const TOP_SELLER_UNITS: Record<string, number> = {
    "MLK-001": 1284, "EGG-012": 980, "BRD-004": 864, "FRT-021": 2110, "BEV-088": 642,
  };

  function salesSpread(
    totalUnits: number,
    events: number,
    maxDaysAgo: number,
    priceAtSale: number,
    productId: string,
    warehouseId: string,
    baseDaysAgo = 0,
  ): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = [];
    let remaining = totalUnits;
    for (let i = 0; i < events; i++) {
      const isLast = i === events - 1;
      const qty = isLast ? remaining : Math.max(1, Math.round((totalUnits / events) * (0.7 + 0.6 * ((i * 37) % 5) / 4)));
      remaining -= qty;
      const daysAgo = Math.round((maxDaysAgo / events) * i + (i % 3));
      rows.push({
        org_id: orgId,
        product_id: productId,
        warehouse_id: warehouseId,
        type: "sale",
        qty_delta: -qty,
        unit_price: priceAtSale,
        reason: `POS sale`,
        created_by: teamIds.lin,
        created_at: atDaysAgo(baseDaysAgo + Math.min(daysAgo, maxDaysAgo), (i * 3) % 20),
      });
    }
    return rows;
  }

  const allMovements: Record<string, unknown>[] = [];
  for (const p of productDefs) {
    const pid = prodId(p.sku);
    const wid = whId(p.warehouse);
    const topUnits = TOP_SELLER_UNITS[p.sku];

    const recentSales = topUnits
      ? salesSpread(topUnits, 9, 29, p.price, pid, wid)
      : salesSpread(Math.round(p.target * 0.6), 4, 29, p.price, pid, wid);
    const priorSales = topUnits ? salesSpread(Math.round(topUnits * 0.86), 8, 29, p.price, pid, wid, 30) : [];

    const flavor: Record<string, unknown>[] = [];
    if (p.sku === "CHS-018") {
      flavor.push({ org_id: orgId, product_id: pid, warehouse_id: wid, type: "adjustment", qty_delta: -8, unit_price: null, reason: "Damaged in transit", created_by: teamIds.priya, created_at: atDaysAgo(1, 6) });
    }
    if (p.sku === "FRZ-070") {
      flavor.push({ org_id: orgId, product_id: pid, warehouse_id: wid, type: "transfer", qty_delta: -60, unit_price: null, reason: "WH-2 → WH-1", created_by: teamIds.marco, created_at: atDaysAgo(1, 9) });
    }
    if (p.sku === "DRY-033") {
      flavor.push({ org_id: orgId, product_id: pid, warehouse_id: wid, type: "return", qty_delta: 3, unit_price: null, reason: "Customer return", created_by: teamIds.lin, created_at: atDaysAgo(1, 12) });
    }
    if (p.sku === "BRD-004") {
      flavor.push({ org_id: orgId, product_id: pid, warehouse_id: wid, type: "expired", qty_delta: -14, unit_price: null, reason: "Past expiry date", created_by: null, created_at: atDaysAgo(2, 18) });
    }
    if (p.sku === "PRD-009") {
      flavor.push({ org_id: orgId, product_id: pid, warehouse_id: wid, type: "received", qty_delta: 240, unit_price: null, reason: "PO-4821 · Dole Foods", created_by: teamIds.marco, created_at: atDaysAgo(0, 4) });
    }
    if (p.sku === "PAN-052") {
      flavor.push({ org_id: orgId, product_id: pid, warehouse_id: wid, type: "received", qty_delta: 120, unit_price: null, reason: "PO-4809 · Golden Fields", created_by: teamIds.marco, created_at: atDaysAgo(2, 2) });
    }

    const known = [...recentSales, ...priorSales, ...flavor];
    const knownDelta = known.reduce((sum, m) => sum + (m.qty_delta as number), 0);
    const initialReceive = Math.max(p.target - knownDelta, p.target + 10);

    allMovements.push({
      org_id: orgId, product_id: pid, warehouse_id: wid, type: "received",
      qty_delta: initialReceive, unit_price: null, reason: `Initial stock — ${p.supplier}`,
      created_by: teamIds.marco, created_at: atDaysAgo(45),
    });
    allMovements.push(...known);
  }

  // Insert in chronological order so the running total is easy to reason about.
  allMovements.sort((a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime());
  for (let i = 0; i < allMovements.length; i += 50) {
    await must(admin.from("stock_movements").insert(allMovements.slice(i, i + 50)), `insert stock_movements batch ${i}`);
  }
  console.log(`Seeded ${allMovements.length} stock movements.`);

  // Sanity-check qty_on_hand landed where intended; log any drift instead of
  // silently seeding a catalog that doesn't match the design's numbers.
  const { data: finalQty } = await admin.from("products").select("sku, qty_on_hand").eq("org_id", orgId);
  for (const p of productDefs) {
    const row = (finalQty as { sku: string; qty_on_hand: number }[]).find((f) => f.sku === p.sku);
    if (row && row.qty_on_hand !== p.target) {
      console.warn(`qty drift for ${p.sku}: expected ${p.target}, got ${row.qty_on_hand}`);
    }
  }

  // ---------------------------------------------------------------------
  // Monthly stats (12 months, ending this month) for the dashboard chart.
  // ---------------------------------------------------------------------
  const revenue = [182, 198, 176, 214, 232, 221, 258, 270, 249, 288, 305, 331];
  const profit = [61, 68, 58, 74, 82, 79, 92, 98, 88, 104, 112, 124];
  await must(
    admin.from("monthly_stats").insert(
      revenue.map((r, i) => ({
        org_id: orgId,
        month: monthsAgoStart(11 - i),
        revenue: r * 1000,
        profit: profit[i] * 1000,
      })),
    ),
    "insert monthly_stats",
  );
  console.log("Monthly stats seeded.");

  // ---------------------------------------------------------------------
  // Invoices
  // ---------------------------------------------------------------------
  await must(
    admin.from("invoices").insert([
      { org_id: orgId, invoice_number: "INV-2026-07", amount: 99, status: "paid", issued_at: monthsAgoStart(0) },
      { org_id: orgId, invoice_number: "INV-2026-06", amount: 99, status: "paid", issued_at: monthsAgoStart(1) },
      { org_id: orgId, invoice_number: "INV-2026-05", amount: 99, status: "paid", issued_at: monthsAgoStart(2) },
      { org_id: orgId, invoice_number: "INV-2026-04", amount: 49, status: "paid", issued_at: monthsAgoStart(3) },
    ]),
    "insert invoices",
  );
  console.log("Invoices seeded.");

  console.log("\n✅ Seed complete.\n");
  console.log("Sign in at /login with:");
  console.log(`  email:    ava@freshmart.co`);
  console.log(`  password: ${avaPassword}`);
  console.log("\n(Other team members were created with random passwords — not meant to be logged into directly.)");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
