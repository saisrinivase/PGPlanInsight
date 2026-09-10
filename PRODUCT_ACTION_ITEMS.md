# PGPlan Insight Product Action Items

Each item advances only after implementation, deterministic rule tests, browser workflow validation, and product-owner review.

1. **Root-cause tracing** — distinguish where a problem is observed from the deepest evidenced origin. **Complete in v0.5.0**
2. **Evidence completeness and confidence** — show captured, missing, and conclusion-limiting evidence. **Complete in v0.5.0**
3. **Controlled experiments** — turn recommendations into hypotheses, prerequisites, tests, success criteria, and rollback boundaries. **Complete in v0.5.0**
4. **Fix comparability guardrails** — reject unsafe before/after comparisons. **Complete in v0.5.0**
5. **Optional database-context package** — import sanitized schema, index, statistics, and size evidence without requiring a backend. **Complete in v0.5.0**
6. **CI regression mode** — machine-readable performance gates for pull requests and releases.
7. **Performance case memory** — preserve fingerprints, attempted changes, results, and recurrence history.
8. **AI explanation layer** — explain deterministic findings without becoming the diagnostic authority.

## Acceptance rule for item 1

- Estimate drift at a pass-through node is not called a runtime bottleneck.
- The trace descends only through children with matching material evidence.
- Inclusive runtime descends only when child time dominates and parent self time is small.
- The UI separates “observed at” from “investigate first.”
- Unproven causes remain explicitly unproven.
