import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  memberReference: text("member_reference").notNull(),
  state: text("state").notNull(),
  city: text("city").notNull().default(""),
  county: text("county").notNull().default(""),
  metroArea: text("metro_area").notNull().default(""),
  zipCode: text("zip_code").notNull().default(""),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  riskScore: real("risk_score").notNull(),
  riskTier: text("risk_tier").notNull(),
  chronicConditions: text("chronic_conditions").notNull(),
  hospitalVisitProb6m: real("hospital_visit_prob_6m").notNull().default(0),
  diabetesFlag: integer("diabetes_flag").notNull().default(0),
  hba1cGapFlag: integer("hba1c_gap_flag").notNull().default(0),
  pcpId: text("pcp_id").notNull().default(""),
  pcpName: text("pcp_name").notNull().default(""),
  erVisits12m: integer("er_visits_12m").notNull().default(0),
  pcpVisits12m: integer("pcp_visits_12m").notNull().default(0),
  inpatientVisits12m: integer("inpatient_visits_12m").notNull().default(0),
  adherenceScore: real("adherence_score").notNull().default(100),
  riskDrivers: text("risk_drivers").notNull().default(""),
  recommendedActions: text("recommended_actions").notNull().default(""),
  selectionExplanation: text("selection_explanation").notNull().default(""),
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
  drugClass: text("drug_class").notNull().default(""),
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
  financialStress: integer("financial_stress").notNull().default(0),
  socialIsolation: integer("social_isolation").notNull().default(0),
});

export const callCenter = sqliteTable("call_center", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  reason: text("reason").notNull(),
  sentiment: text("sentiment").notNull(),
  date: text("date").notNull(),
  unresolvedFlag: integer("unresolved_flag").notNull().default(0),
  escalatedFlag: integer("escalated_flag").notNull().default(0),
});

export const utilization = sqliteTable("utilization", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  eventType: text("event_type").notNull(),
  eventDate: text("event_date").notNull(),
  avoidableFlag: integer("avoidable_flag").notNull().default(0),
  lengthOfStay: integer("length_of_stay").notNull().default(0),
  providerId: text("provider_id").notNull().default(""),
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

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().default(""),
  userRole: text("user_role").notNull(),
  action: text("action").notNull(),
  toolArgs: text("tool_args").notNull().default("{}"),
  resultSummary: text("result_summary").notNull().default(""),
  blockedFields: text("blocked_fields").notNull().default(""),
  policyNote: text("policy_note").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const pipelineRuns = sqliteTable("pipeline_runs", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  stepsCompleted: integer("steps_completed").notNull(),
  totalSteps: integer("total_steps").notNull(),
  qualityScore: real("quality_score").notNull().default(0),
  profilingJson: text("profiling_json").notNull().default("{}"),
  validationJson: text("validation_json").notNull().default("{}"),
  durationMs: integer("duration_ms").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const rawClaims = sqliteTable("raw_claims", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().default(""),
  icdCode: text("icd_code").notNull().default(""),
  type: text("type").notNull().default(""),
  amount: real("amount").notNull().default(0),
  date: text("date").notNull().default(""),
  provider: text("provider").notNull().default(""),
  sourceFile: text("source_file").notNull().default("intake"),
});

export const rawPharmacy = sqliteTable("raw_pharmacy", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull().default(""),
  drugName: text("drug_name").notNull().default(""),
  drugClass: text("drug_class").notNull().default(""),
  adherencePct: real("adherence_pct").notNull().default(0),
  fillDate: text("fill_date").notNull().default(""),
  sourceFile: text("source_file").notNull().default("intake"),
});

export const stagingQuarantine = sqliteTable("staging_quarantine", {
  id: text("id").primaryKey(),
  sourceTable: text("source_table").notNull(),
  sourceId: text("source_id").notNull(),
  reason: text("reason").notNull(),
  stepName: text("step_name").notNull(),
  recordJson: text("record_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export const dataProducts = sqliteTable("data_products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdBy: text("created_by").notNull().default("agent"),
  sourceTables: text("source_tables").notNull().default("[]"),
  queryDefinition: text("query_definition").notNull().default("{}"),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("draft"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const customSources = sqliteTable("custom_sources", {
  id: text("id").primaryKey(),
  tableName: text("table_name").notNull().unique(),
  columnsJson: text("columns_json").notNull().default("[]"),
  rowCount: integer("row_count").notNull().default(0),
  createdBy: text("created_by").notNull().default("agent"),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull(),
});
