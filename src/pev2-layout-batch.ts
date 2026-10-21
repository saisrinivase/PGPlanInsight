// Read all pending node boxes before publishing any reactive size updates.
// This prevents one size update from invalidating layout before the next read.
export function createMeasurementBatch(schedule: (flush: () => void) => void) {
  const pending = new Map<Element, (rect: DOMRect) => void>();
  let scheduled = false;
  return (element: Element | null | undefined, publish: (rect: DOMRect) => void) => {
    if (!element) return;
    pending.set(element, publish);
    if (scheduled) return;
    scheduled = true;
    schedule(() => {
      const entries = [...pending];
      pending.clear();
      scheduled = false;
      const measurements = entries.filter(([node]) => node.isConnected)
        .map(([node, update]) => ({ node, update, rect: node.getBoundingClientRect() }));
      for (const { node, update, rect } of measurements) if (node.isConnected) update(rect);
    });
  };
}

// A microtask runs after Vue's synchronous mount batch but before the next
// rendering frame/initial auto-fit. Waiting for a frame lets auto-fit see zeros.
export const queueNodeMeasurement = createMeasurementBatch((flush) => queueMicrotask(flush));
