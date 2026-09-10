# PGPlan Insight QA and Release Strategy

## Release decision

PGPlan Insight is releasable only when Smoke and S1 gates are fully green. S2 failures require a documented product-owner disposition. Stress, accessibility, and visual-regression results must be attached to a production release candidate.

## Severity model

| Level | Meaning | Examples | Release rule |
|---|---|---|---|
| Smoke | Build is usable | Application loads, plan can be submitted, diagnosis renders | 100% pass |
| S1 blocker | Incorrect or unsafe core behavior | Wrong parse, invented evidence, data transmission, lost history, broken comparison, crash | 100% pass |
| S2 major | Important workflow degradation | Broken filter/collapse/details, unusable responsive table, missing guarded recommendation | Must pass or have approved exception |
| S3 minor | Low-risk presentation defect | Minor copy, spacing, non-blocking polish | May defer with tracked issue |

## Functional coverage

### Input and normalization

- FORMAT JSON: supported PostgreSQL versions and known aliases.
- TEXT: multiline, quoted clipboard exports, escaped identifiers, non-breaking spaces, worker sections, settings, planning and execution metadata.
- Invalid input: empty, arbitrary text, malformed JSON, incomplete root plan, unsupported types, excessive file size.
- Boundary values: zero rows, zero loops, absent timing, absent buffers, very large numeric values, null optional fields.

### Diagnosis accuracy

- Golden fixtures for healthy lookup, non-sargable filter, low-selectivity scan, missing access path, loop amplification, sort/hash spill, parallel suppression, WAL pressure, estimate drift, and large OFFSET.
- Every recommendation must map to deterministic evidence and must not claim catalog knowledge.
- Healthy or incomplete evidence must not generate a confident defect.
- PostgreSQL SME review is required when a rule or threshold changes.

### User workflows

- New analysis, file upload, drag/drop, clear, sample load, filtering, collapse/expand, node selection, inline details, expert tools, fix validation, report export, history reopen, and manual history clear.
- Stable SL numbers and hierarchy when filtering or collapsing.
- Keyboard operation and visible focus for all controls.

### Privacy and durability

- Assert no request leaves the application origin during analysis.
- Verify plans persist across reload in IndexedDB.
- Verify clear-history removes all saved cases.
- Verify analysis continues if history storage is unavailable, with an accurate warning.

## Non-functional coverage

### Stress and endurance

- Balanced JSON plans at 1,000, 5,000, and 10,000 nodes.
- Deep plans at 25, 50, and 100 levels without node-column overlap or stack failure.
- Repeated analysis: 100 plans in one session; monitor worker lifecycle and heap growth.
- Input sizes immediately below, at, and above 10 MB.
- History volumes of 100, 1,000, and 5,000 cases; measure load, search, and clear duration.

Initial budgets: 5,000-node analysis under 3 seconds on the reference machine, interaction response under 200 ms after render, no unhandled error, and no node control crossing its column boundary. Budgets should be baselined in CI before enforcement.

### Compatibility

- Desktop Chromium, Firefox, and WebKit.
- Mobile Chromium and Mobile WebKit.
- Viewports: 360×800, 768×1024, 1366×768, 1440×900, and 1920×1080.
- 125% and 200% browser zoom; long identifiers and system font fallback.

### Accessibility

- Automated WCAG scan plus manual keyboard, focus order, semantic tree/table, status not conveyed by color alone, screen-reader labels, and 200% zoom checks.
- Target WCAG 2.2 AA.

### Visual regression

- Reference screenshots for empty intake, shallow plan, deeply nested plan, expanded node details, expert navigation, validation verdict, and mobile layouts.
- Pixel comparison is a warning gate; node/column geometry assertions are blockers.

## Current automated evidence

- Vitest domain rules and enterprise golden plans.
- Playwright complete workflows on Chromium, Firefox, WebKit, Mobile Chromium, and Mobile WebKit.
- Production TEXT parsing, deep-tree geometry, node serial numbering, structural fix comparison, export, conditional expert navigation, privacy boundary, persistence, and malformed-input recovery.

## Remaining release gaps

- Automated accessibility scanner and manual assistive-technology record.
- Screenshot baselines and review workflow.
- 1,000–10,000-node stress fixtures and memory/endurance telemetry.
- File-size boundary automation.
- IndexedDB failure injection and quota-exhaustion handling.
- Fuzz/property tests for malformed TEXT and JSON.
- Independent PostgreSQL SME sign-off on diagnosis thresholds and recommendation wording.

## Release evidence package

Each candidate must include build output, domain results, browser results, stress report, accessibility report, supported-browser matrix, known S2/S3 issues, fixture provenance, and PostgreSQL SME approval for changed diagnostic rules.
