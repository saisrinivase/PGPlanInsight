import { useEffect, useRef } from "react";
import { createApp, h } from "vue";
import { Plan } from "pev2";
import { dom as fontAwesomeDom } from "@fortawesome/fontawesome-svg-core";
import bootstrapCss from "bootstrap/dist/css/bootstrap.min.css?inline";
import pev2Css from "pev2/dist/pev2.css?inline";
import { normalizeTextPlanClipboard } from "../input-boundary.ts";

function rendererSource(source: string) {
  try {
    JSON.parse(source);
    return source;
  } catch {
    return normalizeTextPlanClipboard(source);
  }
}

export function Pev2Renderer({ planSource }: { planSource: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    shadow.replaceChildren();
    const style = document.createElement("style");
    style.textContent = `${fontAwesomeDom.css()}\n${bootstrapCss}\n${pev2Css}\n
      :host { display:block; min-height:680px; color:#172a34; font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif; }
      *, *::before, *::after { box-sizing:border-box; }
      #pev2-root { position:relative; min-height:680px; height:calc(100vh - 250px); background:#fff; overflow:hidden; }
      #pev2-root > div { min-height:100%; }
      .nav-tabs { padding-inline:16px; background:#f7f9fb; border-bottom-color:#cbd5e1; }
      .nav-link { color:#356978; font-weight:600; }
      .nav-link.active { color:#164f61 !important; }
      .plan-container, .plan-diagram, .diagram-container { font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif !important; }
      .plan-container, .diagram-container { background:#f8f9f7 !important; }
      .plan-grid { background:#fff !important; }
      #pev2-root.pgplan-grid-view { height:auto !important; overflow:visible !important; }
      #pev2-root.pgplan-grid-view .plan-container,
      #pev2-root.pgplan-grid-view .plan-container .tab-content,
      #pev2-root.pgplan-grid-view .plan-container .tab-pane,
      #pev2-root.pgplan-grid-view .plan-container .tab-pane > div { height:auto !important; overflow:visible !important; }
      #pev2-root.pgplan-source-view { height:auto !important; overflow:visible !important; }
      #pev2-root.pgplan-source-view .plan-container,
      #pev2-root.pgplan-source-view .plan-container .tab-content,
      #pev2-root.pgplan-source-view .plan-container .tab-pane.active,
      #pev2-root.pgplan-source-view .plan-container .tab-pane.active > div { height:auto !important; overflow:visible !important; }
      #pev2-root.pgplan-plan-view { height:auto !important; overflow:visible !important; }
      #pev2-root.pgplan-plan-view .plan-container,
      #pev2-root.pgplan-plan-view .plan-container .tab-content,
      #pev2-root.pgplan-plan-view .plan-container .tab-pane.active,
      #pev2-root.pgplan-plan-view .plan-container .tab-pane.active > div,
      #pev2-root.pgplan-plan-view .splitpanes,
      #pev2-root.pgplan-plan-view .splitpanes__pane { height:auto !important; min-height:680px; overflow:visible !important; }
      .plan-container .tab-pane.active pre { max-width:100%; white-space:pre-wrap !important; overflow-wrap:anywhere; word-break:break-word; }
      .plan-grid .pgplan-grid-note {
        padding:8px 12px;
        border-bottom:1px solid #cbd5e1;
        background:#eef4f7;
        color:#526579;
        font:11px/1.4 "Segoe UI",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
      }
      .plan-grid thead { background:#f7f9fb !important; box-shadow:0 1px 0 #9aabb7; }
      .plan-grid thead th { padding-top:7px !important; padding-bottom:7px !important; color:#324a5b; font-weight:700; }
      .plan-grid tbody tr.node { min-height:34px; }
      .plan-grid tbody tr.node:hover { background:#eef5f8; }
      .pgplan-io-note {
        margin:8px 0 0;
        padding:7px 8px;
        border-top:1px solid #cbd5e1;
        background:#f8fafc;
        color:#526579;
        font:12px/1.4 "Segoe UI",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
      }
      .pgplan-io-note strong { color:#24364b; }
      .plan-stats:has(.stat-dropdown-container) {
        position:absolute !important;
        z-index:100 !important;
        inset:0 !important;
        display:block !important;
        padding:34px !important;
        overflow:auto !important;
        border:0 !important;
        background:#f8faf9 !important;
      }
      .plan-stats:has(.stat-dropdown-container) > div { display:none !important; }
      .plan-stats:has(.stat-dropdown-container) > div:has(> .stat-dropdown-container) {
        display:block !important;
        position:static !important;
        padding:0 !important;
        border:0 !important;
      }
      .plan-stats:has(.stat-dropdown-container) > div:has(> .stat-dropdown-container) > :not(.stat-dropdown-container) {
        display:none !important;
      }
      .plan-stats .stat-dropdown-container {
        position:static !important;
        width:min(760px, 100%) !important;
        max-height:none !important;
        margin:0 auto !important;
        padding:22px 24px !important;
        border:1px solid #b9c7cb !important;
        border-radius:0 !important;
        background:#fff !important;
        box-shadow:none !important;
      }
      .plan-stats .stat-dropdown-container h3 { margin:0 42px 18px 0 !important; padding-bottom:10px !important; font-size:21px !important; }
      .plan-stats .stat-dropdown-container .btn-close { width:34px !important; height:34px !important; border:1px solid #c1cccf !important; border-radius:0 !important; }
      @media (min-width: 700px) {
        .plan-container .splitpanes--vertical > .splitpanes__pane:first-child {
          min-width: clamp(430px, 34vw, 520px) !important;
        }
        .plan-container .splitpanes--vertical > .splitpanes__splitter {
          width: 9px !important;
          border-left:1px solid #cbd5e1 !important;
          border-right:1px solid #e2e8f0 !important;
        }
      }
      @media (max-width: 699px) {
        #pev2-root { height:900px; }
        .plan-container .splitpanes--vertical {
          flex-direction:column !important;
          overflow:auto !important;
        }
        .plan-container .splitpanes--vertical > .splitpanes__pane:first-child {
          flex:0 0 390px !important;
          width:100% !important;
          min-height:390px !important;
          overflow:auto !important;
        }
        .plan-container .splitpanes--vertical > .splitpanes__splitter {
          display:none !important;
        }
        .plan-container .splitpanes--vertical > .splitpanes__pane.plan {
          flex:0 0 480px !important;
          width:100% !important;
          min-height:480px !important;
        }
        .plan-stats:has(.stat-dropdown-container) { padding:16px !important; }
        .plan-stats .stat-dropdown-container { padding:18px !important; }
      }
      @media (min-width: 700px) and (max-width: 800px) { #pev2-root { height:720px; } }
    `;
    const mount = document.createElement("div");
    mount.id = "pev2-root";
    shadow.append(style, mount);
    const app = createApp({ render: () => h(Plan, { planSource: rendererSource(planSource), planQuery: "" }) });
    app.mount(mount);
    const enhanceRenderedViews = () => {
      const grid = shadow.querySelector<HTMLElement>(".plan-grid");
      mount.classList.toggle("pgplan-grid-view", Boolean(grid));
      mount.classList.toggle("pgplan-source-view", Boolean(shadow.querySelector(".tab-pane.active pre")));
      mount.classList.toggle("pgplan-plan-view", Boolean(shadow.querySelector(".tab-pane.active .plan-diagram")));
      if (grid) {
        const headerRows = grid.querySelectorAll<HTMLTableRowElement>("thead tr");
        const leafHeaders = headerRows.item(headerRows.length - 1)?.querySelectorAll<HTMLTableCellElement>("th");
        const firstHeader = leafHeaders?.item(0);
        const operationHeader = Array.from(leafHeaders ?? []).find((header) => header.style.width === "100%");
        if (firstHeader && !firstHeader.textContent?.trim()) firstHeader.textContent = "node";
        if (operationHeader && !operationHeader.textContent?.trim()) operationHeader.textContent = "operation";
        Array.from(leafHeaders ?? []).forEach((header) => {
          if (header.textContent?.trim().toLowerCase() === "writ") header.textContent = "write";
          if (header.textContent?.trim().toLowerCase() === "estim") header.textContent = "estimate";
        });
        if (!grid.querySelector("[data-pgplan-grid-note]")) {
          const note = document.createElement("div");
          note.className = "pgplan-grid-note";
          note.dataset.pgplanGridNote = "true";
          note.textContent = "Every plan operation is listed below. Metric columns appear only when that evidence was captured; scroll down to reach remaining nodes.";
          grid.prepend(note);
        }
      }
      shadow.querySelectorAll<HTMLElement>(".stat-dropdown-container").forEach((panel) => {
        if (!panel.textContent?.includes("I/O Timings") || panel.querySelector("[data-pgplan-io-note]")) return;
        const note = document.createElement("p");
        note.className = "pgplan-io-note";
        note.dataset.pgplanIoNote = "true";
        const heading = document.createElement("strong");
        heading.textContent = "How to read this:";
        note.append(heading, document.createTextNode(" Read = measured wait to fetch table/index blocks. Write = measured wait to flush blocks. A dash means no timing was reported, not necessarily no writes. Requires I/O timing collection."));
        panel.append(note);
      });
    };
    const observer = new MutationObserver(enhanceRenderedViews);
    observer.observe(mount, { attributes: true, childList: true, subtree: true, attributeFilter: ["class"] });
    type TippyHandle = {
      reference?: Element;
      hide?: () => void;
      setProps?: (props: Record<string, unknown>) => void;
      state?: { isVisible?: boolean };
    };
    const rendererTooltips = () => Array.from(document.querySelectorAll<HTMLElement>("body > [data-tippy-root]"))
      .map((root) => ({ root, tip: (root as HTMLElement & { _tippy?: TippyHandle })._tippy }))
      .filter(({ tip }) => tip?.reference?.getRootNode() === shadow);
    const dismissTooltips = (except?: TippyHandle) => {
      rendererTooltips().forEach(({ tip }) => { if (tip && tip !== except) tip.hide?.(); });
    };
    const normalizeTooltips = () => {
      const tooltips = rendererTooltips();
      const newest = tooltips.at(-1)?.tip;
      tooltips.forEach(({ tip }) => {
        tip?.setProps?.({ duration: [80, 0], delay: [120, 0], hideOnClick: true, interactive: false });
        if (tip && tip !== newest && tip.state?.isVisible) tip.hide?.();
      });
    };
    const tooltipObserver = new MutationObserver(normalizeTooltips);
    tooltipObserver.observe(document.body, { childList: true });
    const dismissOnInteraction = () => dismissTooltips();
    shadow.addEventListener("click", dismissOnInteraction, true);
    shadow.addEventListener("scroll", dismissOnInteraction, true);
    document.addEventListener("pointerdown", dismissOnInteraction, true);
    enhanceRenderedViews();
    return () => {
      dismissTooltips();
      observer.disconnect();
      tooltipObserver.disconnect();
      shadow.removeEventListener("click", dismissOnInteraction, true);
      shadow.removeEventListener("scroll", dismissOnInteraction, true);
      document.removeEventListener("pointerdown", dismissOnInteraction, true);
      app.unmount();
      shadow.replaceChildren();
    };
  }, [planSource]);

  return <div className="pev2-renderer" ref={hostRef} data-testid="pev2-renderer" />;
}
