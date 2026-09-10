import { expect, test } from "vitest";
import { analyzePlan } from "../src/analyzer.ts";
import { compareAnalyses } from "../src/compare.ts";

const envelope = (plan: object, time: number) => JSON.stringify([{ Plan: plan, "Execution Time": time, Settings: {} }]);
const scan = { "Node Type": "Seq Scan", "Relation Name": "orders", "Actual Total Time": 80, "Actual Rows": 1000, "Actual Loops": 1, "Plan Rows": 1000 };

test("structural matching survives an inserted branch", () => {
  const before = analyzePlan(envelope({ "Node Type": "Aggregate", "Actual Total Time": 100, "Actual Rows": 1, "Actual Loops": 1, "Plan Rows": 1, Plans: [scan] }, 100));
  const after = analyzePlan(envelope({ "Node Type": "Limit", "Actual Total Time": 40, "Actual Rows": 1, "Actual Loops": 1, "Plan Rows": 1, Plans: [{ "Node Type": "Aggregate", "Actual Total Time": 38, "Actual Rows": 1, "Actual Loops": 1, "Plan Rows": 1, Plans: [{ ...scan, "Actual Total Time": 30 }] }] }, 40));
  const comparison = compareAnalyses(before, after, { sameStatement: true, sameParameters: true, comparableEnvironment: true, repeatedCapture: true });
  expect(comparison.verdict).toBe("Improved");
  expect(comparison.accessPathChanges.some((change) => change.path === "1.1 → 1.1.1" && change.before === "Seq Scan" && change.after === "Seq Scan")).toBe(true);
  expect(comparison.accessPathChanges.some((change) => change.before === "Added" && change.after === "Limit")).toBe(true);
});

test("comparison blocks an improvement claim without equivalent-capture declarations", () => {
  const before = analyzePlan(envelope({ ...scan, "Actual Total Time": 100 }, 100));
  const after = analyzePlan(envelope({ ...scan, "Actual Total Time": 20 }, 20));
  const comparison = compareAnalyses(before, after);
  expect(comparison.runtimeDeltaPercent).toBe(-80);
  expect(comparison.verdict).toBe("Inconclusive");
  expect(comparison.comparability.filter((check) => check.status === "blocker").map((check) => check.id)).toEqual(expect.arrayContaining(["statement", "parameters", "environment"]));
});

test("comparison cannot declare improvement from one unrepeated execution", () => {
  const before = analyzePlan(envelope({ ...scan, "Actual Total Time": 100 }, 100));
  const after = analyzePlan(envelope({ ...scan, "Actual Total Time": 20 }, 20));
  const comparison = compareAnalyses(before, after, { sameStatement: true, sameParameters: true, comparableEnvironment: true, repeatedCapture: false });
  expect(comparison.runtimeDeltaPercent).toBe(-80);
  expect(comparison.verdict).toBe("Inconclusive");
  expect(comparison.comparability.find((check) => check.id === "repeat")).toMatchObject({ status: "blocker" });
});
