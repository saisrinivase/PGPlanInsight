import { describe, expect, it, vi, afterEach } from "vitest";
import { parsePlanInput } from "../src/input-boundary.ts";
import { redactPlanForSharing } from "../src/redact-plan.ts";
import { analyzeOffThread } from "../src/analyze-client.ts";

const valid = JSON.stringify({ Plan: { "Node Type": "Seq Scan", "Relation Name": "customers_private", Filter: "email = 'private@example.com'", "Actual Rows": 2, "Actual Total Time": 3, "Actual Loops": 1 } });
describe("untrusted plan limits", () => {
  it("rejects malformed children and nonnumeric runtime", () => {
    expect(() => parsePlanInput('{"Plan":{"Plans":{}}}')).toThrow(/children must be an array/);
    expect(() => parsePlanInput('{"Plan":{"Actual Rows":"100"}}')).toThrow(/numeric/);
    expect(() => parsePlanInput('{"Plan":{"Actual Rows":1e999}}')).toThrow(/finite/);
  });
  it("rejects depth and breadth before recursive analysis or rendering", () => {
    const nested = '{"Plan":' + '{"Plans":['.repeat(6000) + '{"Node Type":"Result"}' + ']}'.repeat(6000) + '}';
    expect(() => parsePlanInput(nested)).toThrow(/nesting/);
    expect(() => parsePlanInput(JSON.stringify({ Plan: { Plans: Array.from({ length: 2001 }, () => ({ "Node Type": "Result" })) } }))).toThrow(/operation safety/);
  });
  it("counts bytes, not UTF-16 characters", () => {
    expect(() => parsePlanInput('界'.repeat(3_333_334))).toThrow(/10 MB/);
  });
  it("removes secrets, arbitrary fields and identifiers from redaction output", () => {
    const redacted = redactPlanForSharing(valid);
    expect(redacted).not.toMatch(/customers_private|private@example.com|Filter/);
    expect(parsePlanInput(redacted).Plan["Actual Rows"]).toBe(2);
    expect(redacted).toContain("object_1");
  });
  it("rejects whitespace-heavy malformed previews without ambiguous label matching", () => {
    const started = performance.now();
    for (const padding of [" ", "\t", "\u00a0"]) {
      for (const suffix of ["x", "(cost=not-a-number)"]) {
        expect(() => redactPlanForSharing(padding.repeat(20_000) + suffix)).toThrow(/Expected/);
      }
      expect(() => redactPlanForSharing("->" + padding.repeat(20_000) + "(cost=bad)")).toThrow(/Expected/);
      expect(() => redactPlanForSharing("Unknown" + padding.repeat(20_000) + "label (cost=0..1 rows=1 width=8)")).toThrow(/operation type/);
    }
    expect(() => redactPlanForSharing("Result (cost=" + ".".repeat(20_000) + "x)")).toThrow(/Expected/);
    expect(() => redactPlanForSharing("Result (cost=0..1 rows=" + "1".repeat(20_000))).toThrow(/Expected/);
    expect(() => redactPlanForSharing('\"\"' + " ".repeat(100_000) + "x")).toThrow(/Expected/);
    const settingsText = "Result (cost=0..1 rows=1)\nSettings: x=" + " ".repeat(100_000) + "a'x";
    expect(parsePlanInput(settingsText).Settings).toEqual({});
    expect(JSON.parse(redactPlanForSharing(settingsText))[0].Plan["Node Type"]).toBe("Result");
    expect(performance.now() - started).toBeLessThan(1_000);
  });
  it("preserves TEXT metrics, children and redaction after splitting labels", () => {
    const text = 'Nested Loop  (cost=0.00..25.00 rows=2 width=8) (actual time=0.01..3.00 rows=2 loops=1)\n  ->  Index Only Scan using private_idx on private_table  (cost=0.00..5.00 rows=1 width=8) (actual time=0.01..0.02 rows=1 loops=2)';
    const parsed = parsePlanInput(text);
    expect(parsed.Plan["Total Cost"]).toBe(25);
    expect(parsed.Plan["Actual Total Time"]).toBe(3);
    expect(parsed.Plan.Plans?.[0]["Actual Loops"]).toBe(2);
    expect(redactPlanForSharing(text)).not.toMatch(/private_table|private_idx/);
    expect(parsePlanInput(text + "\nSettings: work_mem = '4MB', jit = off").Settings).toEqual({ work_mem: "4MB", jit: "off" });
  });
});
describe("worker recovery", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it("terminates timed-out workers and permits another request", async () => {
    vi.useFakeTimers();
    const workers: Array<{ terminate: ReturnType<typeof vi.fn>; onmessage?: (event: unknown) => void }> = [];
    vi.stubGlobal("Worker", class { terminate = vi.fn(); postMessage = vi.fn(); constructor() { workers.push(this); } });
    const first = analyzeOffThread(valid);
    const rejected = expect(first).rejects.toThrow(/could not finish/);
    await vi.advanceTimersByTimeAsync(15001);
    await rejected;
    expect(workers[0].terminate).toHaveBeenCalled();
    const second = analyzeOffThread(valid);
    workers[1].onmessage?.({ data: { error: "Expected test rejection" } });
    await expect(second).rejects.toThrow("Expected test rejection");
    expect(workers[1].terminate).toHaveBeenCalled();
  });
});
