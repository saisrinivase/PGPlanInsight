import { analyzePlan } from "./analyzer.ts";

self.onmessage = (event: MessageEvent<{ id: number; source: string }>) => {
  try {
    self.postMessage({ id: event.data.id, analysis: analyzePlan(event.data.source) });
  } catch (error) {
    self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : "Analysis failed." });
  }
};
