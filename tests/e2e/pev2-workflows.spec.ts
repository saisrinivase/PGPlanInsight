import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = (name: string) => readFileSync(new URL(`../enterprise_plans/${name}.json`, import.meta.url), "utf8");
const quotedParallelPlan = readFileSync(new URL("../quoted-parallel-plan.txt", import.meta.url), "utf8");
const productionNestedLoopPlan = readFileSync(new URL("../production-nested-loop-plan.txt", import.meta.url), "utf8");
const coercionPlan = `PostgreSQL 16.4
Hash Join  (cost=1.00..500.00 rows=10 width=8) (actual time=0.100..210.000 rows=10 loops=1)
  Hash Cond: ((prod_mv.application_id)::double precision = source.application_id)
  Buffers: shared hit=40 read=1200
  ->  Seq Scan on prod_mv  (cost=0.00..400.00 rows=100000 width=8) (actual time=0.010..180.000 rows=100000 loops=1)
        Output: (application_id)::double precision
        Buffers: shared hit=40 read=1200
  ->  Hash  (cost=0.50..0.50 rows=10 width=8) (actual time=0.020..0.020 rows=10 loops=1)
Planning Time: 0.300 ms
Execution Time: 211.000 ms`;

async function analyze(page: import("@playwright/test").Page, source: string, title: string) {
  await page.goto("/");
  await page.getByLabel("Case name").fill(title);
  await page.getByLabel("Plan evidence").fill(source);
  await page.getByRole("button", { name: /Analyze plan/ }).click();
  await expect(page.getByTestId("pev2-renderer")).toBeVisible({ timeout: 15_000 });
}

test("PEV2 is the primary renderer with plan modes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample plan" }).click();
  await expect(page.getByTestId("pev2-renderer")).toBeVisible();
  for (const name of ["Plan", "Grid new", "Raw", "Stats"]) await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /PEV2 1\.23\.0/ })).toBeVisible();
  const iconSizes = await page.getByTestId("pev2-renderer").evaluate((host) =>
    Array.from(host.shadowRoot?.querySelectorAll<SVGElement>("svg.svg-inline--fa") ?? []).map((icon) => {
      const box = icon.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }),
  );
  expect(iconSizes.length).toBeGreaterThan(0);
  expect(iconSizes.every(({ width, height }) => width <= 32 && height <= 32)).toBe(true);
  await page.getByRole("link", { name: "Grid new" }).click();
  await expect(page.getByTestId("pev2-renderer")).toBeVisible();
});

test("dense Grid labels its columns and keeps every operation reachable", async ({ page }) => {
  await analyze(page, productionNestedLoopPlan, "Dense Grid completeness");
  await page.getByRole("link", { name: /Grid/ }).click();
  const renderer = page.getByTestId("pev2-renderer");
  await expect(renderer.getByText("Every plan operation is listed below.")).toBeVisible();
  await expect(renderer.locator(".plan-grid thead th").filter({ hasText: "node" })).toBeVisible();
  await expect(renderer.locator(".plan-grid thead th").filter({ hasText: "operation" })).toBeVisible();
  const rows = renderer.locator(".plan-grid tr.node");
  expect(await rows.count()).toBeGreaterThan(25);
  const layout = await renderer.evaluate((host) => ({ hostHeight: host.getBoundingClientRect().height, gridHeight: host.shadowRoot!.querySelector<HTMLElement>(".plan-grid")!.getBoundingClientRect().height }));
  expect(layout.hostHeight).toBeGreaterThanOrEqual(layout.gridHeight);
  await rows.last().click();
  await expect(rows.last()).toBeVisible();
});

