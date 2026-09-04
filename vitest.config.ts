import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/.claude/**", "**/dist/**"],
  },
});
