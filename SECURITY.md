# Security policy

Use a current release in a dedicated browser origin. Plans may contain sensitive data; analysis is temporary by default, and saving is explicit. See the installation guide for retention and redaction limitations.

Report suspected vulnerabilities privately to the repository owner using GitHub private vulnerability reporting when enabled. Do not put credentials, real production plans, customer data, or exploit details in public issues. Include the commit, affected workflow and a minimal synthetic reproduction.

Maintainers: enable private vulnerability reporting and Dependabot alerts in repository settings. Run the release gate before releases. No support response time or security certification is promised.

## Local review snapshot — 2026-10-05

This review snapshot is not release approval. Firefox's 2,000-operation Grid performance is tracked as a non-blocking warning until the renderer is optimized.

- The Windows static-scan path failure was fixed and `npm run security:static` passed against 50 first-party source files. The scan does not inspect installed dependency internals.
- Comparison-report plan labels are now whitespace-normalized and escaped for Markdown; the hostile link/HTML regression test passes.
- The production build and 135 unit tests passed. The dedicated browser security suite passed 50 tests across five browser profiles. Full and production npm audits reported zero known advisories at review time.
- The full browser suite did not pass locally: 207 tests passed, 45 retired tests were skipped, and three performance/stress tests failed on Windows. The complete release gate therefore remains unverified; do not treat this snapshot as a green release gate.
- On 2026-10-06, a refreshed npm audit identified high-severity GHSA-68fv-2mgg-jv7q in transitive `source-map-js` 1.2.1. `npm audit fix` updated the lockfile to a patched version; the subsequent full dependency audit reported zero known advisories. This does not retroactively change the prior gate result.
- Follow-up local validation passed 209 browser tests with 45 retired tests skipped, but Firefox's 2,000-operation Grid case exceeded the 30-second performance target (about 38 seconds). Other browser profiles and repeated-navigation stress checks passed. The performance spec now emits an explicit warning and records target/status for this one browser/plan-size pair; all other performance budgets remain blocking. Rerun the complete release gate before making a release claim.
- The locked PEV2 renderer contains an `innerHTML` assignment on its parse-error view. An app-reachable exploit was not established; verify reachability or remediate this dependency boundary before making a no-injection claim.
- Verify HTTP security headers at the actual deployment origin. Meta CSP does not replace response headers such as `frame-ancestors` and `X-Content-Type-Options`.
