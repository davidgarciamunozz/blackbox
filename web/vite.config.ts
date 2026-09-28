import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En desarrollo, Vite sirve la app y reenvía el WebSocket y la API al servidor del juego.
const GAME_SERVER = process.env.GAME_SERVER ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // accesible desde los móviles en la red local
    proxy: {
      '/ws': { target: GAME_SERVER, ws: true },
      '/api': GAME_SERVER,
    },
    fs: { allow: ['..'] },
  },
})
