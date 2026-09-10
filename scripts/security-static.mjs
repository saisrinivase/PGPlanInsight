import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const failures = [];
const files = [];
const walk = (directory) => {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(?:ts|tsx|js|mjs|html)$/.test(name)) files.push(path);
  }
};
walk(join(root, "src"));
files.push(join(root, "index.html"));

const forbidden = [
  [/dangerouslySetInnerHTML/, "React raw HTML sink"],
  [/\.innerHTML\s*=/, "DOM innerHTML assignment"],
  [/\.outerHTML\s*=/, "DOM outerHTML assignment"],
  [/insertAdjacentHTML\s*\(/, "DOM HTML insertion"],
  [/\bDOMParser\s*\(/, "DOM parser sink requiring review"],
  [/\beval\s*\(/, "eval execution"],
  [/new\s+Function\s*\(/, "dynamic Function execution"],
  [/document\.write\s*\(/, "document.write sink"],
  [/set(?:Timeout|Interval)\s*\(\s*["']/, "string-based timer execution"],
  [/javascript\s*:/i, "javascript URL"],
  [/fetch\s*\(\s*["'](?:https?:)?\/\//i, "absolute outbound fetch"],
  [/\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b/, "credential-like token"],
  [/(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["'][^"']{8,}["']/i, "hard-coded secret"],
];
for (const path of files) {
  const source = readFileSync(path, "utf8");
  for (const [pattern, label] of forbidden) if (pattern.test(source)) failures.push(`${relative(root, path)}: ${label}`);
}

const html = readFileSync(join(root, "index.html"), "utf8");
const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1] ?? "";
for (const directive of ["default-src 'self'", "script-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) if (!csp.includes(directive)) failures.push(`index.html: CSP is missing ${directive}`);
if (!/name="referrer"\s+content="no-referrer"/i.test(html)) failures.push("index.html: no-referrer policy is missing");
if (/<script\b[^>]+src=["']https?:/i.test(html)) failures.push("index.html: runtime third-party script is not permitted");

const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
if (lock.lockfileVersion !== 3) failures.push("package-lock.json: lockfileVersion 3 is required");
for (const [path, item] of Object.entries(lock.packages ?? {})) {
  if (!path || !item || item.link) continue;
  if (typeof item.resolved === "string" && /^https?:/.test(item.resolved) && !item.integrity) failures.push(`${path}: registry package lacks an integrity digest`);
}
if (failures.length) {
  console.error(`Static security gate failed (${failures.length}):\n${failures.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}
console.log(`Static security gate passed: ${files.length} source files, CSP/referrer policy, lockfile integrity, secrets, sinks, and outbound fetch patterns checked.`);
