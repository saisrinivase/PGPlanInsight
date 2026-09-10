import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  worker: { format: "es" },
  build: {
    rollupOptions: {
      output: { manualChunks: { pev2: ["pev2", "vue"] } },
    },
  },
  test: { exclude: ["tests/e2e/**", "node_modules/**", "dist/**"] },
});
