import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
const db = new PrismaClient();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
type Item = { name: string; cat: string; col: string; badge?: string; desc: string; specs: string[]; v: [string, number, number][] };
const items: Item[] = [
  { name: "Aurelia Chronograph", cat: "Watches", col: "Sovereign Edit", badge: "Best Seller", desc: "A 41 mm automatic chronograph with a hand-guilloché dial and a movement regulated over 72 hours.", specs: ["41 mm gold-plated steel case", "Sapphire crystal, 50 m water resistant", "Automatic movement, 72-hour reserve", "Numbered edition with authenticity card"], v: [["Champagne dial", 18500000, 6], ["Emerald dial", 19700000, 2], ["Obsidian dial", 19300000, 0]] },
  { name: "Regalia Leather Tote", cat: "Bags", col: "Emerald Atelier", badge: "New", desc: "Full-grain calf leather, saddle-stitched by hand, with a suede-lined interior that holds a 14-inch laptop.", specs: ["Full-grain Italian calf leather", "Suede lining and brass hardware", "36 × 28 × 14 cm", "Dust bag and care card included"], v: [["Ivory", 9250000, 5], ["Emerald", 9850000, 3], ["Noir", 9250000, 7]] },
  { name: "Noir Oud Parfum", cat: "Fragrance", col: "Maison Noir", desc: "Smoked oud over amber and black pepper, with a dry cedar finish that lasts through the evening.", specs: ["Extrait de parfum, 22% concentration", "Notes: oud, amber, black pepper, cedar", "Hand-poured, numbered flacon", "Refillable bottle"], v: [["50 ml", 1890000, 9], ["100 ml", 2990000, 4]] },
  { name: "Sovereign Signet Ring", cat: "Jewellery", col: "Sovereign Edit", badge: "Limited", desc: "A heavy signet in 18k gold vermeil, engraved with the Velora crest on a polished oval face.", specs: ["18k gold vermeil on sterling silver", "Hand-engraved crest", "Optional initials engraving", "Presented in a walnut case"], v: [["Size 7", 6400000, 2], ["Size 9", 6400000, 3], ["Size 11", 6400000, 1]] },
  { name: "Emerald Silk Scarf", cat: "Accessories", col: "Emerald Atelier", desc: "Twill silk, 90 × 90 cm, printed in deep emerald with a gold-thread border and hand-rolled edges.", specs: ["100% mulberry silk twill", "90 × 90 cm", "Hand-rolled edges", "Dry clean only"], v: [["Emerald", 1450000, 8], ["Ivory", 1450000, 5]] },
  { name: "Monarch Cufflinks", cat: "Jewellery", col: "Sovereign Edit", badge: "New", desc: "Weighted rhodium and gold cufflinks with a swivel back that sits flat against the cuff.", specs: ["Gold-plated brass, rhodium accents", "Swivel-back fastening", "Enamel set by hand", "Gift box included"], v: [["Gold", 2750000, 6], ["Emerald enamel", 3100000, 3]] },
];
async function main() {
  // SEED_ADMIN_ONLY=1 creates just the admin account, with none of the demo products or the demo coupon. Use it on the live database.
  if (process.env.SEED_ADMIN_ONLY === "1") {
    const email = process.env.ADMIN_EMAIL, pw = process.env.ADMIN_PASSWORD;
    if (!email || !pw) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");
    await db.user.upsert({ where: { email }, update: { role: "ADMIN" }, create: { email, name: "Admin", role: "ADMIN", passwordHash: hashPassword(pw), emailVerified: new Date() } });
    console.log("Admin account ready. No demo products were added.");
    return;
  }
  for (const name of [...new Set(items.map((i) => i.cat))]) await db.category.upsert({ where: { slug: slug(name) }, update: {}, create: { slug: slug(name), name } });
  for (const name of [...new Set(items.map((i) => i.col))]) await db.collection.upsert({ where: { slug: slug(name) }, update: {}, create: { slug: slug(name), name } });
  for (const it of items) {
    const category = await db.category.findUniqueOrThrow({ where: { slug: slug(it.cat) } });
    const collection = await db.collection.findUniqueOrThrow({ where: { slug: slug(it.col) } });
    const data = { name: it.name, description: it.desc, specs: it.specs, badge: it.badge ?? null, categoryId: category.id, collectionId: collection.id };
    const p = await db.product.upsert({ where: { slug: slug(it.name) }, update: data, create: { slug: slug(it.name), ...data } });
    for (const [vName, pricePaise, onHand] of it.v) {
      const sku = `${slug(it.name)}-${slug(vName)}`;
      const v = await db.productVariant.upsert({ where: { sku }, update: { name: vName, pricePaise }, create: { sku, productId: p.id, name: vName, pricePaise } });
      await db.inventory.upsert({ where: { variantId: v.id }, update: {}, create: { variantId: v.id, onHand } }); // never overwrite live stock on re-seed
    }
  }
  await db.coupon.upsert({ where: { code: "VELORA10" }, update: {}, create: { code: "VELORA10", percentOff: 10 } });
  const email = process.env.ADMIN_EMAIL, pw = process.env.ADMIN_PASSWORD;
  if (email && pw) await db.user.upsert({ where: { email }, update: { role: "ADMIN" }, create: { email, name: "Admin", role: "ADMIN", passwordHash: hashPassword(pw), emailVerified: new Date() } });
  else console.log("Admin user skipped: set ADMIN_EMAIL and ADMIN_PASSWORD in .env to create one.");
  console.log(`Seeded ${items.length} products.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
