---
description: Reset and reseed the database with fresh synthetic healthcare data
---

Run the following steps in order:

1. Push the Drizzle schema to ensure tables exist: `pnpm db:push`
2. Seed the database: `pnpm db:seed`
3. Verify the seed by running: `sqlite3 local.db "SELECT count(*) FROM members;"`
4. Report the count of members, claims, pharmacy records, SDOH records, and call center records.
