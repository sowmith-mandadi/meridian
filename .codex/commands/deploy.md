---
description: Build and deploy Meridian to Vercel production
---

Run the following steps in order:

1. Run typecheck: `pnpm typecheck`
2. Run lint: `pnpm lint`
3. Build the project: `pnpm build`
4. If all pass, deploy: `vercel --prod`
5. Report the deployment URL.

If any step fails, stop and report the error. Do not deploy with failing checks.
