# Product feedback and next acceptance work

## Delivered UI adjustments

- Temporary analysis is the default; saving requires a retention choice.
- Privacy wording describes browser-local processing without claiming session-only storage.
- Individual deletion and bounded retention reduce accidental persistence.
- Redacted JSON preview removes identifiers/expressions/settings before the user accepts it; reduced evidence is explained.
- Oversized/unreadable files and sample-load failures produce visible errors.
- Corrected the narrow-screen input grid so the textarea receives the available width.
- Preserved PEV2 and the existing diagnosis/navigation surfaces.

## Existing feature usage

Use Plan to inspect work, Findings to form a bounded hypothesis, Database context to qualify catalog assumptions, and Validate fix only with representative parameters and comparable settings/cache/concurrency. The existing validation attestations already cover these boundaries; adding more checkboxes would not prove repeated performance.

The strongest next improvement is importing repeated before/after measurements with medians and variability. Current manual repeated-run attestation is useful but not a statistical measurement. Existing test fixtures cover healthy scans, loops, spills and drift; they are regression evidence, not an independent accuracy benchmark.

## Independent benchmark protocol (not completed)

Collect consented, sanitized real plans across PostgreSQL versions, with provenance, expected observed symptoms, acceptable hypotheses, forbidden claims and missing evidence. Have a DBA review labels independently before using cases for evaluation. Include negative cases and blind holdouts. Measure false-positive findings, missed bottlenecks and uncertainty calibration; compare the same input/evidence in PEV2, pgMustard and pganalyze where their workflows support it. Do not derive expected answers solely from this implementation.

Open decisions: select a project license before advertising reusable open-source rights; enable repository private security reporting; configure and verify actual production response headers. These are not implied by a successful local build.
