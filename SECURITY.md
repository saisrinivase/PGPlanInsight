# Security policy

Use a current release in a dedicated browser origin. Plans may contain sensitive data; analysis is temporary by default, and saving is explicit. See the installation guide for retention and redaction limitations.

Report suspected vulnerabilities privately to the repository owner using GitHub private vulnerability reporting when enabled. Do not put credentials, real production plans, customer data, or exploit details in public issues. Include the commit, affected workflow and a minimal synthetic reproduction.

Maintainers: enable private vulnerability reporting and Dependabot alerts in repository settings. Run the release gate before releases. No support response time or security certification is promised.

## Current release-candidate status — 2026-10-10

- Fresh local checks on the uncommitted licensing/branding/disclaimer tree: 139 unit tests passed, the production build passed, the static security scan passed 51 first-party source files, and both `npm audit --omit=dev` and `npm audit` reported zero known vulnerabilities. Focused Chromium About-dialog and preview HTTP-header checks passed. These results are not a complete release-gate pass or a guarantee that vulnerabilities do not exist.
- Hosted desktop release gate #54 passed on Windows and macOS for commit `6e38d25`; configured online audits reported no known dependency advisories at that verification time. This is CI evidence, not a security certification.
- The gate applies to annotated prerelease tag `v0.6.0-rc.1`. The current working tree adds the PostgreSQL License and third-party notice packaging after that tag; those changes require a fresh gate before they are included in a candidate.
- Human pilot acceptance and HTTP security-header verification at the deployment origin remain open.
- First-party code uses the PostgreSQL License in the current working tree; see [LICENSE](LICENSE). Bundled component licenses and notices are available in [THIRD_PARTY_NOTICES.md](public/THIRD_PARTY_NOTICES.md); release packaging generates a lockfile-based production dependency inventory and available license texts.
- The first-party static security scan does not inspect dependency internals. PEV2 1.23.0 and bundled rendering dependencies contain HTML insertion APIs. This repository review has not established an exploitable user-input path; do not claim the dependency boundary is proven free of injection risk without a focused reachability review.
- Verify response headers at the actual deployment origin. Meta CSP and local preview checks do not prove production `frame-ancestors`, `X-Content-Type-Options`, or HSTS behavior.

## Historical local review snapshot — 2026-10-05

The following findings and counts describe the local review at that time; they are historical, not the current gate result. Firefox's 2,000-operation Grid performance was tracked as a warning in that review.

- The Windows static-scan path failure was fixed and `npm run security:static` passed against 50 first-party source files. The scan does not inspect installed dependency internals.
- Comparison-report plan labels are now whitespace-normalized and escaped for Markdown; the hostile link/HTML regression test passes.
- The production build and 135 unit tests passed. The dedicated browser security suite passed 50 tests across five browser profiles. Full and production npm audits reported zero known advisories at review time.
- The full browser suite did not pass locally: 207 tests passed, 45 retired tests were skipped, and three performance/stress tests failed on Windows. At that time the complete release gate was unverified.
- On 2026-10-06, a refreshed npm audit identified high-severity GHSA-68fv-2mgg-jv7q in transitive `source-map-js` 1.2.1. `npm audit fix` updated the lockfile to a patched version; the subsequent full dependency audit reported zero known advisories. This does not retroactively change the prior gate result.
- Follow-up local validation passed 209 browser tests with 45 retired tests skipped, but Firefox's 2,000-operation Grid case exceeded the 30-second performance target (about 38 seconds). Other browser profiles and repeated-navigation stress checks passed. The performance spec now emits an explicit warning and records target/status for this one browser/plan-size pair; all other performance budgets remain blocking. Rerun the complete release gate before making a release claim.
- The locked PEV2 renderer contains an `innerHTML` assignment on its parse-error view. An app-reachable exploit was not established; verify reachability or remediate this dependency boundary before making a no-injection claim.
- Verify HTTP security headers at the actual deployment origin. Meta CSP does not replace response headers such as `frame-ancestors` and `X-Content-Type-Options`.
