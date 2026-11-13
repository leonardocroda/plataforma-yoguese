import { defineConfig } from "vitest/config";

// Convenção de testes (registro do spec):
// - `*.test.ts`      = unit (dominio puro, zero banco)
// - `*.int.test.ts`  = integration (Postgres descartavel via Testcontainers)
export default defineConfig({
  // Componentes React (.tsx) sao testados como markup (react-dom/server):
  // o preset do Next deixa `jsx: preserve` no tsconfig, que o oxc do Vite 8
  // nao transforma - o automatic entrega o JSX compilado tambem no node.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    // Subida de Postgres via Testcontainers pode demorar minutos na 1a vez
    hookTimeout: 180_000,
    testTimeout: 60_000,
  },
});
