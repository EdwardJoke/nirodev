import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import {defineConfig} from "vite"
import process from "process"

// https://vite.dev/config/
export default defineConfig({
  // "/" locally; "/<repo>/" when published to GitHub Pages project sites.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Framework code changes far less often than copy or layout does.
        // Keeping it in one long-lived chunk means a daily content update
        // only invalidates the small app chunk for returning readers.
        // Deliberately narrow: the markdown pipeline must stay inside the
        // lazily loaded prose chunk, not end up here.
        manualChunks: (id: string) => {
          const module = id.replace(/\\/g, '/')
          if (!module.includes('/node_modules/')) return undefined
          if (
            /\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@tanstack|clsx|tailwind-merge)\//.test(
              module
            )
          ) {
            return 'vendor'
          }
          return undefined
        },
      },
    },
  },
  server: {
    host: '::',
    port: 5173,
    allowedHosts: true,
    cors: true,
    hmr: {
        protocol: 'wss',
        host: `5173-${process.env.X_IDE_SPACE_KEY}.e2b.${process.env.X_IDE_SPACE_REGION}.${process.env.X_IDE_SPACE_HOST}`
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true
      },
    },
  },
})
