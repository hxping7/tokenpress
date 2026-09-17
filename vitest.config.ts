import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 这些选项必须放在 `test` 下：放在顶层会被 vite 忽略 → 退回默认收集规则，
  // 把 apps/server/dist/**/*.test.js（编译产物）也收进来，与源码测试并行抢同一份
  // data-test/test.db，导致 SQLITE_BUSY: database is locked（9 个用例失败）。
  test: {
    globals: true,
    environment: 'node',
    include: ['apps/server/src/**/*.test.ts'],
    testTimeout: 30000,
  },
})