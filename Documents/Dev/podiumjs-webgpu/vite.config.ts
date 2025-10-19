import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'PodiumJS',
      formats: ['es', 'umd'],
      fileName: (format) => `podium.${format === 'es' ? 'esm' : format}.js`,
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
      },
    },
  },
  server: {
    host: true,
    port: 3000,
  },
});