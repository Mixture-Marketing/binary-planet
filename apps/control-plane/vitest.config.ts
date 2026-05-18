import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Use forked Node processes so node:sqlite is available (workers/threads don't expose it).
    pool: "forks",
    poolOptions: {
      forks: {
        // Pass --experimental-sqlite to child Node processes
        execArgv: ["--experimental-sqlite"],
      },
    },
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    server: {
      deps: {
        // Externalize node: builtins so Vite doesn't try to bundle them
        external: [/^node:/],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
    },
  },
});
