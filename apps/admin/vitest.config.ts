import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    poolOptions: {
      forks: {
        execArgv: ["--experimental-sqlite"],
      },
    },
    include: ["test/**/*.test.ts"],
    server: {
      deps: {
        external: [/^node:/],
      },
    },
  },
});
