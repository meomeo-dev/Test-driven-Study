import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as llmApi from '../../api/llm';
import * as palaceApi from '../../api/palace';
import * as ttsApi from '../../api/tts';
import { ProviderForm } from './ProviderForm';
import {
  buildProviderUpdate,
  createProviderFormState,
  type AnyProviderSettings,
} from './provider-form-model';

const imageSettingsFixture: palaceApi.ProviderSettings = {
  base_url: 'https://api.openai.com/v1',
  models: ['gpt-image-2'],
  proxy_url: '',
  allow_direct_https: false,
  proxy_auth_configured: false,
  key_configured: true,
  storage: 'system_keyring',
  write_token: 'tok-image',
  ready: true,
  message: 'ok',
};

const llmSettingsFixture: llmApi.LlmProviderSettings = {
  base_url: 'https://api.openai.com/v1',
  models: ['gpt-5.4', 'o4-mini'],
  proxy_url: 'http://127.0.0.1:7890',
  allow_direct_https: false,
  proxy_auth_configured: false,
  key_configured: true,
  storage: 'system_keyring',
  write_token: 'tok-llm',
  ready: true,
  default_model: 'gpt-5.4',
  reasoning_effort: 'medium',
  max_output_tokens_k: 64,
  efforts: ['default', 'medium', 'high'],
  message: 'ok',
  context_budget_k: 274,
  compact_threshold_k: 210,
  compact_reserve_k: 64,
  web_search: 'required',
};

const ttsSettingsFixture: ttsApi.TtsProviderSettings = {
  base_url: 'https://api.deepseek.com/v1/tools/tts',
  voices: ['stella', 'tide'],
  default_voice: 'stella',
  proxy_url: '',
  allow_direct_https: false,
  proxy_auth_configured: false,
  key_configured: true,
  storage: 'system_keyring',
  write_token: 'tok-tts',
  ready: true,
};

function stubFetchJson(payload: unknown) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(
    JSON.stringify(payload),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('provider settings allow_direct_https model', () => {
  it('defaults allow_direct_https to false for image, llm, and tts', () => {
    const cases: Array<['image' | 'llm' | 'tts', AnyProviderSettings]> = [
      ['image', { ...imageSettingsFixture, allow_direct_https: undefined as unknown as boolean }],
      ['llm', { ...llmSettingsFixture, allow_direct_https: undefined as unknown as boolean }],
      ['tts', { ...ttsSettingsFixture, allow_direct_https: undefined as unknown as boolean }],
    ];

    for (const [kind, settings] of cases) {
      const state = createProviderFormState(kind, settings);
      expect(state.allowDirectHttps).toBe(false);
      expect(buildProviderUpdate(kind, state).allow_direct_https).toBe(false);
    }
  });

  it('hydrates and toggles allow_direct_https cleanly across all three provider tabs', () => {
    const imageState = createProviderFormState('image', {
      ...imageSettingsFixture,
      allow_direct_https: true,
    });
    expect(imageState.allowDirectHttps).toBe(true);
    expect(buildProviderUpdate('image', imageState)).toMatchObject({
      base_url: 'https://api.openai.com/v1',
      models: ['gpt-image-2'],
      proxy_url: '',
      allow_direct_https: true,
      clear_key: false,
      reuse_key: false,
    });
    expect(buildProviderUpdate('image', { ...imageState, allowDirectHttps: false }))
      .toMatchObject({ allow_direct_https: false });

    const llmState = createProviderFormState('llm', llmSettingsFixture);
    expect(llmState.allowDirectHttps).toBe(false);
    expect(buildProviderUpdate('llm', {
      ...llmState,
      proxy: '',
      allowDirectHttps: true,
    })).toMatchObject({
      base_url: 'https://api.openai.com/v1',
      models: ['gpt-5.4', 'o4-mini'],
      default_model: 'gpt-5.4',
      proxy_url: '',
      allow_direct_https: true,
    });

    const ttsState = createProviderFormState('tts', ttsSettingsFixture);
    expect(ttsState.allowDirectHttps).toBe(false);
    expect(buildProviderUpdate('tts', {
      ...ttsState,
      defaultVoice: 'tide',
      allowDirectHttps: true,
    })).toMatchObject({
      base_url: 'https://api.deepseek.com/v1/tools/tts',
      default_voice: 'tide',
      proxy_url: '',
      allow_direct_https: true,
      clear_key: false,
    });
  });

  it('renders a default-unchecked Allow direct HTTPS checkbox on all three tabs', () => {
    const cases: Array<['image' | 'llm' | 'tts', AnyProviderSettings]> = [
      ['image', imageSettingsFixture],
      ['llm', llmSettingsFixture],
      ['tts', ttsSettingsFixture],
    ];

    for (const [kind, settings] of cases) {
      const html = renderToStaticMarkup(
        createElement(
          QueryClientProvider,
          { client: new QueryClient() },
          createElement(ProviderForm, {
            kind,
            initial: settings,
            onSaved: () => {},
            onBusy: () => {},
          }),
        ),
      );
      expect(html).toContain('允许直连 HTTPS（Allow direct HTTPS）');
      expect(html).toContain('默认要求远程 HTTPS 服务显式配置代理');
      expect(html).toContain('aria-describedby=');
      expect(html).not.toContain('provider-direct-https is-enabled');
      const directBlock = html.slice(html.indexOf('provider-direct-https'));
      expect(directBlock).not.toContain('checked=""');
    }

    const enabledHtml = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(ProviderForm, {
          kind: 'tts',
          initial: { ...ttsSettingsFixture, allow_direct_https: true },
          onSaved: () => {},
          onBusy: () => {},
        }),
      ),
    );
    expect(enabledHtml).toContain('provider-direct-https is-enabled');
    const enabledBlock = enabledHtml.slice(enabledHtml.indexOf('provider-direct-https'));
    expect(enabledBlock).toContain('checked=""');
  });
});

