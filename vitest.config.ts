import { mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, {
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/pkg/cpp-core/**/*.ts', 'src/pkg/cpp-arknights/**/*.ts'],
      exclude: ['**/*.d.ts', '**/*.test.ts'],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
    },
  },
})
