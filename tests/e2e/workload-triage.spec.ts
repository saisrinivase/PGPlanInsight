import { expect, test } from "@playwright/test";

test("workload triage ranks sanitized evidence and starts a plan investigation", async ({ page }) => {
  const outbound: string[] = [];
  page.on("request", request => { if (new URL(request.url()).origin !== "http://127.0.0.1:4178") outbound.push(request.url()); });
  await page.goto("/");
  await page.getByRole("button", { name: "Prioritize workload" }).first().click();
  await expect(page.getByRole("heading", { name: "Find the statement consuming database time." })).toBeVisible();
  await expect(page.getByText("Root cause, p95 latency, concurrency", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Load safe example" }).click();
  await page.getByRole("button", { name: "Prioritize workload" }).click();
  const rows = page.locator(".triage-table tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("statement-938471");
  await expect(rows.first()).toContainText("49.0% of captured time");
  await expect(rows.first()).toContainText("Temporary I/O");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await rows.first().getByRole("button", { name: /Start investigation/ }).click();
  await expect(page.getByLabel("Case name")).toHaveValue("Workload statement-938471");
  expect(outbound).toEqual([]);
});

test("workload triage rejects SQL text and remains editable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Prioritize workload" }).first().click();
  const unsafe = { version: 1, provenance: { collectedAt: "2026-09-12T10:00:00Z", postgresVersion: "16.4", collector: "pgplan-workload-sql", redacted: true }, statements: [{ fingerprint: "1", query: "select private_value", calls: 1, totalExecTimeMs: 1, meanExecTimeMs: 1, rows: 1, sharedHitBlocks: 0, sharedReadBlocks: 0, tempReadBlocks: 0, tempWrittenBlocks: 0, walBytes: 0 }] };
  const input = page.getByLabel("Workload evidence");
  await input.fill(JSON.stringify(unsafe));
  await page.getByRole("button", { name: "Prioritize workload" }).click();
  await expect(page.getByRole("alert")).toContainText("SQL text and unrecognized fields are not accepted");
  await expect(input).toBeEditable();
});
