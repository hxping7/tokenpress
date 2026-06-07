import { beforeAll, afterAll } from 'vitest'

// This should run first
console.log('✅ vitest.setup.ts LOADED')

throw new Error('SETUP TEST ERROR - if you see this, setup is running')

const TEST_DATA_DIR = 'data-test'

beforeAll(async () => {
  console.log('🔧 beforeAll running...')
}, 30000)

afterAll(() => {
  console.log('🔧 afterAll running...')
})