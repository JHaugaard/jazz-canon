import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // Dev/preview servers are reached over Tailscale (http://vps8-core:5173 /
  // :4173). Vite blocks unknown Host headers by default; allow the tailnet
  // names.
  server: {
    allowedHosts: ['vps8-core', '.ts.net'],
  },
  preview: {
    allowedHosts: ['vps8-core', '.ts.net'],
  },
})
