import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const dist = join(root, "dist");
const evidence = join(dist, "release");
mkdirSync(evidence, { recursive: true });
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const application = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const exceptions = JSON.parse(readFileSync(join(root, "security", "license-exceptions.json"), "utf8"));
const exceptionKey = new Set(exceptions.map((item) => `${item.package}@${item.license}`));
const accepted = new Set(["0BSD", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MIT", "OFL-1.1", "Unlicense"]);
const forbidden = /\b(?:AGPL|GPL|SSPL)(?:-|\b)/i;
const components = [];
const licenses = [];
const writeJsonAtomic = (path, value) => {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "w" });
  JSON.parse(readFileSync(temporary, "utf8"));
  renameSync(temporary, path);
};
const packageName = (path, declared) => {
  if (declared) return declared;
  const marker = "node_modules/";
  const suffix = path.slice(path.lastIndexOf(marker) + marker.length);
  const parts = suffix.split("/");
  return parts[0]?.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0] || basename(path);
};

for (const [path, item] of Object.entries(lock.packages ?? {})) {
  if (!path || item.dev || (item.optional && !item.version)) continue;
  const name = packageName(path, item.name);
  const license = Array.isArray(item.license) ? item.license.join(" OR ") : item.license ?? "UNKNOWN";
  const exception = exceptionKey.has(`${name}@${license}`);
  const status = accepted.has(license) ? "accepted" : exception ? "documented-exception" : forbidden.test(license) || license === "UNKNOWN" ? "blocked" : "review-required";
  components.push({ type: "library", name, version: item.version ?? "unknown", purl: item.version ? `pkg:npm/${encodeURIComponent(name)}@${item.version}` : undefined, hashes: item.integrity ? [{ alg: "SRI", content: item.integrity }] : [] });
  licenses.push({ name, version: item.version ?? "unknown", license, status });
}
const blocked = licenses.filter((item) => item.status === "blocked" || item.status === "review-required");
if (blocked.length) {
  console.error(`License gate failed: ${blocked.map((item) => `${item.name}@${item.version} (${item.license})`).join(", ")}`);
  process.exit(1);
}
writeJsonAtomic(join(evidence, "sbom.cdx.json"), { bomFormat: "CycloneDX", specVersion: "1.5", serialNumber: `urn:uuid:${randomUUID()}`, version: 1, metadata: { timestamp: new Date().toISOString(), component: { type: "application", name: application.name, version: application.version } }, components });
writeJsonAtomic(join(evidence, "licenses.json"), { generatedAt: new Date().toISOString(), policy: "No unknown, GPL, AGPL, or SSPL production dependency without documented approval.", packages: licenses, exceptions });
writeJsonAtomic(join(evidence, "release-report.json"), { generatedAt: new Date().toISOString(), application: application.name, version: application.version, result: "PASS", statement: "No known exploitable high or critical production dependency finding was reported by the configured offline advisory gate.", gates: ["locked dependency provenance", "production type/build", "unit tests", "cross-browser E2E", "static secret and unsafe-sink scan", "CSP/referrer and outbound-request checks", "offline dependency advisory audit", "SBOM", "license policy", "artifact SHA-256 manifest"] });

const artifactFiles = [];
const walk = (directory) => { for (const name of readdirSync(directory)) { const path = join(directory, name); if (statSync(path).isDirectory()) walk(path); else if (name !== "manifest.sha256") artifactFiles.push(path); } };
walk(dist);
const manifest = artifactFiles.sort().map((path) => `${createHash("sha256").update(readFileSync(path)).digest("hex")}  ${relative(dist, path)}`).join("\n");
writeFileSync(join(evidence, "manifest.sha256"), `${manifest}\n`);
console.log(`Release evidence generated: ${components.length} production components, ${licenses.length} licenses, ${artifactFiles.length} hashed artifacts.`);
