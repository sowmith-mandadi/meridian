---
description: Run the interactive A2A governance demo — shows role-based access control with user input at every step
---

Run the governed access demo using the `governed-access` skill. This demonstrates the agent-to-agent governance flow with human-in-the-loop approval.

## Demo flow

### Part 1: Role comparison

Run the same query through two different roles to show how governance affects data visibility:

**Query**: High-risk diabetic members in Texas and Florida

1. First, ask the user to pick between **Care Manager** and **Analyst** for the comparison demo
2. Run the governance flow for the first role:
   - Call `check_governance` from the `meridian` MCP server to preview rules
   - Present the governance gate to the user (policy note, blocked fields, audit)
   - Ask the user to confirm
   - Execute with `request_governed_access` (userConfirmed=true)
   - Present the results highlighting what fields are visible
3. Then run the SAME query for the second role:
   - Repeat the governance check and confirmation flow
   - Present results side by side
   - Highlight which fields were blocked in the restricted role vs visible in the full-access role

### Part 2: Governance block demo

Show what happens when a role tries an unauthorized intent:

1. Call `check_governance` with role=quality, intent=member_outreach
2. Show the user that the intent is BLOCKED
3. Explain which intents the quality role CAN access
4. Ask the user if they want to retry with an allowed intent

### Part 3: Audit trail

After the demo queries, note that all interactions were logged to the governance audit trail with:
- User role
- Query intent and filters
- Which fields were blocked
- A unique audit ID for each request

Tell the user they can view the full audit trail at `/observe` in the Meridian web app under the "Governance Audit" tab.

## Key talking points

- **Role-based field masking**: Same data, different visibility per role
- **Human-in-the-loop**: User must approve before data flows
- **Audit trail**: Every governed request is logged with full metadata
- **Intent authorization**: Roles can only perform allowed query types
- **PHI protection**: Raw member IDs never exposed, only masked references
