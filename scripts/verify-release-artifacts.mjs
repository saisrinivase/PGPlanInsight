import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = process.argv[2] ? resolve(process.argv[2]) : join(root, "dist");
const release = join(dist, "release");
const expectedGates = [
  "locked dependency provenance",
  "production type/build",
  "unit tests",
  "cross-browser E2E",
  "static secret and unsafe-sink scan",
  "CSP/referrer and outbound-request checks",
  "offline dependency advisory audit",
  "SBOM",
  "license policy",
  "artifact SHA-256 manifest",
];

const fail = (message) => { console.error(`Release artifact verification failed: ${message}`); process.exit(1); };
const readRequired = (path) => {
  if (!existsSync(path) || statSync(path).size === 0) fail(`${relative(dist, path)} is missing or empty.`);
  return readFileSync(path, "utf8");
};
const parseRequiredJson = (path) => {
  try { return JSON.parse(readRequired(path)); }
  catch (error) { fail(`${relative(dist, path)} is not valid JSON: ${error instanceof Error ? error.message : "parse error"}`); }
};

const reportPath = join(release, "release-report.json");
const report = parseRequiredJson(reportPath);
if (report.result !== "PASS") fail("release-report.json does not report PASS.");
if (report.version !== "0.5.0") fail(`release-report.json has unexpected version ${String(report.version)}.`);
if (JSON.stringify(report.gates) !== JSON.stringify(expectedGates)) fail("release-report.json does not contain the ten canonical gates in order.");
parseRequiredJson(join(release, "sbom.cdx.json"));
parseRequiredJson(join(release, "licenses.json"));

const index = readRequired(join(dist, "index.html"));
if (/\/src\/main\.tsx/.test(index)) fail("index.html still references the Vite development entry point.");
const assetReferences = [...index.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
if (!assetReferences.some((path) => /-[A-Za-z0-9_-]{8}\.js$/.test(path)) || !assetReferences.some((path) => /-[A-Za-z0-9_-]{8}\.css$/.test(path))) fail("index.html does not reference hashed production JavaScript and CSS.");
for (const reference of assetReferences) if (!existsSync(join(dist, reference.slice(1)))) fail(`index.html references missing asset ${reference}.`);

const files = [];
const walk = (directory) => { for (const name of readdirSync(directory)) { const path = join(directory, name); statSync(path).isDirectory() ? walk(path) : files.push(path); } };
walk(dist);
const duplicate = files.find((path) => /(?:[ -]\d+)\.[^.]+$/.test(basename(path)));
if (duplicate) fail(`duplicate suffixed artifact remains: ${relative(dist, duplicate)}.`);
if (!files.some((path) => /ibm-plex-sans.*\.woff2?$/.test(basename(path)))) fail("IBM Plex Sans production font assets are missing.");

const manifestPath = join(release, "manifest.sha256");
const manifestLines = readRequired(manifestPath).trim().split("\n");
const manifestEntries = new Map();
for (const line of manifestLines) {
  const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
  if (!match) fail(`invalid manifest line: ${line}`);
  if (manifestEntries.has(match[2])) fail(`duplicate manifest entry: ${match[2]}`);
  manifestEntries.set(match[2], match[1]);
}
for (const path of files.filter((path) => path !== manifestPath)) {
  const name = relative(dist, path);
  const expected = manifestEntries.get(name);
  if (!expected) fail(`manifest entry missing for ${name}.`);
  const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (actual !== expected) fail(`SHA-256 mismatch for ${name}.`);
}
if (!manifestEntries.has(relative(dist, reportPath))) fail("release-report.json is not covered by manifest.sha256.");

console.log(`Release artifacts verified: ${files.length} files, ${manifestEntries.size} hashes, valid production index, no suffixed duplicates.`);
