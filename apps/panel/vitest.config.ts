import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vitest 4 type defs lag — `poolOptions.forks` is valid runtime config
  // (D1 mock uses node:sqlite, needs --experimental-sqlite flag).
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
  } as never,
});
