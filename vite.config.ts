import react from '@vitejs/plugin-react-swc'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'

const chunks = {
  'game-arknights': [/\/src\/components\/arknights\//, /\/src\/pkg\/cpp-arknights\//],
  // 'game-re1999-data': [/\/src\/pkg\/cpp-re1999\/data\//],
  'game-re1999': [/\/src\/components\/re1999\//, /\/src\/pkg\/cpp-re1999\//],
} as Record<string, RegExp[]>

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), visualizer(), svgr()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          // 每个分组会把它模块的依赖一并拉进来；按优先级先分 vendor、再分 app，
          // 游戏和语言包分组就只剩下自己的模块，不会把共享代码吞进去。
          groups: [
            { name: 'vendor', test: (id) => chunkOf(id) === 'vendor', priority: 3 },
            { name: 'app', test: (id) => chunkOf(id) === 'app', priority: 2 },
            { name: chunkOf, priority: 1 },
          ],
        },
      },
    },
  },
})

function chunkOf(id: string): string | null {
  if (isCSSRequest(id)) return null

  if (isInNodeModules(id)) {
    return 'vendor'
  }

  for (const chunk in chunks) {
    if (chunks[chunk].some((regex) => regex.test(id))) {
      return chunk || null
    }
  }

  if (id.includes('/po/') && id.endsWith('.json')) {
    return 'po-' + id.split('/po/')[1].replace(/\.json$/, '')
  }

  if (id[0] !== '/') return null
  return 'app'
}

const CSS_LANGS_RE = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/
const isCSSRequest = (request: string): boolean => CSS_LANGS_RE.test(request)

function isInNodeModules(id: string): boolean {
  return id.includes('node_modules')
}
