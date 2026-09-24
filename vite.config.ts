import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { youtubePlaylistApi } from './server/vitePlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  // youtubePlaylistApi: GET /api/youtube/playlist in dev and preview (see server/).
  plugins: [react(), tailwindcss(), youtubePlaylistApi()],
})