describe('provider settings API clients serialize allow_direct_https', () => {
  it('normalizes GET responses and serializes allow_direct_https on save and test', async () => {
    const llmGetMock = stubFetchJson({ ...llmSettingsFixture, allow_direct_https: undefined });
    expect((await llmApi.settings()).allow_direct_https).toBe(false);
    expect(llmGetMock).toHaveBeenCalledWith(
      '/api/llm/settings',
      expect.objectContaining({ cache: 'no-store' }),
    );

    const imageGetMock = stubFetchJson({ ...imageSettingsFixture, allow_direct_https: undefined });
    expect((await palaceApi.providerSettings()).allow_direct_https).toBe(false);
    expect(imageGetMock).toHaveBeenCalledWith(
      '/api/palaces/settings',
      expect.objectContaining({ cache: 'no-store' }),
    );

    const ttsGetMock = stubFetchJson({ ...ttsSettingsFixture, allow_direct_https: undefined });
    expect((await ttsApi.settings()).allow_direct_https).toBe(false);
    expect(ttsGetMock).toHaveBeenCalledWith(
      '/api/tts/settings',
      expect.objectContaining({ cache: 'no-store' }),
    );

    const llmSaveMock = stubFetchJson({ ...llmSettingsFixture, allow_direct_https: true });
    const llmSaved = await llmApi.save(
      buildProviderUpdate('llm', { ...createProviderFormState('llm', llmSettingsFixture), allowDirectHttps: true }),
      'tok-llm',
    );
    expect(llmSaved.allow_direct_https).toBe(true);
    const llmSaveInit = llmSaveMock.mock.calls[0]?.[1];
    expect(llmSaveInit?.method).toBe('PUT');
    expect((llmSaveInit?.headers as Record<string, string>)['X-Settings-Token']).toBe('tok-llm');
    expect(JSON.parse(String(llmSaveInit?.body))).toMatchObject({ allow_direct_https: true });

    const llmTestMock = stubFetchJson({ connected: true, available_models: [], message: 'ok' });
    await llmApi.test(
      buildProviderUpdate('llm', createProviderFormState('llm', llmSettingsFixture)),
      'tok-llm',
    );
    expect((llmTestMock.mock.calls[0]?.[1]?.headers as Record<string, string>)['X-Settings-Token'])
      .toBe('tok-llm');
    expect(JSON.parse(String(llmTestMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      allow_direct_https: false,
    });

    const imageSaveMock = stubFetchJson({ ...imageSettingsFixture, allow_direct_https: true });
    const imageSaved = await palaceApi.saveProvider(
      buildProviderUpdate('image', { ...createProviderFormState('image', imageSettingsFixture), allowDirectHttps: true }),
      'tok-image',
    );
    expect(imageSaved.allow_direct_https).toBe(true);
    expect((imageSaveMock.mock.calls[0]?.[1]?.headers as Record<string, string>)['X-Settings-Token'])
      .toBe('tok-image');
    expect(JSON.parse(String(imageSaveMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      allow_direct_https: true,
    });

    const imageTestMock = stubFetchJson({ connected: true, available_models: [], message: 'ok' });
    await palaceApi.testProvider(
      buildProviderUpdate('image', { ...createProviderFormState('image', imageSettingsFixture), allowDirectHttps: true }),
      'tok-image',
    );
    expect((imageTestMock.mock.calls[0]?.[1]?.headers as Record<string, string>)['X-Settings-Token'])
      .toBe('tok-image');
    expect(JSON.parse(String(imageTestMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      allow_direct_https: true,
    });

    const ttsSaveMock = stubFetchJson({ ...ttsSettingsFixture, allow_direct_https: true });
    const ttsSaved = await ttsApi.save(
      buildProviderUpdate('tts', { ...createProviderFormState('tts', ttsSettingsFixture), allowDirectHttps: true }),
      'tok-tts',
    );
    expect(ttsSaved.allow_direct_https).toBe(true);
    expect((ttsSaveMock.mock.calls[0]?.[1]?.headers as Record<string, string>)['X-Settings-Token'])
      .toBe('tok-tts');
    expect(JSON.parse(String(ttsSaveMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      allow_direct_https: true,
    });

    const ttsTestMock = stubFetchJson({ connected: true, available_models: [], message: 'ok' });
    await ttsApi.test(
      buildProviderUpdate('tts', createProviderFormState('tts', ttsSettingsFixture)),
      'tok-tts',
    );
    expect((ttsTestMock.mock.calls[0]?.[1]?.headers as Record<string, string>)['X-Settings-Token'])
      .toBe('tok-tts');
    expect(JSON.parse(String(ttsTestMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      allow_direct_https: false,
    });
  });
});
