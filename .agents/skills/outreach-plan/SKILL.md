---
name: outreach-plan
description: Generates prioritized outreach action plans for healthcare members based on risk drivers. Use when recommending interventions for care managers.
---

# Outreach Plan Skill

Create structured, actionable outreach recommendations for high-risk members.

## Logic

Map risk drivers to interventions:

| Driver | Action | Priority |
|--------|--------|----------|
| Transportation barrier | Offer transportation benefit navigation + scheduling | high |
| Food insecurity | Connect to food assistance programs + meal benefit review | high |
| Medication non-adherence | Pharmacist-led adherence call + 90-day fill review | medium |
| High clinical risk | Care manager outreach within 48 hours | high |
| Housing instability | Social worker referral + housing resource navigation | high |
| Recent ED visit | Post-discharge follow-up within 72 hours | high |

## Output Format

```json
{
  "memberId": "M-1042",
  "memberName": "...",
  "recommendations": [
    {
      "action": "Description of the intervention",
      "priority": "high",
      "rationale": "Why this action for this member"
    }
  ]
}
```

## Governance

- Recommendations are suggestions, not clinical orders
- Always include rationale linking the action to the specific driver
- Priority must be one of: high, medium, low
