import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  // Hosted runners share CPU: do not overlap rendering benchmarks with other tests.
  workers: process.env.CI ? 1 : 2,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:4178", trace: "retain-on-failure" },
  webServer: { command: "npx vite preview --host 127.0.0.1 --port 4178", url: "http://127.0.0.1:4178", reuseExistingServer: false },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 15"] } },
  ],
});
