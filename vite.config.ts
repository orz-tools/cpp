import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { visualizer } from 'rollup-plugin-visualizer'

const chunks = {
  'game-arknights': [/\/src\/components\/arknights\//, /\/src\/pkg\/cpp-arknights\//],
  'game-re1999-data': [/\/src\/pkg\/cpp-re1999\/data\//],
  'game-re1999': [/\/src\/components\/re1999\//, /\/src\/pkg\/cpp-re1999\//],
} as Record<string, RegExp[]>

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), visualizer() as PluginOption],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id, meta) => {
          if (isCSSRequest(id)) return

          if (isInNodeModules(id)) {
            return 'vendor'
          }

          for (const chunk in chunks) {
            if (chunks[chunk].some((regex) => regex.test(id))) {
              return chunk || null
            }
          }

          if (id[0] !== '/') return null
          return 'app'
        },
      },
    },
  },
})

const CSS_LANGS_RE =
  // eslint-disable-next-line regexp/no-unused-capturing-group
  /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/
const isCSSRequest = (request: string): boolean => CSS_LANGS_RE.test(request)

function isInNodeModules(id: string): boolean {
  return id.includes('node_modules')
}
