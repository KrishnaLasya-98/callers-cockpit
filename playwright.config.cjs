const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:5500",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python -m http.server 5500 --bind 127.0.0.1 --directory frontend",
    url: "http://127.0.0.1:5500",
    reuseExistingServer: false,
  },
  reporter: "list",
});
