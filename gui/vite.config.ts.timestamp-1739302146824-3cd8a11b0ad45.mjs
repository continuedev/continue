// vite.config.ts
import react from "file:///Users/dallin/Documents/code/continuedev/continue/gui/node_modules/@vitejs/plugin-react-swc/index.mjs";
import tailwindcss from "file:///Users/dallin/Documents/code/continuedev/continue/gui/node_modules/tailwindcss/lib/index.js";
import { defineConfig } from "file:///Users/dallin/Documents/code/continuedev/continue/gui/node_modules/vitest/dist/config.js";
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Change the output .js filename to not include a hash
    rollupOptions: {
      // external: ["vscode-webview"],
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/util/test/setupTests.ts"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvZGFsbGluL0RvY3VtZW50cy9jb2RlL2NvbnRpbnVlZGV2L2NvbnRpbnVlL2d1aVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2RhbGxpbi9Eb2N1bWVudHMvY29kZS9jb250aW51ZWRldi9jb250aW51ZS9ndWkvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2RhbGxpbi9Eb2N1bWVudHMvY29kZS9jb250aW51ZWRldi9jb250aW51ZS9ndWkvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gXCJ0YWlsd2luZGNzc1wiO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVzdC9jb25maWdcIjtcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpLCB0YWlsd2luZGNzcygpXSxcbiAgYnVpbGQ6IHtcbiAgICAvLyBDaGFuZ2UgdGhlIG91dHB1dCAuanMgZmlsZW5hbWUgdG8gbm90IGluY2x1ZGUgYSBoYXNoXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgLy8gZXh0ZXJuYWw6IFtcInZzY29kZS13ZWJ2aWV3XCJdLFxuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiBgYXNzZXRzL1tuYW1lXS5qc2AsXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiBgYXNzZXRzL1tuYW1lXS5qc2AsXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiBgYXNzZXRzL1tuYW1lXS5bZXh0XWAsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHRlc3Q6IHtcbiAgICBnbG9iYWxzOiB0cnVlLFxuICAgIGVudmlyb25tZW50OiBcImpzZG9tXCIsXG4gICAgc2V0dXBGaWxlczogXCIuL3NyYy91dGlsL3Rlc3Qvc2V0dXBUZXN0cy50c1wiLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWlWLE9BQU8sV0FBVztBQUNuVyxPQUFPLGlCQUFpQjtBQUN4QixTQUFTLG9CQUFvQjtBQUc3QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztBQUFBLEVBQ2hDLE9BQU87QUFBQTtBQUFBLElBRUwsZUFBZTtBQUFBO0FBQUEsTUFFYixRQUFRO0FBQUEsUUFDTixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxNQUNsQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixTQUFTO0FBQUEsSUFDVCxhQUFhO0FBQUEsSUFDYixZQUFZO0FBQUEsRUFDZDtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
