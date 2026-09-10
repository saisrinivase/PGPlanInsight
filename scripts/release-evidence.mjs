import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
export function sourceDigest() {
  const hash = createHash("sha256");
  const walk = (path) => {
    if (statSync(path).isDirectory()) for (const name of readdirSync(path).sort()) walk(join(path, name));
    else { hash.update(path); hash.update(readFileSync(path)); }
  };
  for (const path of ["src", "public", "scripts", "tests", "security", ".github", "package.json", "package-lock.json", "index.html", "vite.config.ts", "playwright.config.ts", "tsconfig.json"]) walk(path);
  return hash.digest("hex");
}
export function verifiedEvidence() {
  const evidence = JSON.parse(readFileSync("dist/release/gate-evidence.json", "utf8"));
  if (evidence.sourceHash !== sourceDigest()) throw new Error("Source changed or evidence missing. Run npm run release:gate.");
  const age = Date.now() - Date.parse(evidence.checkedAt);
  if (!Number.isFinite(age) || age < 0 || age > 86400_000) throw new Error("Release evidence has expired.");
  if (evidence.lockHash !== createHash("sha256").update(readFileSync("package-lock.json")).digest("hex")) throw new Error("Lockfile differs from verified evidence.");
  if (JSON.stringify(evidence.checks) !== JSON.stringify(["locked install", "unit", "build", "browser", "static"])) throw new Error("Required checks missing.");
  for (const scope of ["production", "all"]) if (evidence.audits?.[scope]?.report?.metadata?.vulnerabilities?.total !== 0) throw new Error("Advisory evidence missing or contains unresolved findings.");
  return evidence;
}
