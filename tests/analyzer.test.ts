import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";
import { analyzePlan } from "../src/analyzer.ts";

const fixtureRoot = new URL("../public/samples/", import.meta.url);

test("detects memory spill evidence", () => {
  const result = analyzePlan(readFileSync(new URL("memory_spill_plan.json", fixtureRoot), "utf8"));
  assert.ok(result.findings.some((finding) => finding.id === "MEM-001"));
  assert.equal(result.primarySignal, "Memory / spill");
  assert.ok(result.planMap.some((node) => node.flags.includes("spill")));
  assert.ok(result.planMap.every((node) => node.selfTime >= 0));
});

test("detects loop amplification", () => {
  const result = analyzePlan(readFileSync(new URL("cpu_nested_loop_plan.json", fixtureRoot), "utf8"));
  assert.ok(result.findings.some((finding) => finding.id === "CPU-001"));
});
