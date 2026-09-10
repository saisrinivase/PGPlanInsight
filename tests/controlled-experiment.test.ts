import { expect, test } from "vitest";
import { controlledExperiment } from "../src/controlled-experiment.ts";

test("every finding becomes a testable experiment with prerequisites, success, and rollback", () => {
  const experiment = controlledExperiment({ id: "TYPE-001", title: "Type coercion", detail: "cast", severity: "warning", evidence: "Hash Cond cast", nextAction: "Align types" });
  expect(experiment.hypothesis).toMatch(/coercion/i);
  expect(experiment.prerequisites.length).toBeGreaterThan(1);
  expect(experiment.successCriteria.join(" ")).toMatch(/cast disappears/i);
  expect(experiment.rollback).toMatch(/revert/i);
});
