---
name: pgplan-end-user-quality
description: Improve PGPlan Insight's end-user diagnostic workflow through prioritized investigations, evidence navigation, plain-language explanations, contextual prerequisites and fix validation. Use for usability improvements, not cosmetic redesigns or production-accuracy certification.
---

# PGPlan End-User Quality

Read repository instructions and `docs/DELIVERY_STATUS.md`. Inspect existing interactions before adding controls; the first Findings investigation already opens by default and includes a controlled next action. Preserve the user-approved Classic DBA Report theme (Verdana interface, compact ruled layout, monospace SQL) and Plan/PEV2 behavior unless explicitly asked to change them.

## One outcome per iteration

Select the highest-value unresolved task, record it, and finish its checks before moving on:

1. Identify one evidence-backed starting investigation; collapse alternatives without hiding uncertainty.
2. Link each finding to the exact supporting operation when an explicit mapping exists. Use operation type and relation, not only a number. Never guess a node from title text; disclose plan-wide or unavailable attribution.
3. Explain the observation, what it could mean, what remains unknown and one next action in everyday language. Estimated cost is not time; inclusive timings must not be summed across ancestors.
4. Explain why index SQL is withheld or why an existing index should be investigated. No guaranteed benefit or automatic execution.
5. Ask only for context that can resolve the current uncertainty, with purpose, collection instructions and privacy boundaries.
6. Compare representative before/after executions with comparability warnings before declaring a fix successful.
7. Export the same evidence, hypothesis, next action and caveats used on screen.

Prefer improving existing Findings, Planner diagnostics, Database context or Validate fix rather than adding tabs or duplicate summaries. Do not change diagnostic rules merely to make the explanation more decisive. Separate captured facts, derived measurements, suspected causes and independently verified outcomes.

## Acceptance

- Exercise positive, healthy and missing-evidence cases. Tests must verify behavior and correct attribution, not only headings or copied wording.
- Check keyboard navigation, focus, node selection, back navigation and report export for affected controls.
- Inspect normal, narrow and deep-plan rendering: no document overflow, clipped actions, excessive whitespace or hidden uncertainty. Preserve readable font size instead of shrinking everything.
- Run relevant unit, cross-browser and security checks; record unrun checks. Follow the repository release gate before release claims.
- For human acceptance, ask engineers to investigate a slow indexed query, assess an index suggestion and validate a fix without coaching. Record time to the first correct investigation, incorrect conclusions and help requests. Do not invent participants, outcomes or DBA consensus.
- Distinguish regression conformance, usability results and diagnostic accuracy. Synthetic tests cannot establish production accuracy.

Report the completed user outcome, evidence, remaining risks and next slice. A skill or passing wording assertion is not evidence that usability improved. Git pushes and other external actions require current user authorization; this skill does not grant it.
