import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Workers-only runtime module — provide stub for vitest (Node env).
      "cloudflare:workers": resolve(__dirname, "test/mocks/cloudflare-workers.ts"),
    },
  },
  // Vitest 4 type defs lag — `poolOptions.forks` is a valid runtime config
  // for passing `--experimental-sqlite` to forked workers (D1 mock uses node:sqlite).
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
