import type { Analysis } from "./types.ts";

let requestId = 0;
let worker: Worker | null = null;

function getWorker(): Worker {
  worker ??= new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

export function analyzeOffThread(source: string): Promise<Analysis> {
  const id = ++requestId;
  const activeWorker = getWorker();
  return new Promise((resolve, reject) => {
    const listener = (event: MessageEvent<{ id: number; analysis?: Analysis; error?: string }>) => {
      if (event.data.id !== id) return;
      activeWorker.removeEventListener("message", listener);
      event.data.analysis ? resolve(event.data.analysis) : reject(new Error(event.data.error ?? "Analysis failed."));
    };
    activeWorker.addEventListener("message", listener);
    activeWorker.postMessage({ id, source });
  });
}
