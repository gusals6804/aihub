import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` throws by design when loaded outside a Server Component.
      // Under Vitest we still want to import those modules, so it is stubbed out.
      // The real guard still applies at build time, which is what protects prod.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    // Node by default: most suites are server logic, and jsdom costs seconds per
    // file. Component tests opt in with `// @vitest-environment jsdom`.
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Playwright specs live in tests/e2e and are run by `npm run test:e2e`.
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
  },
});
