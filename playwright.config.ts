import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./cases",
  timeout: 120_000,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    trace: process.env.TRACE === "off" ? "off" : "on",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  }
});
