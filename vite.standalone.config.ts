import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Custom plugin to replace API paths
const replaceApiPaths = () => {
  return {
    name: 'replace-api-paths',
    transform(code: string, id: string) {
      if (id.includes('node_modules')) return null;
      
      // Replace absolute paths with relative paths
      return code
        .replace(/["'](\/api\/[^"']*)/g, (match, path) => {
          return match.replace(path, path.substring(1)); // Remove leading slash
        })
        .replace(/["'](\/media\/[^"']*)/g, (match, path) => {
          return match.replace(path, path.substring(1)); // Remove leading slash
        });
    },
  };
};

export default defineConfig({
  plugins: [react(), tsconfigPaths(), replaceApiPaths()],
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
      external: ["react", "react-dom"], // Only React/ReactDOM from CDN, bundle Konva
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
  optimizeDeps: {
    include: ["react-konva", "konva", "use-image"],
  },
});