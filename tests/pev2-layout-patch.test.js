import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { deferPev2NodeMeasurement, pev2LayoutPatch, measurementImport } from "../scripts/pev2-layout-patch.mjs";
import { createMeasurementBatch } from "../src/pev2-layout-batch.ts";

const source = readFileSync(new URL("../node_modules/pev2/dist/pev2.es.js", import.meta.url), "utf8");
test("PEV2 defers node measurements without changing node metric calculations", () => {
  const patched = deferPev2NodeMeasurement(source);
  expect(patched.slice(measurementImport.length).replace("pgplanMeasure(n.value, (t) => b?.(e, [t.width, t.height]));", "let t = n.value?.getBoundingClientRect();\n\t\t\tt && b?.(e, [t.width, t.height]);")).toBe(source);
});
test("all layout reads precede reactive writes, with duplicate and disconnected requests handled", () => {
  const frames = [], events = [];
  const queue = createMeasurementBatch((flush) => frames.push(flush));
  const node = (id, isConnected=true) => ({ isConnected, getBoundingClientRect: () => {events.push(`read ${id}`); return {width:id,height:10};} });
  const first=node(1), second=node(2), removed=node(3,false);
  queue(first, () => events.push("obsolete"));
  queue(first, (rect) => events.push(`write ${rect.width}`));
  queue(second, (rect) => events.push(`write ${rect.width}`));
  queue(removed, () => events.push("removed"));
  expect(frames).toHaveLength(1);
  expect(events).toEqual([]);
  frames.shift()();
  expect(events).toEqual(["read 1","read 2","write 1","write 2"]);
  queue(first, () => {});
  expect(frames).toHaveLength(1);
});
test("unreviewed upstream changes and duplicate application fail closed", () => {
  expect(() => deferPev2NodeMeasurement(source + "\n")).toThrow(/requires review/);
  expect(() => deferPev2NodeMeasurement(deferPev2NodeMeasurement(source))).toThrow(/requires review/);
});
test("transform handles Windows paths and ignores unrelated source", () => {
  const plugin = pev2LayoutPatch();
  expect(plugin.transform(source, "D:\\repo\\node_modules\\pev2\\dist\\pev2.es.js").code).toBe(deferPev2NodeMeasurement(source));
  expect(plugin.transform(source, "/repo/src/component.js")).toBeNull();
});
