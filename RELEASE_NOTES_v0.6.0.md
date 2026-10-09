# PGPlan Insight v0.6.0 — Clearer evidence workflow

## User-facing improvements

- Numbered analysis destinations now include a short purpose label, with responsive layouts for desktop, tablet, and phone widths.
- Findings and Planner Diagnostics use clearer text hierarchy: explanations are easier to read, evidence labels are distinct, and measured values use aligned numeric typography.
- Planner access-path and row-estimate evidence can navigate directly to the matching operation in the execution plan.
- A searchable Plan reference explains scans, heap fetches, buffers, temporary I/O, timing, `work_mem`, PostgreSQL types, casts, operator resolution, and collations. Entries expand to show interpretation cautions and links to the official PostgreSQL manual.
- Persistent Dark/Light appearance, including matching embedded PEV2 styling and readable diagnostic panels.
- Windows ZIP quick-start instructions now include the required locked dependency install before launching Vite.

## Credits

Plan visualization is provided by [PEV2](https://github.com/dalibo/pev2) v1.23.0. Thank you to [Dalibo](https://dalibo.com/) and the PEV2 contributors. PEV2 is distributed under the PostgreSQL License; its license notice is included with the dependency. Project ownership, product decisions, and release responsibility remain with [@saisrinivase](https://github.com/saisrinivase). GitHub Copilot and OpenAI Codex provided AI-assisted development support; their suggestions were reviewed by the project owner and are not runtime integrations.

## Verification

- 139 unit tests passed.
- Production TypeScript/Vite build passed; the existing large-bundle warning remains.
- Focused Chromium Playwright regressions passed for appearance persistence, PEV2 state preservation, reference filtering/disclosures, and dark/light contrast. The full hosted Windows/macOS release gate remains the cross-platform acceptance check.
- Hosted release-gate run #50 for commit `dfa1bf5` was in progress when these notes were updated; this documentation change will trigger a new run. Do not treat this candidate as published or release-approved until the Windows and macOS jobs pass on the final candidate commit.
