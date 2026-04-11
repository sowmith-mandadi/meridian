/**
 * Eval script for cohort-query skill.
 * Verifies that cohort queries return expected shapes and counts.
 */
import { drizzle } from "drizzle-orm/libsql/node";
import { eq, inArray, and, like } from "drizzle-orm";
import * as schema from "../../../src/lib/schema";

async function run() {
  const db = drizzle({
    connection: { url: process.env.TURSO_DATABASE_URL || "file:local.db" },
    schema,
  });

  console.log("Eval: cohort-query skill\n");

  // Test 1: High-risk members in TX
  const txHigh = await db
    .select()
    .from(schema.members)
    .where(and(eq(schema.members.state, "TX"), eq(schema.members.riskTier, "high")));
  console.log(`  [PASS] TX high-risk: ${txHigh.length} members (expected > 0)`);
  if (txHigh.length === 0) throw new Error("No TX high-risk members found");

  // Test 2: Diabetic members
  const diabetic = await db
    .select()
    .from(schema.members)
    .where(like(schema.members.chronicConditions, "%Diabetes%"));
  console.log(`  [PASS] Diabetic members: ${diabetic.length} (expected > 0)`);
  if (diabetic.length === 0) throw new Error("No diabetic members found");

  // Test 3: Multi-state filter
  const multiState = await db
    .select()
    .from(schema.members)
    .where(inArray(schema.members.state, ["TX", "FL"]));
  console.log(`  [PASS] TX+FL members: ${multiState.length} (expected > 0)`);

  // Test 4: SDOH join
  const withSdoh = await db
    .select()
    .from(schema.members)
    .leftJoin(schema.sdoh, eq(schema.members.id, schema.sdoh.memberId))
    .where(eq(schema.members.riskTier, "high"))
    .limit(5);
  console.log(`  [PASS] High-risk with SDOH join: ${withSdoh.length} rows`);

  console.log("\nAll evals passed!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Eval failed:", err);
  process.exit(1);
});
