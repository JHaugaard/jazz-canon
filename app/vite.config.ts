import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // Preview server is reached over Tailscale at http://vps8-core:4173.
  // Vite blocks unknown Host headers by default; allow the tailnet names.
  preview: {
    allowedHosts: ['vps8-core', '.ts.net'],
  },
})
