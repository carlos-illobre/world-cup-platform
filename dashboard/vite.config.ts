// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createLogger } from "vite";

const customLogger = createLogger();
const originalInfo = customLogger.info;
customLogger.info = (msg, options) => {
  if (msg.includes('Local:') || msg.includes('Network:')) {
    if (msg.includes('Local:')) {
      originalInfo(`  ➜  Dashboard Real URL: \x1b[36m${process.env.DASHBOARD_URL || 'https://dashboard.localhost'}\x1b[0m`, options);
    }
    return; // Supresor visual de las IPs internas
  }
  originalInfo(msg, options);
};

export default defineConfig({
  vite: {
    customLogger,
    server: {
      watch: {
        usePolling: true,
      },
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    preset: "node-server",
  },
});
