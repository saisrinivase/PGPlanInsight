import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const artifact = (name: string) => readFileSync(new URL(`../../docs/pilot-artifacts/${name}`, import.meta.url), "utf8");

async function analyzeArtifact(page: import("@playwright/test").Page, name: string) {
  await page.goto("/");
  await page.getByLabel("Case name").fill(`Pilot artifact · ${name}`);
  await page.getByLabel("Plan evidence").fill(artifact(name));
  await page.getByRole("button", { name: /Analyze plan/ }).click();
  await expect(page.getByTestId("pev2-renderer")).toBeVisible({ timeout: 15_000 });
}

test("pilot Task 1 plan renders and supports operation inspection", async ({ page }) => {
  await analyzeArtifact(page, "task-1-slow-query.json");
  await expect(page.getByTestId("pev2-renderer").locator("#pev2-root")).toBeVisible();
  await page.getByRole("button", { name: "Planner diagnostics", exact: true }).click();
  await expect(page.locator(".planner-diagnostics")).toContainText("order_items");
  await expect(page.locator(".planner-diagnostics")).toContainText("Heap Fetches");
});

test("pilot Task 2 context pack qualifies the existing fictional index", async ({ page }) => {
  await analyzeArtifact(page, "task-2-plan-without-context.json");
  await page.getByRole("button", { name: "Database context", exact: true }).click();
  await page.getByLabel("Sanitized database context").fill(artifact("task-2-context-pack-v1.json"));
  await page.getByRole("button", { name: "Preview sanitized context" }).click();
  await page.getByRole("button", { name: "Apply to this analysis" }).click();
  await page.getByRole("button", { name: "Findings", exact: true }).click();
  const experiments = page.getByRole("region", { name: "Controlled candidate index experiments" });
  await expect(experiments).toContainText("orders_customer_id_idx already begins with");
  await expect(experiments).toContainText("Investigate the existing index before creating another");
  await expect(experiments.locator("code")).not.toContainText("CREATE INDEX ON");
});

test("pilot Task 3 one-run comparison remains inconclusive", async ({ page }) => {
  await analyzeArtifact(page, "task-3-before-plan.json");
  await page.getByRole("button", { name: "Validate fix", exact: true }).click();
  await page.getByRole("checkbox", { name: /Same SQL shape/ }).check();
  await page.getByRole("checkbox", { name: /Equivalent representative parameters/ }).check();
  await page.getByLabel("After plan evidence").fill(artifact("task-3-after-plan.json"));
  await page.getByRole("button", { name: "Run comparison gate" }).click();
  const verdict = page.getByRole("region", { name: "Validation verdict" });
  await expect(verdict).toContainText("Inconclusive");
  await expect(page.locator(".validation-stage").filter({ has: page.getByRole("heading", { name: "Comparability gate" }) })).toContainText("Repeated result");
  await expect(page.getByRole("button", { name: "Export validation report" })).toBeVisible();
});