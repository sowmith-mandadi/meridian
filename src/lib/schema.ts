import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  state: text("state").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  riskScore: real("risk_score").notNull(),
  riskTier: text("risk_tier").notNull(),
  chronicConditions: text("chronic_conditions").notNull(),
});

export const claims = sqliteTable("claims", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  icdCode: text("icd_code").notNull(),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  provider: text("provider").notNull(),
});

export const pharmacy = sqliteTable("pharmacy", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  drugName: text("drug_name").notNull(),
  adherencePct: real("adherence_pct").notNull(),
  fillDate: text("fill_date").notNull(),
});

export const sdoh = sqliteTable("sdoh", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  transportationFlag: integer("transportation_flag").notNull(),
  foodInsecurity: integer("food_insecurity").notNull(),
  housingInstability: integer("housing_instability").notNull(),
});

export const callCenter = sqliteTable("call_center", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  reason: text("reason").notNull(),
  sentiment: text("sentiment").notNull(),
  date: text("date").notNull(),
});

export const feedbackRequests = sqliteTable("feedback_requests", {
  id: text("id").primaryKey(),
  userRole: text("user_role").notNull(),
  requestText: text("request_text").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull(),
});

export const usageLog = sqliteTable("usage_log", {
  id: text("id").primaryKey(),
  queryText: text("query_text").notNull(),
  tokensIn: integer("tokens_in").notNull(),
  tokensOut: integer("tokens_out").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  model: text("model").notNull(),
  createdAt: text("created_at").notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
});
