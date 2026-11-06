import { defineConfig } from "vitest/config";

// Convenção de testes (registro do spec):
// - `*.test.ts`      = unit (dominio puro, zero banco)
// - `*.int.test.ts`  = integration (Postgres descartavel via Testcontainers)
export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
