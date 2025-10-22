import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'], // Specifies the entry point(s) of your library
  target: 'esnext', // Sets the JavaScript target version
  format: ['esm', 'cjs'], // Defines the output module formats (ESM and CommonJS)
  outDir: 'dist', // Specifies the output directory for bundled files
  dts: true, // Enables generation of TypeScript declaration files
});