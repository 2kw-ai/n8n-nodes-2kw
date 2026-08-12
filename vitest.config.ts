import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests live outside nodes/ deliberately. `@n8n/scan-community-package` —
    // the gate for n8n's verified programme — lints
    // `{nodes,credentials}/**/*.{js,ts,json}` and disables inline config, so a
    // test fixture like `{ name: 'prod (v9)', value: 'v-9' }` under nodes/ is
    // read as a node parameter and fails `node-param-display-name-miscased`
    // with no way to suppress it (#363).
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
