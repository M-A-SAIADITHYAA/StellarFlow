import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util', 'events', 'http', 'https', 'url'],
      globals: { Buffer: true },
    }),
  ],
  build: {
    target: 'es2020',
  },
});
