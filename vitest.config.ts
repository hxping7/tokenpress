import { defineConfig } from 'vitest/config'

export default defineConfig({
  globals: true,
  environment: 'node',
  include: ['apps/server/src/**/*.test.ts'],
  testTimeout: 30000,
})