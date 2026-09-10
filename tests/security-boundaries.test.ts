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