test("dense Raw content expands fully and wraps long source lines", async ({ page }) => {
  await analyze(page, productionNestedLoopPlan, "Dense Raw completeness");
  await page.getByRole("link", { name: "Raw", exact: true }).click();
  const renderer = page.getByTestId("pev2-renderer");
  const raw = renderer.locator(".tab-pane.active pre");
  await expect(raw).toBeVisible();
  const layout = await renderer.evaluate((host) => {
    const root = host.shadowRoot!;
    const rawElement = root.querySelector<HTMLElement>(".tab-pane.active pre")!;
    return {
      hostHeight: host.getBoundingClientRect().height,
      rawBottom: rawElement.getBoundingClientRect().bottom,
      hostTop: host.getBoundingClientRect().top,
      textLength: rawElement.textContent?.length ?? 0,
      whiteSpace: getComputedStyle(rawElement).whiteSpace,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(layout.textLength).toBeGreaterThan(5_000);
  expect(layout.hostHeight).toBeGreaterThanOrEqual(layout.rawBottom - layout.hostTop);
  expect(layout.whiteSpace).toBe("pre-wrap");
  expect(layout.documentOverflow).toBeLessThanOrEqual(0);
});

test("dense Plan outline and graph expand without clipping final nodes", async ({ page }) => {
  await analyze(page, productionNestedLoopPlan, "Dense Plan completeness");
  const renderer = page.getByTestId("pev2-renderer");
  const rows = renderer.locator(".plan-diagram tr.node");
  expect(await rows.count()).toBeGreaterThan(25);
  const layout = await renderer.evaluate((host) => {
    const root = host.shadowRoot!;
    const outline = root.querySelector<HTMLElement>(".plan-diagram")!;
    return {
      planMode: root.querySelector("#pev2-root")?.classList.contains("pgplan-plan-view"),
      hostHeight: host.getBoundingClientRect().height,
      outlineBottom: outline.getBoundingClientRect().bottom,
      hostTop: host.getBoundingClientRect().top,
      rootOverflow: getComputedStyle(root.querySelector<HTMLElement>("#pev2-root")!).overflow,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(layout.planMode).toBe(true);
  expect(layout.hostHeight).toBeGreaterThanOrEqual(layout.outlineBottom - layout.hostTop);
  expect(layout.rootOverflow).toBe("visible");
  expect(layout.documentOverflow).toBeLessThanOrEqual(0);
  await rows.last().click();
  await expect(rows.last()).toBeVisible();
});

test("Plan, Findings, and Planner diagnostics share one interface typeface", async ({ page }) => {
  await analyze(page, productionNestedLoopPlan, "Typography consistency");
  const renderer = page.getByTestId("pev2-renderer");
  const planFont = await renderer.evaluate((host) =>
    getComputedStyle(host.shadowRoot!.querySelector<HTMLElement>(".plan-container")!).fontFamily,
  );
  expect(planFont).toContain("IBM Plex Sans");

  await page.getByRole("button", { name: "Findings", exact: true }).click();
  const findingsFont = await page.getByRole("heading", { name: "Findings" }).evaluate((element) => getComputedStyle(element).fontFamily);
  expect(findingsFont).toContain("IBM Plex Sans");

  await page.getByRole("button", { name: "Planner diagnostics", exact: true }).click();
  const plannerFont = await page.getByRole("heading", { name: "Planner diagnostics" }).evaluate((element) => getComputedStyle(element).fontFamily);
  expect(plannerFont).toContain("IBM Plex Sans");
});

test("deep Plan outline and duration tooltip remain readable", async ({ page }) => {
  await analyze(page, productionNestedLoopPlan, "Deep Plan layout regression");
  const renderer = page.getByTestId("pev2-renderer");
  const outlineWidth = await renderer.evaluate((host) =>
    host.shadowRoot?.querySelector(".plan-container .splitpanes--vertical > .splitpanes__pane:first-child")?.getBoundingClientRect().width ?? 0,
  );
  expect(outlineWidth).toBeGreaterThanOrEqual(page.viewportSize()!.width >= 700 ? 430 : 300);

  const timingCell = renderer.locator(".plan-diagram tr.node").nth(13).locator("td").nth(2);
  await timingCell.hover();
  const tooltip = page.locator("body > [data-tippy-root] .tippy-box");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Exclusive:");
  const tooltipStyle = await tooltip.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    fontSize: getComputedStyle(element).fontSize,
    width: element.getBoundingClientRect().width,
  }));
  expect(tooltipStyle.background).toBe("rgb(23, 62, 85)");
  expect(tooltipStyle.fontSize).toBe("12px");
  expect(tooltipStyle.width).toBeLessThanOrEqual(320);
});

test("Plan row tooltips never accumulate over the planner tree", async ({ page }) => {
  await analyze(page, productionNestedLoopPlan, "Tooltip lifecycle regression");
  const renderer = page.getByTestId("pev2-renderer");
  const timingCells = renderer.locator(".plan-diagram tr.node td:nth-child(3)");
  expect(await timingCells.count()).toBeGreaterThan(4);

  for (const index of [3, 7, 11]) {
    await timingCells.nth(index).hover();
    await expect(page.locator("body > [data-tippy-root] .tippy-box[data-state=visible]")).toHaveCount(1);
  }

  await timingCells.nth(11).click();
  await expect(page.locator("body > [data-tippy-root] .tippy-box[data-state=visible]")).toHaveCount(0);
});

test("I/O timing popup explains reads, writes, and missing timing", async ({ page }) => {
  await analyze(page, productionNestedLoopPlan, "I/O timing guidance");
  const renderer = page.getByTestId("pev2-renderer");
  const ioStat = renderer.locator(".plan-stats > div").filter({ hasText: "IO:" }).last();
  await ioStat.locator("button").click();
  const note = renderer.locator("[data-pgplan-io-note]");
  await expect(note).toBeVisible();
  await expect(note).toContainText("Read = measured wait to fetch table/index blocks");
  await expect(note).toContainText("A dash means no timing was reported");
  await expect(note).toContainText("Requires I/O timing collection");

  const focusedLayout = await renderer.evaluate((host) => {
    const root = host.shadowRoot?.querySelector<HTMLElement>("#pev2-root")?.getBoundingClientRect();
    const stats = host.shadowRoot?.querySelector<HTMLElement>(".plan-stats:has(.stat-dropdown-container)")?.getBoundingClientRect();
    const popup = host.shadowRoot?.querySelector<HTMLElement>(".stat-dropdown-container")?.getBoundingClientRect();
    return root && stats && popup
      ? {
          widthDifference: Math.abs(root.width - stats.width),
          heightDifference: Math.abs(root.height - stats.height),
          popupWidth: popup.width,
          rootWidth: root.width,
        }
      : null;
  });
  expect(focusedLayout).not.toBeNull();
  expect(focusedLayout!.widthDifference).toBeLessThan(2);
  expect(focusedLayout!.heightDifference).toBeLessThan(2);
  expect(focusedLayout!.popupWidth).toBeGreaterThanOrEqual(Math.min(760, focusedLayout!.rootWidth * 0.8));

  await renderer.locator(".stat-dropdown-container .btn-close").click();
  await expect(note).toBeHidden();
  await expect(renderer.getByRole("link", { name: "Plan", exact: true })).toBeVisible();
});

test("Planning opens as one focused detail view and returns cleanly", async ({ page }) => {
  await analyze(page, productionNestedLoopPlan, "Planning detail focus");
  const renderer = page.getByTestId("pev2-renderer");
  const planningStat = renderer.locator(".plan-stats > div").filter({ hasText: "Planning:" }).last();
  await planningStat.locator("button").click();
  const panel = renderer.locator(".stat-dropdown-container");
  await expect(panel.getByRole("heading", { name: "Planning" })).toBeVisible();
  await expect(panel).toContainText("Time:");
  const focusedLayout = await renderer.evaluate((host) => {
    const root = host.shadowRoot?.querySelector<HTMLElement>("#pev2-root")?.getBoundingClientRect();
    const stats = host.shadowRoot?.querySelector<HTMLElement>(".plan-stats:has(.stat-dropdown-container)")?.getBoundingClientRect();
    return root && stats
      ? {
          widthDifference: Math.abs(root.width - stats.width),
          heightDifference: Math.abs(root.height - stats.height),
          background: getComputedStyle(host.shadowRoot!.querySelector<HTMLElement>(".plan-stats:has(.stat-dropdown-container)")!).backgroundColor,
        }
      : null;
  });
  expect(focusedLayout).not.toBeNull();
  expect(focusedLayout!.widthDifference).toBeLessThan(2);
  expect(focusedLayout!.heightDifference).toBeLessThan(2);
  expect(focusedLayout!.background).toBe("rgb(248, 250, 249)");
  await renderer.locator(".stat-dropdown-container .btn-close").click();
  await expect(panel).toBeHidden();
  await expect(renderer.locator(".plan-container")).toBeVisible();
});

test("production quoted TEXT renders and retains root-cause evidence", async ({ page }) => {
  await analyze(page, productionNestedLoopPlan, "Production nested-loop case");
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Findings" })).toBeVisible();
  await expect(page.getByText(/Direct spill at Sort/).first()).toBeVisible();
  await expect(page.getByText(/verify direct temp blocks/i)).toBeVisible();
});

test("quoted parallel plan preserves guarded index experiments", async ({ page }) => {
  await analyze(page, quotedParallelPlan, "Quoted parallel scan");
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Findings" })).toBeVisible();
  await expect(page.getByText(/High-volume sequential scan filtering/).first()).toBeVisible();
  const experiments = page.getByRole("region", { name: "Controlled candidate index experiments" });
  await expect(experiments).toBeVisible();
  await expect(experiments).toContainText("ON ds_local.wam_index_eis (aamc_id)");
  await expect(experiments).toContainText("context missing");
  await expect(experiments).toContainText("Low confidence");
  await expect(experiments).toContainText("HypoPG experiment");
  await expect(experiments).toContainText("hypopg_create_index");
  await expect(experiments).toContainText("hypopg_reset");
  await expect(experiments).toContainText("Nothing is executed");
  await expect(page.getByText(/CREATE INDEX CONCURRENTLY ON ds_local\.wam_index_eis \(aamc_id\)/)).toHaveCount(0);
});

test("visible bigint coercion is identified without claiming database proof", async ({ page }) => {
  await analyze(page, coercionPlan, "Materialized-view type drift");
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await expect(page.getByText(/Plan-visible type coercion/).first()).toBeVisible();
  await expect(page.getByText(/double precision/).first()).toBeVisible();
  const qualification = page.getByRole("region", { name: "Type coercion qualification" });
  await expect(qualification).toContainText("A column-expression cast is visible in a predicate.");
  await expect(qualification).toContainText("does not prove that the cast prevented index use");
  await expect(qualification).toContainText("comparable after plan");
  await expect(page.getByRole("region", { name: "Captured evidence" })).toBeVisible();
});

test("Findings exposes the complete evidence classification contract without horizontal overflow", async ({ page }) => {
  await analyze(page, coercionPlan, "Evidence classification contract");
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  const ledger = page.getByLabel("Evidence classification for Plan-visible type coercion");
  await expect(ledger).toBeVisible();
  await expect(ledger).toContainText("observed");
  await expect(ledger).toContainText("derived");
  await expect(ledger).toContainText("suspected");
  await expect(ledger).toContainText("unknown");
  await expect(ledger).toContainText("verified");
  await expect(ledger).toContainText("Not verified");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("Findings prioritizes one investigation and progressively discloses supporting evidence", async ({ page }) => {
  await analyze(page, productionNestedLoopPlan, "Dense findings hierarchy");
  await page.getByRole("button", { name: "Findings", exact: true }).click();

  const heading = page.getByRole("heading", { name: "Findings", exact: true });
  const investigations = page.locator("details.finding-investigation");
  const candidates = page.locator(".candidate-experiment-list > details");
  await expect(heading).toBeVisible();
  await expect(page.getByText("Evidence-led tuning", { exact: true })).toBeVisible();
  expect(await investigations.count()).toBeGreaterThan(1);
  expect(await investigations.evaluateAll((items) => items.filter((item) => (item as HTMLDetailsElement).open).length)).toBe(1);
  expect(await candidates.evaluateAll((items) => items.filter((item) => (item as HTMLDetailsElement).open).length)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("heading", { name: "Candidate indexes", exact: true })).toHaveCount(0);

  const second = investigations.nth(1);
  await second.locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await expect(second).toHaveJSProperty("open", true);

  const headingTop = await heading.evaluate((node) => node.getBoundingClientRect().top);
  const firstFindingTop = await investigations.first().evaluate((node) => node.getBoundingClientRect().top);
  expect(headingTop).toBeLessThan(firstFindingTop);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("core workflow navigation preserves the full-width analysis canvas", async ({ page }) => {
  await analyze(page, fixture("02_non_sargable_expression"), "Navigation audit");
  const navigation = page.getByRole("navigation", { name: "Analysis views" });
  for (const name of ["Plan", "Findings", "Planner diagnostics", "Validate fix", "Database context"]) await expect(navigation.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "AI Review", exact: true })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: /More tools/ })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: "Evidence", exact: true })).toHaveCount(0);
  await navigation.getByRole("button", { name: "Planner diagnostics", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Planner diagnostics" })).toBeVisible();
  const statistics = page.getByRole("region", { name: "Statistics qualification" });
  await expect(statistics).toContainText("Estimate drift is observed; its statistics cause is not established.");
  await expect(statistics).toContainText("unknown");
  await expect(statistics).toContainText("Import a sanitized Database Context Pack");
  const explanation = page.getByRole("region", { name: "Why planner diagnostics matter" });
  await expect(explanation).toContainText("The method PostgreSQL used to retrieve rows");
  await expect(explanation).toContainText("Cardinality controls join order, scan choice, memory, and parallelism");
  await expect(page.getByRole("heading", { name: "Access paths", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Row estimates", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Access Paths" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bad Estimates" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Minimize workspace navigation" })).toHaveCount(0);
  const navigationBox = await navigation.boundingBox();
  const mainBox = await page.locator("main").boundingBox();
  expect(navigationBox?.width).toBeGreaterThan(page.viewportSize()!.width * 0.9);
  expect(mainBox?.width).toBeGreaterThan(page.viewportSize()!.width * 0.9);
});

test("Planner diagnostics prioritizes measured access work and the first estimate divergence", async ({ page }) => {
  await analyze(page, productionNestedLoopPlan, "Planner diagnostics priority");
  await page.getByRole("button", { name: "Planner diagnostics", exact: true }).click();

  const workspace = page.locator(".planner-diagnostics");
  const accessItems = workspace.locator("details.planner-access-item");
  await expect(workspace).toContainText("Planner cost explains a choice");
  await expect(workspace).toContainText("An index can still be expensive when repeated thousands of times");
  await expect(accessItems.first()).toHaveClass(/review/);
  expect(await accessItems.evaluateAll((items) => items.filter((item) => (item as HTMLDetailsElement).open).length)).toBe(1);
  await expect(accessItems.first()).toContainText("Index Only Scan");
  await expect(accessItems.first()).toContainText("Heap visits reduced the benefit");
  await expect(workspace.locator(".estimate-row.origin")).toHaveCount(1);
  await expect(workspace.locator(".estimate-row.origin")).toContainText("Investigate first: deepest material divergence");
  await expect(workspace.getByText("Candidate experiment—not a recommendation", { exact: true })).toHaveCount(0);

  const secondSummary = accessItems.nth(1).locator("summary");
  await secondSummary.focus();
  await page.keyboard.press("Enter");
  await expect(accessItems.nth(1)).toHaveJSProperty("open", true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);

  const navButtons = page.getByRole("navigation", { name: "Analysis views" }).locator(":scope > button");
  const boxes = await navButtons.evaluateAll((buttons) => buttons.map((button) => { const box = button.getBoundingClientRect(); return { left: box.left, right: box.right }; }));
  expect(boxes.every((box, index) => index === 0 || box.left >= boxes[index - 1].right - 1)).toBe(true);
});

test("Fix Validation compares structurally different plans", async ({ page }) => {
  await analyze(page, fixture("02_non_sargable_expression"), "Before");
  await page.getByRole("button", { name: "Validate fix" }).click();
  await page.getByText("Same SQL shape", { exact: true }).click();
  await page.getByText("Equivalent representative parameters", { exact: true }).click();
  await page.getByText("Comparable settings, cache state and concurrency", { exact: true }).click();
  await page.getByText("Result repeated", { exact: true }).click();
  await page.getByPlaceholder(/after\/fixed/).fill(fixture("01_indexed_point_lookup"));
  await page.getByRole("button", { name: "Run comparison gate" }).click();
  await expect(page.getByText("Improved", { exact: true })).toBeVisible();
});

test("Fix Validation blocks a one-run improvement and exposes complete proof evidence", async ({ page }) => {
  await analyze(page, fixture("02_non_sargable_expression"), "Unrepeated comparison");
  await page.getByRole("button", { name: "Validate fix", exact: true }).click();
  await page.getByText("Same SQL shape", { exact: true }).click();
  await page.getByText("Equivalent representative parameters", { exact: true }).click();
  await page.getByText("Comparable settings, cache state and concurrency", { exact: true }).click();
  await page.getByLabel("After plan evidence").fill(fixture("01_indexed_point_lookup"));
  await page.getByRole("button", { name: "Run comparison gate", exact: true }).click();

  const verdict = page.getByRole("region", { name: "Validation verdict" });
  await expect(verdict).toContainText("Inconclusive");
  await expect(verdict).toContainText("Blockers1");
  const gate = page.locator(".validation-stage").filter({ has: page.getByRole("heading", { name: "Comparability gate" }) });
  await expect(gate).toContainText("blocker · Repeated result");
  await expect(gate).toContainText("cannot establish an improvement");
  const measured = page.locator(".validation-stage").filter({ has: page.getByRole("heading", { name: "Measured changes" }) });
  await expect(measured).toContainText("Root actual rows");
  await expect(measured).toContainText("Root planned rows");
  await expect(page.locator(".validation-stage").filter({ has: page.getByRole("heading", { name: "Structural plan changes" }) })).toContainText("not ordinal alone");
  await expect(page.getByText("Success gate", { exact: true })).toBeVisible();
  await expect(page.getByText("Rollback boundary", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("sanitized context qualifies an existing index without a database connection", async ({ page }) => {
  await analyze(page, quotedParallelPlan, "Context-qualified index");
  await page.getByRole("button", { name: "Database context", exact: true }).click();
  const context = { version: 1, relations: [{ schema: "ds_local", name: "wam_index_eis", columns: [{ name: "aamc_id", type: "bigint" }], indexes: [{ name: "existing_aamc_idx", columns: ["aamc_id"], valid: true }] }] };
  await page.getByLabel("Sanitized database context").fill(JSON.stringify(context));
  await page.getByRole("button", { name: "Preview sanitized context" }).click();
  await expect(page.getByRole("region", { name: "Sanitized context preview" })).toContainText("Source v1 normalized locally");
  await expect(page.getByRole("region", { name: "Sanitized context preview" })).toContainText("extendedStats, partitions, settings");
  await page.getByRole("button", { name: "Apply to this analysis" }).click();
  await expect(page.getByText("1 relation(s) available")).toBeVisible();
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  const experiments = page.getByRole("region", { name: "Controlled candidate index experiments" });
  await expect(experiments).toContainText("existing_aamc_idx already begins with");
  await expect(experiments).toContainText("existing index");
  await expect(experiments).toContainText("Nothing is executed");
});

test("Context Pack v2 previews redaction, provenance, completeness, and the read-only collector", async ({ page }) => {
  await analyze(page, fixture("02_non_sargable_expression"), "Context Pack v2");
  await page.getByRole("button", { name: "Database context", exact: true }).click();
  await expect(page.getByText("Plan-only analysis", { exact: true })).toBeVisible();
  const boundary = page.getByRole("region", { name: "What the plan and context can establish" });
  await expect(boundary).toContainText("Plan proves");
  await expect(boundary).toContainText("Context qualifies");
  await expect(boundary).toContainText("Still requires validation");
  const impact = page.getByRole("region", { name: "Diagnoses improved by database context" });
  await expect(impact).toContainText("Index advice");
  await expect(impact).toContainText("Type coercion");
  await expect(impact).toContainText("Estimate drift");
  await expect(impact).toContainText("Environment drift");
  const collector = await page.request.get("/pgplan-context-pack.sql");
  expect(collector.ok()).toBe(true);
  expect(await collector.text()).toContain("BEGIN TRANSACTION READ ONLY");
  const context = {
    version: 2,
    provenance: { collectedAt: "2026-09-01T12:00:00Z", postgresVersion: "16.4", collector: "pgplan-context-sql", collectorVersion: "2", redacted: true },
    availability: {
      relationStats: { status: "captured" }, columnStats: { status: "captured" }, indexStats: { status: "captured" },
      extendedStats: { status: "captured" }, partitions: { status: "unavailable", reason: "No partitioned relations selected." }, settings: { status: "captured" },
    },
    settings: [{ name: "default_statistics_target", value: "100" }],
    relations: [{ schema: "public", name: "pgbench_accounts", kind: "table", liveTuples: 2_000_000, modificationsSinceAnalyze: 10_000, columns: [{ name: "aid", type: "integer", statisticsTarget: 100 }], indexes: [], extendedStatistics: [], partitions: [] }],
    password: "discard-me",
  };
  const input = page.getByLabel("Sanitized database context");
  await input.fill(JSON.stringify(context));
  await page.getByRole("button", { name: "Preview sanitized context" }).click();
  const preview = page.getByRole("region", { name: "Sanitized context preview" });
  await expect(preview).toContainText("Source v2 normalized locally");
  await expect(preview).toContainText("password");
  await expect(preview).toContainText("partitions");
  await page.getByRole("button", { name: "Apply to this analysis" }).click();
  await expect(page.getByRole("button", { name: "Database context ✓" })).toBeVisible();
  await expect(page.getByText("Context applied", { exact: true })).toBeVisible();
  await expect(page.getByText(/PostgreSQL 16\.4/)).toBeVisible();
  await expect(input).not.toHaveValue(/discard-me/);
  await page.getByRole("button", { name: "Planner diagnostics", exact: true }).click();
  const statistics = page.getByRole("region", { name: "Statistics qualification" });
  await expect(statistics).toContainText("Column statistics exist, but the estimate drift still needs controlled investigation.");
  await expect(statistics).toContainText("statistics target 100");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("environment drift exposes bigint coercion risk without claiming runtime causality", async ({ page }) => {
  await analyze(page, fixture("02_non_sargable_expression"), "Environment drift");
  await page.getByRole("button", { name: "Database context", exact: true }).click();
  const pack = (type: string, setting: string) => ({
    version: 2,
    provenance: { collectedAt: "2026-09-02T12:00:00Z", postgresVersion: "16.4", collector: "manual", collectorVersion: "2", redacted: true },
    availability: Object.fromEntries(["relationStats", "columnStats", "indexStats", "extendedStats", "partitions", "settings"].map((name) => [name, { status: "captured" }])),
    settings: [{ name: "random_page_cost", value: setting }],
    relations: [{ schema: "public", name: "orders", kind: "table", modificationsSinceAnalyze: 100, columns: [{ name: "customer_id", type, nDistinct: 1000, statisticsTarget: 100 }], indexes: [{ name: "orders_customer_idx", columns: ["customer_id"], accessMethod: "btree", valid: true, ready: true }], extendedStatistics: [], partitions: [] }],
  });
  await page.getByLabel("Sanitized database context").fill(JSON.stringify(pack("double precision", "1.1")));
  await page.getByRole("button", { name: "Preview sanitized context" }).click();
  await page.getByRole("button", { name: "Apply to this analysis" }).click();
  await page.getByLabel("PTEST reference context").fill(JSON.stringify(pack("bigint", "4")));
  await page.getByRole("button", { name: "Compare environments" }).click();
  const report = page.getByRole("region", { name: "Environment drift report" });
  await expect(report).toContainText("public.orders.customer_id");
  await expect(report).toContainText("bigint");
  await expect(report).toContainText("double precision");
  await expect(report).toContainText("implicit casts");
  await expect(report).toContainText("do not prove the cause");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
