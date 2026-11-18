# DeepSeek 语音合成整段接口

执行到填写配置的 `provider` 段、核对请求格式，或怀疑接口有变化时加载。本文件的来源、核验日期
与复核期登记在 `index/knowledge-index.yaml` 的条目 `deepseek-tts-api` 中；字段与取值会漂移，以当次
查阅的官方文档为准。

## 结论

本 Skill 只用整段合成接口：每条句子 POST 一次，请求 `pcm`，响应体就是 24 kHz、16 位、单声道的
原始 PCM；工具按实际字节数写 WAV 头，或交给 ffmpeg 编码成 mp3、ogg。鉴权只用 API Key。

## 地址与鉴权

- 整段合成：`POST https://api.deepseek.com/v1/tools/tts`，即配置 `provider.endpoint` 的默认值。
- 请求头：`Authorization: Bearer <API Key>`、`Content-Type: application/json`。
- 接口没有模型参数，文档也没有给出语音合成的模型名。
- 同一路径另有 WebSocket 流式合成（`wss://api.deepseek.com/v1/tools/tts`，分段发送文本、音频帧下发），
  用于边生成边朗读；本 Skill 不使用。

## 请求体

```json
{ "text": "我想喝水", "voice_id": "stella", "format": "pcm", "filter_markdown": false }
```

| 字段 | 必填 | 说明 | 本 Skill 的取值 |
| --- | --- | --- | --- |
| `text` | 是 | 不能为空，最多 10,000 个计费字符；请求体最大 64 KiB | 句库条目原文 |
| `voice_id` | 否 | `stella`（默认）或 `tide`，见 `references/voices-billing-limits.md` | `sets[].voices` |
| `format` | 否 | `wav`（默认）或 `pcm` | 固定 `pcm` |
| `filter_markdown` | 否 | 朗读前是否去掉 Markdown 格式，默认 `true` | `provider.filterMarkdown`，默认 `false` |

- 没有语种参数，语种按文本自动识别；不支持调节语速。
- `filter_markdown` 默认改为 `false`：句库是要逐字朗读的纯文本，`#`、`*` 这类字符不应被当作格式去掉。
  句库确实含 Markdown 时把配置改为 `true`；改动会让整组文件变为 `outdated`。
- 单句超过 10,000 计费字符或请求体超过 64 KiB 时，工具在本地拒绝，不发请求。

## 回包

- 成功：HTTP 200，音频边合成边写进响应体，单次最多 30 分钟音频。`wav` 的 Content-Type 为
  `audio/wav`；`pcm` 为 24 kHz、16 位、单声道的原始 PCM。
- 音频开始返回后合成失败时连接中途断开；官方要求把提前结束的响应视为失败。工具按 `interrupted`
  重试，不写入半个文件。
- 不支持中断后续传：重试就是重新合成整句。
- 为什么请求 `pcm`：流式返回的 WAV 头在长度字段里写什么官方没有说明；工具自己写头，长度字段总是
  等于实际字节数，`verify-audio` 也能据此发现截断。
- 2026-11-17 实测：`stella`、`tide` 各合成「我想喝水」「Good morning.」，返回的 PCM 写成 WAV 后为
  24000 Hz、16 位、单声道，时长 0.9 到 1.4 秒；英文句子不需要语种参数。
- 失败时的状态码与类别见 `references/error-handling.md`。

## 适用边界

- 不覆盖 WebSocket 流式合成、声音复刻、运行时实时合成。
- 错误回包的完整 JSON 形状与超长时的状态码官方没有公开，见 `references/error-handling.md`。
