import { afterEach, expect, test } from "vitest";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const source = fileURLToPath(new URL("../", import.meta.url));
const fixtures = [];
afterEach(() => { for (const path of fixtures.splice(0)) rmSync(path, { recursive: true, force: true }); });

test("release artifacts generate and verify under a native path with spaces and percent signs", () => {
  const root = mkdtempSync(join(tmpdir(), "pgplan release % fixture-"));
  fixtures.push(root);
  for (const dir of ["scripts", "security", "dist/assets"]) mkdirSync(join(root, dir), { recursive: true });
  for (const name of ["release-artifacts.mjs", "verify-release-artifacts.mjs"]) copyFileSync(join(source, "scripts", name), join(root, "scripts", name));
  // Isolated packaging fixture, NOT evidence that real release gates passed.
  // Production verifiedEvidence remains unchanged and is never bypassed in CI releases.
  writeFileSync(join(root, "scripts/release-evidence.mjs"), 'import {readFileSync} from "node:fs"; export function verifiedEvidence() { return JSON.parse(readFileSync("dist/release/gate-evidence.json", "utf8")); }');
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "packaging-test-only", version: "0.5.0" }));
  writeFileSync(join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: {} }));
  writeFileSync(join(root, "security/license-exceptions.json"), "[]");
  writeFileSync(join(root, "dist/index.html"), '<script src="/assets/app-abcd1234.js"></script><link href="/assets/app-abcd1234.css" rel="stylesheet">');
  for (const name of ["app-abcd1234.js", "app-abcd1234.css", "ibm-plex-mono-test.woff2"]) writeFileSync(join(root, "dist/assets", name), "synthetic fixture");
  const run = (script) => spawnSync(process.execPath, [join(root, "scripts", script)], { cwd: root, encoding: "utf8", shell: false });
  expect(run("release-artifacts.mjs").status).not.toBe(0);
  mkdirSync(join(root, "dist/release"));
  writeFileSync(join(root, "dist/release/gate-evidence.json"), JSON.stringify({ sourceHash: "fixture", lockHash: "fixture", checkedAt: "fixture", audits: { production: { report: { metadata: { vulnerabilities: { total: 0 } } } }, all: { report: { metadata: { vulnerabilities: { total: 0 } } } } } }));
  const generated = run("release-artifacts.mjs");
  expect(generated.stderr).toBe("");
  expect(generated.status).toBe(0);
  const verified = run("verify-release-artifacts.mjs");
  expect(verified.stderr).toBe("");
  expect(verified.status).toBe(0);
  const report = JSON.parse(readFileSync(join(root, "dist/release/release-report.json"), "utf8"));
  expect(report.application).toBe("packaging-test-only");
  expect(report.gates).toHaveLength(10);
  writeFileSync(join(root, "dist/assets/app-abcd1234.js"), "tampered fixture");
  expect(run("verify-release-artifacts.mjs").stderr).toContain("SHA-256 mismatch");
});
