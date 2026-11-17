import { chromium, defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

const chromeLocations = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  path.join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe'),
];
const channel = process.env.PLAYWRIGHT_CHANNEL
  ?? (!existsSync(chromium.executablePath()) && chromeLocations.some(existsSync) ? 'chrome' : undefined);

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:43287', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel } }],
  webServer: [{
    command: 'node tests/fixtures/image-provider.mjs',
    url: 'http://127.0.0.1:43289/health', reuseExistingServer: false,
  }, {
    command: 'npm run course:install -- tests/fixtures/courses/intro-geometry'
      + ' && npm run course:install -- tests/fixtures/courses/concept-graph && npm run dev',
    url: 'http://127.0.0.1:43287/api/health',
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      STUDY_API_PORT: '43288', STUDY_WEB_PORT: '43287',
      STUDY_DATA_DIR: path.resolve('var/browser-acceptance', `run-${process.pid}-${Date.now()}`),
      STUDY_LLM_CONFIG_FILE: path.resolve('var/browser-acceptance/absent-llm-config'),
      GPT_1_BASE_URL: 'http://127.0.0.1:43289/v1', GPT_1_API_KEY: 'isolated-llm-fixture',
      GPT_1_MODELS: 'fixture-reasoner, fixture-secondary', GPT_1_PROXY_URL: '',
      GPT_1_REASONING_EFFORT: 'medium', GPT_1_MAX_OUTPUT_TOKENS_K: '16',
      GPT_1_DEFAULT_MODEL: 'fixture-reasoner', GPT_1_CONTEXT_BUDGET_K: '274',
      GPT_1_COMPACT_THRESHOLD_K: '210', GPT_1_COMPACT_RESERVE_K: '64', GPT_1_WEB_SEARCH: 'required',
      STUDY_IMAGE_CONFIG_FILE: path.resolve('var/browser-acceptance/absent-image-config'),
      GPT_IMAGE2_1_BASE_URL: 'http://127.0.0.1:43289/v1',
      GPT_IMAGE2_1_API_KEY: 'isolated-browser-fixture',
      GPT_IMAGE2_1_MODELS: 'gpt-image-2', GPT_IMAGE2_1_PROXY_URL: '', HTTPS_PROXY: '',
    },
  }],
});
