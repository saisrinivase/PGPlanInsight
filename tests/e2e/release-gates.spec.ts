import { expect, test } from "@playwright/test";

const textPlan = `Seq Scan on qa_accounts  (cost=0.00..20.00 rows=2 width=8) (actual time=0.010..12.000 rows=2 loops=1)
  Filter: (account_id = 42)
  Rows Removed by Filter: 50000
  Buffers: shared hit=10 read=140
Planning Time: 0.400 ms
Execution Time: 13.400 ms`;

test("SMOKE: application accepts a plan and reaches deterministic diagnosis", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Execution plan input", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Capture guidance" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Capture documentation", includeHidden: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Analyze plan/ })).toBeDisabled();
  await page.getByLabel("Plan evidence").fill(textPlan);
  await page.getByRole("button", { name: /Analyze plan/ }).click();
  await expect(page.getByTestId("pev2-renderer")).toBeVisible();
  await expect(page.getByTestId("pev2-renderer")).toBeVisible();
  await expect(page.getByRole("link", { name: "Grid new" })).toBeVisible();
});

test("SMOKE: brand explains the product without discarding the current plan", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Plan evidence").fill(textPlan);
  await page.getByRole("button", { name: /Analyze plan/ }).click();
  await expect(page.getByTestId("pev2-renderer")).toBeVisible();
  await page.getByRole("button", { name: "PGPlan Insight home" }).click();
  const dialog = page.getByRole("dialog", { name: "Understand the evidence. Test the fix." });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Your plan stays in this browser");
  await dialog.getByRole("button", { name: "Continue analysis" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("pev2-renderer")).toBeVisible();
});

test("S1: plan analysis makes no request outside the local application origin", async ({ page }) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:4178") externalRequests.push(request.url());
  });
  await page.goto("/");
  await page.getByLabel("Plan evidence").fill(textPlan);
  await page.getByRole("button", { name: /Analyze plan/ }).click();
  await expect(page.getByTestId("pev2-renderer")).toBeVisible();
  expect(externalRequests).toEqual([]);
});

test("S1: browser security policy restricts scripts, connections, forms, objects, and referrers", async ({ page }) => {
  await page.goto("/");
  const policies = await page.evaluate(() => ({
    csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute("content") ?? "",
    referrer: document.querySelector('meta[name="referrer"]')?.getAttribute("content") ?? "",
    inlineHandlers: document.querySelectorAll("[onclick],[onerror],[onload]").length,
  }));
  expect(policies.csp).toContain("default-src 'self'");
  expect(policies.csp).toContain("script-src 'self'");
  expect(policies.csp).toContain("connect-src 'self'");
  expect(policies.csp).toContain("object-src 'none'");
  expect(policies.csp).toContain("base-uri 'none'");
  expect(policies.csp).toContain("form-action 'none'");
  expect(policies.referrer).toBe("no-referrer");
  expect(policies.inlineHandlers).toBe(0);
});

test("S1: explicitly saved plans survive reload in browser-local history", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Case name").fill("QA persistence case");
  await page.getByLabel("Save this plan").selectOption("7");
  await page.getByLabel("Plan evidence").fill(textPlan);
  await page.getByRole("button", { name: /Analyze plan/ }).click();
  await expect(page.getByTestId("pev2-renderer")).toBeVisible();
  await page.getByRole("button", { name: "New analysis" }).click();
  await expect(page.getByText("QA persistence case", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("QA persistence case", { exact: true })).toBeVisible();
});

test("S2: malformed input fails safely and remains editable", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel("Plan evidence");
  await input.fill("hello world");
  await page.getByRole("button", { name: /Analyze plan/ }).click();
  await expect(page.getByRole("alert")).toContainText(/TEXT plan/i);
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("hello world");
});

test("S1: default analysis leaves no saved plan and redaction removes private text", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Case name").fill("Temporary private case");
  await page.getByLabel("Plan evidence").fill(textPlan);
  await page.getByRole("button", { name: /Analyze plan/ }).click();
  await expect(page.getByTestId("pev2-renderer")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Temporary private case", { exact: true })).toHaveCount(0);
  const rows = await page.evaluate(() => new Promise<number>((resolve) => {
    const request = indexedDB.open("pgplan-insight", 1);
    request.onsuccess = () => { const db = request.result; const count = db.transaction("execution-plans").objectStore("execution-plans").count(); count.onsuccess = () => { resolve(count.result); db.close(); }; };
  }));
  expect(rows).toBe(0);
  await page.getByLabel("Plan evidence").fill(textPlan);
  await page.getByRole("button", { name: "Preview redacted plan" }).click();
  await expect(page.getByLabel("Redacted JSON")).not.toHaveValue(/qa_accounts|account_id/);
  await page.getByRole("button", { name: "Use redacted plan" }).click();
  await page.getByRole("button", { name: /Analyze plan/ }).click();
  await expect(page.getByTestId("pev2-renderer")).toBeVisible();
});

test("S1: saved cases can be deleted individually", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Case name").fill("Delete this case");
  await page.getByLabel("Save this plan").selectOption("1");
  await page.getByLabel("Plan evidence").fill(textPlan);
  await page.getByRole("button", { name: /Analyze plan/ }).click();
  await expect(page.getByTestId("pev2-renderer")).toBeVisible();
  await page.getByRole("button", { name: "New analysis", exact: true }).click();
  await page.getByRole("button", { name: "Delete Delete this case", exact: true }).click();
  await expect(page.getByText("Delete this case", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Delete this case", { exact: true })).toHaveCount(0);
});

test("S2: deeply nested input fails with a useful error and valid input still works", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Plan evidence").fill('{"Plan":' + '{"Plans":['.repeat(300) + '{"Node Type":"Result"}' + ']}'.repeat(300) + '}');
  await page.getByRole("button", { name: /Analyze plan/ }).click();
  await expect(page.getByRole("alert")).toContainText("nesting");
  await page.getByLabel("Plan evidence").fill(textPlan);
  await page.getByRole("button", { name: /Analyze plan/ }).click();
  await expect(page.getByTestId("pev2-renderer")).toBeVisible();
});


test("S1: production preview sends framing and content type protections", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});
