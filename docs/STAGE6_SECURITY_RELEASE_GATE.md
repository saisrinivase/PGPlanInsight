# Stage 6 — Security CI and release gate

## Executive summary

PGPlan Insight now has one repeatable command: `npm run release:gate`. The accepted run passed the production build, 85 unit tests, 120 active workflows across five browser projects, static security checks, an offline production dependency advisory audit, license review, SBOM creation, and independent SHA-256 verification.

This evidence supports the statement **no known exploitable high or critical production dependency finding was reported by the configured gate**. It does not claim that any software is free of all vulnerabilities.

## Security review

No Critical or High code finding was established in the reviewed React/TypeScript application and embedded, bundled Vue/PEV2 surface.

### SEC-001 — Deployment headers must be verified at the hosting edge

- Severity: Medium deployment requirement
- Location: `index.html:6-7`, referrer and Content Security Policy meta elements
- Evidence: The static application enforces `default-src 'self'`, `script-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'none'`, and `form-action 'none'`; `Referrer-Policy` is represented by a `no-referrer` meta policy.
- Impact: Meta CSP cannot enforce `frame-ancestors`, `X-Content-Type-Options`, or other HTTP-only headers.
- Fix: Any public/enterprise host must configure CSP as a response header plus clickjacking, `nosniff`, referrer, and appropriate permissions headers at the web server/CDN.
- Mitigation: The local static build has no backend, authentication, cookies, external API, or cross-origin data transmission. Browser tests verify the current meta policy and no unexpected outbound request.
- False-positive note: These headers may already be supplied by a future hosting platform; verify the deployed response rather than inferring them from this repository.

### SEC-002 — Inline styles are a documented renderer compatibility exception

- Severity: Low
- Location: `index.html:7`, `style-src 'self' 'unsafe-inline'`
- Evidence: PEV2 and plan metric presentation use component-generated inline styles for layout and metric widths. `script-src` does not permit `unsafe-inline` or `unsafe-eval`.
- Impact: `unsafe-inline` weakens style injection protection but does not enable inline JavaScript under the current script policy.
- Fix: Reassess a nonce/hash or CSS-variable-only approach when the renderer is upgraded.
- Mitigation: User plan fields are rendered as text, raw HTML sinks are prohibited by the static gate, and no user-controlled arbitrary style string is accepted.
- False-positive note: Removing the exception without refactoring PEV2 and metric rendering would break plan presentation.

## Supply-chain and artifact evidence

- CI uses `npm ci` against lockfile version 3.
- Registry packages require integrity digests.
- Production licenses are inventoried; Font Awesome asset licensing, PEV2's PostgreSQL license, and the transitive `d3-flextree` license have explicit documented reviews.
- Runtime CDN scripts and dynamic absolute fetches are prohibited.
- The release bundle contains no source maps.
- `dist/release/sbom.cdx.json` contains the local CycloneDX inventory.
- `dist/release/licenses.json` contains license decisions and exceptions.
- `dist/release/release-report.json` contains the machine-readable gate outcome.
- `dist/release/manifest.sha256` hashes every generated release artifact.

## Remaining boundary

The offline advisory audit uses the locally available advisory data. Before a public release, run the same gate in an approved networked CI environment with current registry advisories and verify HTTP security headers at the deployed origin.
