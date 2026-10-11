# PGPlan Insight v0.6.0 — Clearer evidence workflow

## User-facing improvements

- Numbered analysis destinations now include a short purpose label; desktop Chromium, Firefox, and WebKit are the release browser matrix. Mobile browsers are outside release-validation scope.
- Findings and Planner Diagnostics use clearer text hierarchy: explanations are easier to read, evidence labels are distinct, and measured values use aligned numeric typography.
- Planner access-path and row-estimate evidence can navigate directly to the matching operation in the execution plan.
- A searchable Plan reference explains scans, heap fetches, buffers, temporary I/O, timing, `work_mem`, PostgreSQL types, casts, operator resolution, and collations. Entries expand to show interpretation cautions and links to the official PostgreSQL manual.
- Persistent Dark/Light appearance, including matching embedded PEV2 styling and readable diagnostic panels.
- Windows ZIP quick-start instructions now include the required locked dependency install before launching Vite.
- First-party project code uses the PostgreSQL License; the release distribution includes PEV2, Font Awesome, IBM Plex, and production dependency notices.

## Credits

Plan visualization is provided by [PEV2](https://github.com/dalibo/pev2) v1.23.0. Thank you to [Dalibo](https://dalibo.com/) and the PEV2 contributors. PEV2 is distributed under the PostgreSQL License; required notice text ships in `THIRD_PARTY_NOTICES.md`. Project ownership, product decisions, and release responsibility remain with [@saisrinivase](https://github.com/saisrinivase). GitHub Copilot and OpenAI Codex provided AI-assisted development support; their suggestions were reviewed by the project owner and are not runtime integrations.

## Verification

- 139 unit tests passed.
- Production TypeScript/Vite build passed; the existing large-bundle warning remains.
- Focused Chromium Playwright regressions passed for appearance persistence, PEV2 state preservation, reference filtering/disclosures, and dark/light contrast.
- Hosted desktop release-gate run #54 passed both Windows and macOS jobs on commit `6e38d25`, producing diagnostic-score artifacts for both platforms. The annotated prerelease tag `v0.6.0-rc.1` points to that commit. This candidate is not a published or final release-approved build.
- Subsequent PostgreSQL License/third-party notice audit changes are not covered by run #54 and require a fresh gate before a newer RC or final tag.
- Final release holds: confirm first-party rights-holder authority as recorded in [Copyright and License Review](docs/COPYRIGHT_AND_LICENSE_REVIEW.md), complete the uncoached human pilot in [V1_PILOT.md](docs/V1_PILOT.md), verify HTTP security headers at the selected deployment origin, then freeze and gate the final release commit before creating a final version tag.
