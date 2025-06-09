import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  build: {
    lib: {
      entry: "app/standalone-canvas.tsx",
      name: "StandaloneCanvas",
      formats: ["iife"], // Immediately invoked function expression for browser
      fileName: () => "standalone-canvas.js",
    },
    outDir: "public/standalone",
    emptyOutDir: true,
    rollupOptions: {
      external: ["react", "react-dom"], // We'll load these from CDN
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});