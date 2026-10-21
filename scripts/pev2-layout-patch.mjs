import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// PEV2 1.25.0 measures every PlanNode synchronously during mounting. Defer
// measurement in one read phase followed by reactive writes, so sibling size
// updates do not force thousands of alternating writes/reads. No metrics change.
// Fail closed on any upstream change: re-review instead of silently mispatching.
const upstreamHash = "a083980712f85f0b86fac102c2d60442f149eb6d7e1bb9c000503058866c49b3";
const before = "let t = n.value?.getBoundingClientRect();\n\t\t\tt && b?.(e, [t.width, t.height]);";
const after = "pgplanMeasure(n.value, (t) => b?.(e, [t.width, t.height]));";
export const measurementImport = `import { queueNodeMeasurement as pgplanMeasure } from ${JSON.stringify(fileURLToPath(new URL("../src/pev2-layout-batch.ts", import.meta.url)).replaceAll("\\", "/"))};\n`;

export function deferPev2NodeMeasurement(source) {
  if (createHash("sha256").update(source).digest("hex") !== upstreamHash
      || source.split(before).length !== 2
      || !source.includes('__name: "PlanNode"')) {
    throw new Error("PEV2 layout compatibility patch requires review for this upstream build.");
  }
  return measurementImport + source.replace(before, after);
}

export function pev2LayoutPatch() {
  return {
    name: "pgplan-pev2-batched-mount-measurement",
    enforce: "pre",
    transform(source, id) {
      if (!id.replaceAll("\\", "/").endsWith("/node_modules/pev2/dist/pev2.es.js")) return null;
      return { code: deferPev2NodeMeasurement(source), map: null };
    },
  };
}
