import { test, expect } from '@playwright/test';

function plan(count: number) {
  const leaf = (i: number) => ({ 'Node Type': 'Seq Scan', 'Relation Name': `synthetic_${i}`, 'Startup Cost': 0, 'Total Cost': 10, 'Plan Rows': 10, 'Plan Width': 8, 'Actual Startup Time': 0.01, 'Actual Total Time': 0.1, 'Actual Rows': 10, 'Actual Loops': 1, 'Shared Hit Blocks': 1 });
  return JSON.stringify([{ Plan: { ...leaf(0), 'Node Type': 'Append', 'Actual Total Time': count * 0.1, Plans: Array.from({ length: count - 1 }, (_, i) => leaf(i + 1)) }, 'Execution Time': count * 0.1 + 1 }], null, 2);
}

for (const count of [100, 500, 1000, 2000]) {
  test(`PERFORMANCE: ${count} operations render completely`, async ({ page }, info) => {
    test.setTimeout(90_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(plan(count)) });
    await expect(page.getByLabel('Plan evidence')).toHaveValue(/synthetic_0/);
    const start = Date.now();
    await page.getByRole('button', { name: /Analyze plan/ }).click();
    const renderer = page.getByTestId('pev2-renderer');
    await expect(renderer).toBeVisible({ timeout: 30_000 });
    await page.getByRole('link', { name: /Grid/ }).click();
    await expect(renderer.locator('.plan-grid tr.node')).toHaveCount(count, { timeout: 30_000 });
    const elapsed = Date.now() - start;
    await renderer.locator('.plan-grid tr.node').last().scrollIntoViewIfNeeded();
    await expect(renderer.locator('.plan-grid tr.node').last()).toBeVisible();
    await page.getByRole('link', { name: 'Raw', exact: true }).click();
    await expect(renderer.locator('.tab-pane.active pre')).toContainText(`synthetic_${count - 1}`);
    expect(errors).toEqual([]);
    expect(elapsed).toBeLessThan(30_000);
    await info.attach('performance', { body: JSON.stringify({ count, elapsedMs: elapsed, profile: info.project.name }), contentType: 'application/json' });
    console.log(`PERF ${info.project.name}: ${count} nodes ${elapsed}ms`);
  });
}

test('PERFORMANCE: large clipboard paste preserves selection and analyzes', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  const input = page.getByLabel('Plan evidence');
  await input.fill('replace me');
  const source = plan(1000);
  await input.evaluate((element, text) => {
    const textarea = element as HTMLTextAreaElement;
    textarea.select();
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: (type: string) => type === 'text/plain' ? text : '' } });
    textarea.dispatchEvent(event);
  }, source);
  await expect(input).toHaveValue(source);
  await page.getByRole('button', { name: /Analyze plan/ }).click();
  await expect(page.getByTestId('pev2-renderer')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('link', { name: /Grid/ }).click();
  await expect(page.getByTestId('pev2-renderer').locator('.plan-grid tr.node')).toHaveCount(1000, { timeout: 30_000 });
});

test('STRESS: repeated analysis and navigation recovers every cycle', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const durations: number[] = [];
  for (let cycle = 0; cycle < 20; cycle++) {
    if (cycle) await page.getByRole('button', { name: 'New analysis', exact: true }).click();
    await page.getByLabel('Plan evidence').fill(plan(100));
    const start = Date.now();
    await page.getByRole('button', { name: /Analyze plan/ }).click();
    await expect(page.getByTestId('pev2-renderer')).toBeVisible();
    await page.getByRole('link', { name: /Grid/ }).click();
    await expect(page.getByTestId('pev2-renderer').locator('.plan-grid tr.node')).toHaveCount(100);
    durations.push(Date.now() - start);
  }
  expect(errors).toEqual([]);
  expect(Math.max(...durations)).toBeLessThan(15_000);
  await info.attach('stress', { body: JSON.stringify({ cycles: durations.length, durationsMs: durations }), contentType: 'application/json' });
});
