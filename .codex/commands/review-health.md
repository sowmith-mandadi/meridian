---
description: Run a healthcare data safety review on the codebase
---

Spawn the reviewer agent to check the following across the entire `src/` directory:

1. **PHI Safety**: Search for any raw member names, IDs, or health data that could reach the client without aggregation. Check all components in `src/components/chat/` and all pages.

2. **Server/Client Boundary**: Verify that `@/lib/db` and `@/lib/auth` are never imported in files with `"use client"` directive.

3. **AI SDK Correctness**: Verify no deprecated patterns:
   - No `parameters` (should be `inputSchema`)
   - No `message.content` (should be `message.parts`)
   - No `isLoading` (should be `status`)
   - No `handleSubmit` (should be `sendMessage`)
   - No `toDataStreamResponse` (should be `toUIMessageStreamResponse`)

4. **Governance Labels**: Check that the explain panel and A2A view include governance indicators (Shield icon, "PHI filtered", "aggregated only").

Report findings with file paths and line numbers. Prioritize by severity.
