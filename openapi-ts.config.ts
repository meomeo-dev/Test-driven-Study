import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './contracts/http/openapi.yaml',
  output: './web/src/api/generated',
  plugins: ['@hey-api/typescript'],
});
