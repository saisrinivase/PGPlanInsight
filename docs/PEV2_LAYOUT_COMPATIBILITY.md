# PEV2 1.25.0 layout compatibility

The Vite plugin in `scripts/pev2-layout-patch.mjs` replaces only PlanNode's synchronous bounding-box read/publication with `queueNodeMeasurement` from `src/pev2-layout-batch.ts`. The exact upstream module SHA-256 and single replacement site are checked. An upstream change fails the build until reviewed. No installed dependency file is modified; locked package integrity remains verifiable. Development excludes PEV2 from prebundling so both development and production apply the same transform.

## Cause and change

CPU sampling of a synthetic 2,000-node plan showed most samples in PlanNode's `getBoundingClientRect()`. Each read followed reactive size changes that invalidated layout before the next read. Waiting for nextTick alone did not remove the bottleneck and was discarded.

The replacement queues measurements for one microtask after the synchronous Vue mount batch, reads connected nodes' actual bounding boxes, then publishes all sizes. This runs before initial auto-fit; waiting for an animation frame lets auto-fit see unmeasured nodes. Requests for one element are coalesced; disconnected elements are ignored. No dimensions are guessed and no global DOM API is overridden. Plan metrics, parsing, diagnostic rules and runtime thresholds are unchanged. Graph-pane clipping also prevents WebKit's SVG node content intercepting outline interactions.

Local CPU-throttled (4×) profiling: renderer-to-Grid completion fell from 42.7 seconds to 14.0 seconds; ordinary-profile measurements fell from approximately 9.1 to 3.5 seconds. These are local synthetic samples, not production latency guarantees. The existing 30-second Chromium release budget is unchanged.

## Verification

Unit tests cover read-before-write ordering, coalescing, disconnected nodes, next-frame scheduling, exact upstream guarding, duplicate patch rejection, Windows path matching and unrelated modules. Browser regression checks graph separation before/after node-detail expansion and Plan/Grid switching on Chromium, Firefox and WebKit.

Full local and exact-commit hosted release gates remain required. Never use this patch as a substitute for testing a future PEV2 upgrade. Retain Dalibo's license/attribution and disclose the modification in shipped third-party notices. Reassess/remove the transform when upstream provides equivalent batching.

Visual comparison found dense SVG trees can display overlapping node text when zoomed out in WebKit, including with the unmodified upstream renderer. This existing issue is not certified fixed by batching. Use Grid/Raw for complete evidence, or Chromium/Firefox for graphical review. Experimental SVG wrapper/height changes were discarded, not shipped. Pane clipping prevents graph nodes intercepting outline interaction.
