---
description: Reset and reseed the database with fresh synthetic healthcare data (feature-engineered risk scores)
---

Run the following steps in order:

1. Remove the old database: `rm -f local.db`
2. Push the Drizzle schema to ensure all tables exist: `pnpm db:push`
3. Seed the database with feature-engineered data: `pnpm db:seed`
4. Verify the seed by running: `sqlite3 local.db "SELECT count(*) FROM members; SELECT count(*) FROM utilization; SELECT count(*) FROM audit_log;"`
5. Report the count of members, claims, pharmacy records, SDOH records, call center records, and utilization events.
