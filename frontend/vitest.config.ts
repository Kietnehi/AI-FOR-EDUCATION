import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: [".next/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        statements: 70,
        branches: 65,
        functions: 60,
        lines: 70,
      },
      exclude: [
        "node_modules/**",
        ".next/**",
        "test/**",
        "next-env.d.ts",
        "**/*.d.ts",
      ],
    },
  },
});
