import type { Analysis } from "./types.ts";

// Each request owns a worker so cancellation/error recovery cannot strand another request.
export function analyzeOffThread(source: string): Promise<Analysis> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
    const finish = () => { clearTimeout(timer); worker.terminate(); };
    const fail = () => { finish(); reject(new Error("Analysis could not finish. Try a smaller plan or retry.")); };
    const timer = setTimeout(fail, 15_000);
    worker.onerror = fail;
    worker.onmessageerror = fail;
    worker.onmessage = (event: MessageEvent<{ analysis?: Analysis; error?: string }>) => {
      finish();
      event.data.analysis ? resolve(event.data.analysis) : reject(new Error(event.data.error ?? "Analysis failed."));
    };
    try { worker.postMessage({ id: 1, source }); } catch { fail(); }
  });
}
