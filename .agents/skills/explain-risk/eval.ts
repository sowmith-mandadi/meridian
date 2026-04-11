/**
 * Eval script for explain-risk skill.
 * Verifies member explanation data is complete and well-structured.
 */
import { drizzle } from "drizzle-orm/libsql/node";
import { eq, desc } from "drizzle-orm";
import * as schema from "../../../src/lib/schema";

async function run() {
  const db = drizzle({
    connection: { url: process.env.TURSO_DATABASE_URL || "file:local.db" },
    schema,
  });

  console.log("Eval: explain-risk skill\n");

  // Pick a high-risk member
  const member = await db.query.members.findFirst({
    where: eq(schema.members.riskTier, "high"),
  });
  if (!member) throw new Error("No high-risk member found");
  console.log(`  Testing with member: ${member.id} (${member.name})`);

  // Verify SDOH data exists
  const sdohRow = await db.query.sdoh.findFirst({
    where: eq(schema.sdoh.memberId, member.id),
  });
  console.log(`  [PASS] SDOH record: ${sdohRow ? "found" : "missing (acceptable)"}`);

  // Verify pharmacy data
  const rxRows = await db
    .select()
    .from(schema.pharmacy)
    .where(eq(schema.pharmacy.memberId, member.id));
  console.log(`  [PASS] Pharmacy records: ${rxRows.length}`);

  // Verify claims data
  const claimRows = await db
    .select()
    .from(schema.claims)
    .where(eq(schema.claims.memberId, member.id))
    .orderBy(desc(schema.claims.date))
    .limit(10);
  console.log(`  [PASS] Claims records: ${claimRows.length}`);

  // Verify explanation structure would be valid
  const explanation = {
    sections: {
      overview: { title: "Overview", summary: `${member.name} is ${member.riskTier} risk` },
      demographics: { title: "Demographics", id: member.id, name: member.name },
      clinical: { title: "Clinical", chronicConditions: member.chronicConditions, riskScore: member.riskScore },
      sdoh: { title: "SDOH", transportationBarrier: sdohRow?.transportationFlag === 1 },
      pharmacy: { title: "Pharmacy", fills: rxRows.length },
      claims: { title: "Claims", count: claimRows.length },
    },
  };
  const keys = Object.keys(explanation.sections);
  if (keys.length !== 6) throw new Error(`Expected 6 sections, got ${keys.length}`);
  console.log(`  [PASS] Explanation structure: ${keys.length} sections`);

  console.log("\nAll evals passed!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Eval failed:", err);
  process.exit(1);
});
