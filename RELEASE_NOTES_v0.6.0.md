# PGPlan Insight v0.6.0 — Clearer evidence workflow

## User-facing improvements

- Numbered analysis destinations now include a short purpose label; desktop Chromium, Firefox, and WebKit are the release browser matrix. Mobile browsers are outside release-validation scope.
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
- Focused Chromium Playwright regressions passed for appearance persistence, PEV2 state preservation, reference filtering/disclosures, and dark/light contrast.
- Hosted desktop release-gate run #52 passed both Windows and macOS jobs on commit `015d031`, producing two CI artifacts. Any subsequent source change requires a fresh gate on that exact commit. This candidate is not a published or release-approved build.
- Release holds: complete the uncoached human pilot in [V1_PILOT.md](docs/V1_PILOT.md), verify HTTP security headers at the selected deployment origin, then freeze and gate the final release commit before tagging.
