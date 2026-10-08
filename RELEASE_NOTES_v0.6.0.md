# PGPlan Insight v0.6.0 — Clearer evidence workflow

## User-facing improvements

- Numbered analysis destinations now include a short purpose label, with responsive layouts for desktop, tablet, and phone widths.
- Findings and Planner Diagnostics use clearer text hierarchy: explanations are easier to read, evidence labels are distinct, and measured values use aligned numeric typography.
- Planner access-path and row-estimate evidence can navigate directly to the matching operation in the execution plan.
- A searchable Plan reference explains scans, heap fetches, buffers, temporary I/O, timing, and `work_mem`, with interpretation cautions and links to the official PostgreSQL manual.
- Windows ZIP quick-start instructions now include the required locked dependency install before launching Vite.

## Verification

- 138 unit tests passed.
- Production TypeScript/Vite build passed; the existing large-bundle warning remains.
- Nine focused desktop Playwright workflow tests passed across Chromium, Firefox, and WebKit.
- Windows release-gate validation is pending. Do not treat this candidate as a published or release-approved build until the Windows job passes.
