import { defineConfig } from "tsup";

/**
 * Build dual ESM + CJS avec déclarations TypeScript et sourcemaps.
 *
 * Entries multiples → permet aux consommateurs d'importer un sous-module
 * uniquement : `import { is44C } from "@staklyapp/contracts/44c"`.
 * (Cf. champ `exports` du package.json.)
 *
 * `splitting: false` — pas de code-splitting, on veut des bundles plats
 * faciles à lire pour `dist/` (Stakly conventions DEV).
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "44c/index": "src/44c/index.ts",
    "display-engine/index": "src/display-engine/index.ts",
    "apps/index": "src/apps/index.ts",
    "tools/index": "src/tools/index.ts",
    "agents/index": "src/agents/index.ts",
    "runtime/index": "src/runtime/index.ts",
    "documents/index": "src/documents/index.ts",
    "agents-instances/index": "src/agents-instances/index.ts",
    "aie/index": "src/aie/index.ts",
    "errors/index": "src/errors/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: "es2022",
  outDir: "dist",
  external: ["zod"],
});
