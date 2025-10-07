import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: {
    build: true,
  },
  minify: false,
  unbundle: true,
  sourcemap: true,
  treeshake: true,
  clean: true,
  outDir: 'dist',
  entry: ['src/index.ts'],
  format: ['cjs'],
});
