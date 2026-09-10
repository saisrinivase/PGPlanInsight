import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { sourceDigest } from "./release-evidence.mjs";

const run = (command, args) => {
  console.log(`[release gate] ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
// Discard earlier success before any command can fail.
rmSync("dist/release", { recursive: true, force: true });
run("npm", ["ci"]);
const sourceHash = sourceDigest();
run("npm", ["test"]);
run("npm", ["run", "build"]);
run("npm", ["run", "test:e2e"]);
run("node", ["scripts/security-static.mjs"]);
const audits = {};
for (const scope of ["production", "all"]) {
  const args = ["audit", "--json", ...(scope === "production" ? ["--omit=dev"] : [])];
  const result = spawnSync("npm", args, { encoding: "utf8", maxBuffer: 10_000_000 });
  let report;
  try { report = JSON.parse(result.stdout); } catch { throw new Error("Online advisory audit unavailable; release is not verified."); }
  if (result.status !== 0 || report.error || report.metadata?.vulnerabilities?.total !== 0) throw new Error(`Unresolved ${scope} dependency findings or unavailable audit; review before release.`);
  audits[scope] = { checkedAt: new Date().toISOString(), report };
}
if (sourceHash !== sourceDigest()) throw new Error("Source changed during verification. Rerun release gate.");
mkdirSync("dist/release", { recursive: true });
const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
writeFileSync("dist/release/gate-evidence.json", JSON.stringify({ checkedAt: new Date().toISOString(), commit: head.status === 0 ? head.stdout.trim() : null, sourceHash, lockHash: createHash("sha256").update(readFileSync("package-lock.json")).digest("hex"), checks: ["locked install", "unit", "build", "browser", "static"], audits }, null, 2));
run("npm", ["run", "release:artifacts"]);
console.log("PGPlan Insight release gate: PASS");
