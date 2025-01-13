import react from "@vitejs/plugin-react-swc";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vitest/config";

// https://vitejs.dev/config/
export default defineConfig({
  assetsInclude: [
    './assets/piper/ort-wasm-simd-threaded.wasm',
    './assets/piper/piper_phonemize.wasm',
    './assets/piper/piper_phonemize.data',
  ],
  worker:{
    format:"es",
    rollupOptions:{    
      output:{
        entryFileNames: 'assets/worker.js',
        inlineDynamicImports: true,     
      }
    }
  }, 
  optimizeDeps: {
    include: ["@mintplex-labs/piper-tts-web"],
    esbuildOptions: {
      define: {
        global: "globalThis"
      },
      plugins: []
    }
  },
  plugins: [react(), tailwindcss()],
  build: {
    // Change the output .js filename to not include a hash    
    rollupOptions: {
      // external: ["vscode-webview"],      
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/util/test/setupTests.ts",
  },
});
