import { describe, expect, test } from "vitest";
import { coercionEvidence } from "../src/type-coercion.ts";

describe("type-coercion knowledge rule", () => {
  test("proves a bigint column cast to double precision in a join predicate", () => {
    const result = coercionEvidence([{ source: "Hash Cond", text: "((prod_mv.application_id)::double precision = source.application_id)" }]);
    expect(result).toMatchObject([{ targetType: "double precision", context: "predicate", confidence: "High", operand: "prod_mv.application_id" }]);
  });

  test("captures CAST syntax in an output expression", () => {
    expect(coercionEvidence([{ source: "Output", text: "CAST(application_id AS bigint)" }])).toMatchObject([{ targetType: "bigint", context: "output" }]);
  });

  test("does not flag a typed literal because it does not coerce a column expression", () => {
    expect(coercionEvidence([{ source: "Filter", text: "status = '1'::integer" }])).toEqual([]);
  });

  test("reports both sides when a text join coerces two column expressions", () => {
    expect(coercionEvidence([{ source: "Join Filter", text: "((a.unit_id)::text = (b.unit_id)::text)" }])).toHaveLength(2);
  });
});
