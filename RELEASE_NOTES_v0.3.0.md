# pgplan_v0.3.0

## Product change

The default interface is now a single diagnosis workspace instead of ten equally prominent tabs.

- Primary evidence-backed finding appears first.
- The likely responsible node is selected automatically.
- The execution tree supports time, self-time, shared-read, and loop heat modes.
- Selected-node facts remain distinct from plan-level interpretation.
- The safest next experiment links directly to before/after validation.
- Secondary signals are limited to two in the primary workspace.
- Detailed v1.3.1-derived views remain available under Expert tools.

## Verification

- All 12 enterprise pgbench fixtures pass their deterministic diagnosis expectations.
- 15 of 15 Vitest checks pass.
- TypeScript and Vite production build pass.
- Desktop and 390 px mobile browser workflows pass without page overflow.
- Node selection, heat switching, expert disclosure, and validation handoff pass.
- Browser console reports no warnings or errors during the checked workflow.

## Accuracy boundary

This release explains captured evidence; it does not claim that one plan alone proves the best production change. Recommendations are phrased as controlled tests and must be accepted only after representative before/after measurement.
