import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

// Retained as migration documentation for the retired custom tree. The active
// PEV2 workflow contract is covered in pev2-workflows.spec.ts.
test.describe.skip("legacy custom-renderer workflows", () => {

const fixture = (name: string) => readFileSync(new URL(`../enterprise_plans/${name}.json`, import.meta.url), "utf8");
const quotedParallelPlan = readFileSync(new URL("../quoted-parallel-plan.txt", import.meta.url), "utf8");
const productionNestedLoopPlan = readFileSync(new URL("../production-nested-loop-plan.txt", import.meta.url), "utf8");
const textPlan = `PostgreSQL 16.4
Seq Scan on customers  (cost=0.00..20.00 rows=2 width=8) (actual time=0.010..12.000 rows=2 loops=1)
  Filter: (lower(email) = 'a@example.com')
  Rows Removed by Filter: 50000
  Buffers: shared hit=10 read=140
Planning Time: 0.400 ms
Execution Time: 13.400 ms`;
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
}

test("JSON diagnosis, execution tree table, expert tools, and local report export", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Diagnose the plan. Verify the change." })).toBeVisible();
  await page.getByRole("button", { name: "Load sample plan" }).click();
  await expect(page.getByRole("heading", { name: "See the work. Select the cause." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Direct spill at Sort/ })).toBeVisible();
  await page.getByRole("button", { name: /Direct spill at Sort/ }).click();
  await expect(page.getByRole("region", { name: /Selected node details/ })).toBeVisible();
  await expect(page.getByText("Why this status", { exact: false }).first()).toBeVisible();
  await expect(page.getByLabel("Graphical execution plan")).toBeVisible();
  await expect(page.getByRole("row", { name: /Status/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore all nodes" })).toHaveCount(0);
  await page.getByRole("button", { name: "Collapse subtree at Sort" }).click();
  await expect(page.getByRole("button", { name: /^Hash Join,/ })).toBeHidden();
  await expect(page.getByRole("button", { name: "Restore all nodes" })).toBeVisible();
  await page.getByRole("button", { name: "Restore all nodes" }).click();
  await expect(page.getByRole("button", { name: /^Hash Join,/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore all nodes" })).toHaveCount(0);
  await page.getByRole("button", { name: "Minimize workspace navigation" }).click();
  await expect(page.getByRole("button", { name: "Expand workspace navigation" })).toBeVisible();
  await page.getByRole("button", { name: /Show details for Hash Join/ }).click();
  await expect(page.getByRole("region", { name: "Selected node details for Hash Join" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Selected node details for Hash Join" }).getByText("Inclusive / self")).toBeVisible();
  await page.getByRole("button", { name: "Open full evidence" }).click();
  await expect(page.getByRole("heading", { name: "Evidence ledger" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bad Estimates" })).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Diagnosis" }).click();
  await page.getByRole("button", { name: "Export DBA report" }).click();
  expect((await download).suggestedFilename()).toBe("pgplan-dba-triage.md");
});

test("TEXT plan reaches the same deterministic diagnosis workspace", async ({ page }) => {
  await analyze(page, textPlan, "TEXT non-sargable scan");
  await expect(page.getByRole("button", { name: /High-volume sequential scan filtering/ })).toBeVisible();
  await page.getByRole("button", { name: /Show details for Seq Scan/ }).click();
  const inlineScan = page.getByRole("region", { name: /Selected node details for Seq Scan/ });
  await expect(inlineScan.getByText("Index candidate withheld")).toBeVisible();
  await expect(inlineScan.getByText(/does not expose a safe plain-column candidate/)).toBeVisible();
});

test("visual plan view synchronizes metric outline, connected graph, and inspector", async ({ page }) => {
  await analyze(page, fixture("04_missing_history_index_join"), "Visual plan explorer");
  await page.getByRole("button", { name: "Visual plan view" }).click();
  await expect(page.getByLabel("Visual execution plan explorer")).toBeVisible();
  await expect(page.getByLabel("Metric operation outline")).toBeVisible();
  await expect(page.getByLabel("Connected execution plan graph")).toBeVisible();
  await page.getByRole("button", { name: /Select operation 8:/ }).click();
  await expect(page.getByLabel("Visual plan node inspector").getByText("Operation #8")).toBeVisible();
  await page.getByRole("button", { name: "Estimation" }).click();
  await expect(page.getByLabel("Metric operation outline").getByText("Estimate drift")).toBeVisible();
  await expect(page.getByRole("status", { name: "Plan zoom" })).toHaveText("100%");
  await page.getByRole("button", { name: "Zoom out plan" }).click();
  await expect(page.getByRole("status", { name: "Plan zoom" })).toHaveText("90%");
  const beforeFocus = await page.getByLabel("Metric operation outline").getByRole("button").count();
  await page.getByRole("button", { name: "Focus this branch" }).click();
  const afterFocus = await page.getByLabel("Metric operation outline").getByRole("button").count();
  expect(afterFocus).toBeLessThan(beforeFocus);
  await page.getByRole("button", { name: "Reset focus" }).click();
  await expect(page.getByLabel("Metric operation outline").getByRole("button")).toHaveCount(beforeFocus);
  await page.getByRole("button", { name: "Table evidence view" }).click();
  await expect(page.getByLabel("Graphical execution plan")).toBeVisible();
});

test("quoted clipboard TEXT diagnoses a parallel filtering scan", async ({ page }) => {
  await analyze(page, quotedParallelPlan, "Quoted parallel scan");
  await expect(page.getByRole("button", { name: /High-volume sequential scan filtering/ })).toBeVisible();
  const parallelDetails = page.getByRole("button", { name: /Show details for Parallel Seq Scan/ });
  await expect(parallelDetails).toBeVisible();
  await parallelDetails.click({ force: true });
  const inlineScan = page.getByRole("region", { name: /Selected node details for Parallel Seq Scan/ });
  await expect(inlineScan.getByText(/ON ds_local\.wam_index_eis \(aamc_id\)/)).toBeVisible();
  await expect(inlineScan.getByText(/no PostgreSQL catalog was checked/i)).toBeVisible();
  await expect(inlineScan.getByText(/existing indexes, selectivity, statistics, write cost/i)).toBeVisible();
  const fullEvidence = page.getByRole("button", { name: "Open full evidence" });
  await expect(fullEvidence).toBeVisible();
  await fullEvidence.click({ force: true });
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Findings" })).toBeVisible();
  await expect(page.getByText("Candidate indexes", { exact: true })).toBeVisible();
  await expect(page.getByText(/ON ds_local\.wam_index_eis \(aamc_id\)/)).toBeVisible();
  await expect(page.getByText(/no PostgreSQL catalog was checked/i)).toBeVisible();
});

test("plan-visible bigint coercion opens an evidence-bounded knowledge pattern", async ({ page }) => {
  await analyze(page, coercionPlan, "Production materialized-view type drift");
  await expect(page.getByRole("button", { name: /Plan-visible type coercion/ })).toBeVisible();
  await page.getByRole("button", { name: /Show details for Hash Join/ }).click();
  const guidance = page.getByLabel("Type coercion knowledge guidance");
  await expect(guidance.getByText("Known pattern · TYPE-001")).toBeVisible();
  await expect(guidance.getByText(/double precision/)).toBeVisible();
  await expect(guidance.getByText(/Not yet proven/)).toBeVisible();
  await expect(guidance.getByText(/UNION, view, parameter, or environment drift/)).toBeVisible();
});

test("one-line quoted production export reaches the diagnosis workspace", async ({ page }) => {
  await analyze(page, productionNestedLoopPlan, "Production nested-loop case");
  await expect(page.getByRole("button", { name: /Direct spill at Sort/ })).toBeVisible();
  const rootNode = page.getByRole("tree", { name: "Execution operation tree" }).getByRole("button", { name: /Show details for Nested Loop Semi Join/ }).first();
  await rootNode.focus();
  await rootNode.press("Enter");
  await expect(page.getByRole("region", { name: "Selected node details for Nested Loop Semi Join" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Selected node details for Nested Loop Semi Join" }).getByText("Why this status")).toBeVisible();
  await expect(page.getByRole("region", { name: "Selected node details for Nested Loop Semi Join" }).getByText(/Inherited temp I\/O/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Selected node details for Nested Loop Semi Join" }).getByText(/descendant operation with direct spill evidence/i)).toBeVisible();
});

test("deep production trees keep node controls inside the Node column", async ({ page }) => {
  await analyze(page, productionNestedLoopPlan, "Deep node alignment");
  const tree = page.getByRole("tree", { name: "Execution operation tree" });
  await expect(tree.getByRole("treeitem").first()).toBeVisible();
  const layout = await tree.getByRole("treeitem").evaluateAll((rows) => rows.map((row) => {
    const serialCell = row.children[0]?.getBoundingClientRect();
    const nodeCell = row.children[1]?.getBoundingClientRect();
    const timeCell = row.children[2]?.getBoundingClientRect();
    const info = row.querySelector<HTMLElement>(".node-info-button")?.getBoundingClientRect();
    const name = row.querySelector<HTMLElement>(".row-node-name")?.getBoundingClientRect();
    return { serialWidth: serialCell?.width ?? 0, nodeRight: nodeCell?.right ?? 0, timeLeft: timeCell?.left ?? 0, infoRight: info?.right ?? 0, nameWidth: name?.width ?? 0 };
  }));
  expect(layout.length).toBeGreaterThan(10);
  expect(layout.every(({ serialWidth, nodeRight, timeLeft, infoRight, nameWidth }) => serialWidth >= 49 && nodeRight <= timeLeft + 1 && infoRight <= nodeRight && nameWidth >= 90)).toBe(true);
  await expect(tree.getByRole("treeitem").first().locator(".node-serial")).toHaveText("1");
});

test("expert navigation exposes only evidence-specific tools", async ({ page }) => {
  await analyze(page, fixture("02_non_sargable_expression"), "Expert tab audit");
  await page.getByRole("button", { name: "Open full evidence" }).click();
  await expect(page.getByRole("button", { name: "Evidence" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Access Paths" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bad Estimates" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Plan Viewer" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Summary" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Plan Tutor" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Recommendations" })).toBeVisible();
  await expect(page.getByRole("button", { name: "AI DBA Review" })).toHaveCount(0);
  await page.getByRole("button", { name: "Access Paths" }).click();
  await expect(page.getByRole("heading", { name: "Access Paths" })).toBeVisible();
  await expect(page.getByLabel("How to read access paths")).toBeVisible();
  await expect(page.getByText("Validate next", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Sequential access can be correct|planner's row estimate may have influenced sequential access/i).first()).toBeVisible();
});

test("Fix Validation compares structurally different plans", async ({ page }) => {
  await analyze(page, fixture("02_non_sargable_expression"), "Before");
  await page.getByRole("button", { name: "Validate fix" }).click();
  await page.getByPlaceholder(/after\/fixed/).fill(fixture("01_indexed_point_lookup"));
  await page.getByRole("button", { name: "Compare plans" }).click();
  await expect(page.getByText("Improved", { exact: true })).toBeVisible();
  await expect(page.getByRole("table").first()).toBeVisible();
});
});
