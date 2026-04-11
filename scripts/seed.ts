import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/lib/schema";

const STATES = ["TX", "FL", "CA", "NY"];
const CONDITIONS = [
  "Diabetes Type 2",
  "CHF",
  "COPD",
  "Hypertension",
  "CKD",
  "Asthma",
  "Depression",
];
const ICD_CODES: Record<string, string> = {
  "Diabetes Type 2": "E11.9",
  CHF: "I50.9",
  COPD: "J44.1",
  Hypertension: "I10",
  CKD: "N18.9",
  Asthma: "J45.909",
  Depression: "F32.9",
};
const DRUGS = [
  "Metformin",
  "Lisinopril",
  "Atorvastatin",
  "Amlodipine",
  "Albuterol",
  "Sertraline",
  "Omeprazole",
  "Insulin Glargine",
  "Furosemide",
  "Losartan",
];
const CALL_REASONS = [
  "Appointment scheduling",
  "Medication refill",
  "Billing inquiry",
  "Symptom question",
  "Transportation need",
  "Coverage question",
  "Complaint",
  "Care coordination",
];
const SENTIMENTS = ["positive", "neutral", "negative"];
const FIRST_NAMES = [
  "James",
  "Maria",
  "Robert",
  "Linda",
  "Michael",
  "Patricia",
  "William",
  "Jennifer",
  "David",
  "Elizabeth",
  "Carlos",
  "Rosa",
  "Anthony",
  "Susan",
  "Thomas",
  "Sarah",
  "Daniel",
  "Angela",
  "Jose",
  "Margaret",
];
const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Martinez",
  "Davis",
  "Rodriguez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
];
const PROVIDERS = [
  "Memorial Hospital",
  "St. Mary's Medical",
  "Regional Health Center",
  "Community Care Clinic",
  "University Hospital",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], min: number, max: number): T[] {
  const n = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function dateInPast(maxDays: number) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * maxDays));
  return d.toISOString().split("T")[0];
}

async function seed() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:local.db",
  });
  const db = drizzle(client, { schema });

  console.log("Seeding database...");

  // Seed users
  await db.insert(schema.users).values([
    {
      id: "u-care",
      email: "care_manager@demo.com",
      password: "demo123",
      name: "Dr. Sarah Chen",
      role: "care_manager",
    },
    {
      id: "u-analyst",
      email: "analyst@demo.com",
      password: "demo123",
      name: "Alex Rivera",
      role: "analyst",
    },
    {
      id: "u-admin",
      email: "admin@demo.com",
      password: "demo123",
      name: "Jordan Taylor",
      role: "admin",
    },
  ]);
  console.log("  Users: 3 created");

  // Seed 500 members
  const memberRows: (typeof schema.members.$inferInsert)[] = [];
  const claimRows: (typeof schema.claims.$inferInsert)[] = [];
  const pharmacyRows: (typeof schema.pharmacy.$inferInsert)[] = [];
  const sdohRows: (typeof schema.sdoh.$inferInsert)[] = [];
  const callCenterRows: (typeof schema.callCenter.$inferInsert)[] = [];

  for (let i = 0; i < 500; i++) {
    const mid = `M-${String(i + 1000).padStart(4, "0")}`;
    const conditions = pickN(CONDITIONS, 1, 3);
    const riskScore = Math.round((0.1 + Math.random() * 0.85) * 100) / 100;
    const riskTier =
      riskScore >= 0.7 ? "high" : riskScore >= 0.4 ? "medium" : "low";
    const state = pick(STATES);
    const age = 25 + Math.floor(Math.random() * 55);
    const transportFlag = Math.random() < (riskTier === "high" ? 0.55 : 0.2) ? 1 : 0;
    const foodFlag = Math.random() < (riskTier === "high" ? 0.4 : 0.15) ? 1 : 0;
    const housingFlag = Math.random() < (riskTier === "high" ? 0.3 : 0.1) ? 1 : 0;

    memberRows.push({
      id: mid,
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      state,
      age,
      gender: Math.random() < 0.5 ? "M" : "F",
      riskScore,
      riskTier,
      chronicConditions: conditions.join(", "),
    });

    for (const cond of conditions) {
      const numClaims = 1 + Math.floor(Math.random() * 4);
      for (let c = 0; c < numClaims; c++) {
        claimRows.push({
          id: `C-${uid()}`,
          memberId: mid,
          icdCode: ICD_CODES[cond] || "Z00.0",
          type: pick(["inpatient", "outpatient", "emergency", "pharmacy"]),
          amount: Math.round((50 + Math.random() * 5000) * 100) / 100,
          date: dateInPast(365),
          provider: pick(PROVIDERS),
        });
      }
    }

    const numRx = 1 + Math.floor(Math.random() * 3);
    for (let r = 0; r < numRx; r++) {
      pharmacyRows.push({
        id: `RX-${uid()}`,
        memberId: mid,
        drugName: pick(DRUGS),
        adherencePct:
          riskTier === "high"
            ? Math.round((30 + Math.random() * 40) * 10) / 10
            : Math.round((60 + Math.random() * 35) * 10) / 10,
        fillDate: dateInPast(180),
      });
    }

    sdohRows.push({
      id: `S-${uid()}`,
      memberId: mid,
      transportationFlag: transportFlag,
      foodInsecurity: foodFlag,
      housingInstability: housingFlag,
    });

    if (Math.random() < 0.6) {
      callCenterRows.push({
        id: `CC-${uid()}`,
        memberId: mid,
        reason: pick(CALL_REASONS),
        sentiment: pick(SENTIMENTS),
        date: dateInPast(90),
      });
    }
  }

  // Batch insert
  const BATCH = 100;
  for (let i = 0; i < memberRows.length; i += BATCH) {
    await db.insert(schema.members).values(memberRows.slice(i, i + BATCH));
  }
  console.log(`  Members: ${memberRows.length}`);

  for (let i = 0; i < claimRows.length; i += BATCH) {
    await db.insert(schema.claims).values(claimRows.slice(i, i + BATCH));
  }
  console.log(`  Claims: ${claimRows.length}`);

  for (let i = 0; i < pharmacyRows.length; i += BATCH) {
    await db.insert(schema.pharmacy).values(pharmacyRows.slice(i, i + BATCH));
  }
  console.log(`  Pharmacy: ${pharmacyRows.length}`);

  for (let i = 0; i < sdohRows.length; i += BATCH) {
    await db.insert(schema.sdoh).values(sdohRows.slice(i, i + BATCH));
  }
  console.log(`  SDOH: ${sdohRows.length}`);

  for (let i = 0; i < callCenterRows.length; i += BATCH) {
    await db
      .insert(schema.callCenter)
      .values(callCenterRows.slice(i, i + BATCH));
  }
  console.log(`  Call Center: ${callCenterRows.length}`);

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
