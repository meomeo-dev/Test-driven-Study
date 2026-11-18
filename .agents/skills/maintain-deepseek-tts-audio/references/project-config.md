# 项目配置、句库与音频清单格式

执行到编写或修改使用者项目的配置文件、句库文件，或需要在项目运行时代码里按句子找到音频文件时
加载。本文件的核验日期登记在 `index/knowledge-index.yaml` 的条目 `project-config` 中。

## 结论

使用者项目提供两类文件：一份配置文件（默认 `deepseek-tts.config.json`，提交进仓库）与每个句库组一份
句库文件（JSON 数组）。工具在每个句库组的输出目录写音频文件与一份音频清单。文件格式由路径模板的
扩展名决定。API Key 不写进配置，只放环境变量或凭据文件。

## 配置文件

```json
{
  "schema": "maintain-deepseek-tts-audio/config-v1",
  "provider": { "endpoint": "https://api.deepseek.com/v1/tools/tts", "filterMarkdown": false },
  "credentials": { "env": "DEEPSEEK_API_KEY", "file": ".env.deepseek-tts" },
  "request": { "concurrency": 4, "timeoutSeconds": 120, "maxRetries": 3 },
  "postprocess": {
    "sentence": { "trimSilence": true },
    "compact": { "trimSilence": true, "sampleRate": 16000, "bitrate": "32k" }
  },
  "sets": [
    {
      "name": "zh",
      "phrases": "content/phrases.zh.json",
      "outputDir": "assets/audio/zh",
      "pathTemplate": "{group}/{voice}/{key}.wav",
      "keyScheme": "fnv1a64",
      "defaultProfile": "sentence",
      "voices": { "female": "stella", "male": "tide" }
    },
    {
      "name": "en",
      "phrases": "content/phrases.en.json",
      "outputDir": "assets/audio/en",
      "pathTemplate": "{voice}/{key}.mp3",
      "defaultProfile": "compact",
      "voices": { "female": "stella" }
    }
  ]
}
```

| 字段 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `schema` | 是 | | 固定为 `maintain-deepseek-tts-audio/config-v1` |
| `provider.endpoint` | 否 | 官方地址 | 只有对接本地模拟服务时才改 |
| `provider.filterMarkdown` | 否 | `false` | 是否让服务端朗读前去掉 Markdown 格式；含义见 `references/deepseek-tts-api.md` |
| `credentials.env` | 否 | `DEEPSEEK_API_KEY` | 环境变量名；设置了就优先于凭据文件 |
| `credentials.file` | 否 | `.env.deepseek-tts` | 凭据文件，相对项目根，`KEY=VALUE` 格式；写 `null` 表示只读环境变量 |
| `request` | 否 | 4、120、3 | 并发数、单次请求超时秒数、可重试错误的重试次数 |
| `postprocess` | 否 | 无 | 处理设置，名称到设置的映射；需要 ffmpeg |
| `sets` | 是 | | 句库组数组；每组一份句库、一个输出目录、一套音色表，组名不重复 |

句库组字段：

| 字段 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `name` | 是 | | 组名，`--set` 用它选组 |
| `phrases` | 是 | | 句库文件，相对项目根 |
| `outputDir` | 是 | | 输出目录，相对项目根；只放本 Skill 生成的音频，其中扩展名为 `.wav`、`.pcm`、`.mp3` 或 `.ogg` 的其他文件会被当作过期文件 |
| `manifest` | 否 | `<outputDir>/manifest.json` | 音频清单 |
| `pathTemplate` | 否 | `{voice}/{key}.wav` | 文件相对 `outputDir` 的路径，必须含 `{voice}` 与 `{key}`，可用 `{group}`、`{set}`；扩展名决定格式 |
| `keyScheme` | 否 | `fnv1a64` | `fnv1a64`：键由原文计算；`id`：键取句库条目的 `id` |
| `voices` | 是 | | 音色名到 voice_id；音色名由项目自取（如 `female`、`male`），出现在路径里 |
| `defaultProfile` | 否 | 无 | 条目没写 `profile` 时用的处理设置 |

所有路径都必须在项目根之内。

## 文件格式与处理设置

| 扩展名 | 内容 | 需要 ffmpeg |
| --- | --- | --- |
| `.wav` | 16 位单声道 PCM 加 44 字节 WAV 头，长度字段等于实际字节数 | 只在用了处理设置时 |
| `.pcm` | 原始 16 位单声道 PCM，没有文件头 | 只在用了处理设置时 |
| `.mp3` | ffmpeg 用 libmp3lame 编码 | 是 |
| `.ogg` | ffmpeg 用 libopus 编码的 Ogg Opus | 是 |

处理设置字段，至少写一项：`trimSilence`（去掉首尾静音，峰值低于 -40 dB 判为静音，首尾各留 30 毫秒）、
`sampleRate`（8000、12000、16000 或 24000，接口返回 24000）、`bitrate`（如 `32k`，只用于 `.mp3` 与
`.ogg`，用在 `.wav`、`.pcm` 的句库组上按配置错误报告）。

## 句库文件

顶层是数组，每项是字符串或对象：

```json
[
  "我想喝水",
  { "text": "现在是", "group": "time", "profile": "sentence" },
  { "text": "请帮我叫护士", "group": "help" }
]
```

- `text`：合成原文，不做任何规范化；去掉首尾空白后不能为空。
- `id`：只在 `keyScheme` 为 `id` 时写，且必须写；字母、数字、`.`、`_`、`-`。
- `group`：路径模板含 `{group}` 时必须写，不含时不能写。用于把音频分到项目的不同目录（如分包）。
- `profile`：处理设置名，覆盖组的 `defaultProfile`。
- 映射到同一文件的重复条目合并；同一文件对应不同原文或处理设置时报错。
- 句库由代码生成的项目，先用项目自己的脚本把句子导出成这个文件，再运行工具。

## 文件名键

`fnv1a64`：对原文的 UTF-8 字节做 FNV-1a 64 位哈希，输出 16 位小写十六进制。句子改一个字就是另一个
文件。项目运行时按同一算法计算键即可找到文件：

```js
function phraseKey(text) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}
```

校验值：空串为 `cbf29ce484222325`，`a` 为 `af63dc4c8601ec8c`，`foobar` 为 `85944171f73967e8`。运行时
不便使用 BigInt，或项目已有别的键算法时，用 `keyScheme: "id"`，由导出脚本把键写进 `id`。

## 音频清单

每个句库组一份，键是文件相对 `outputDir` 的路径，工具每合成成功一条就原子更新一次：

```json
{
  "schema": "maintain-deepseek-tts-audio/manifest-v1",
  "set": "zh",
  "files": {
    "help/female/681a1b8c211fa679.wav": {
      "voice": "female", "key": "681a1b8c211fa679", "text": "请帮我叫护士", "group": "help",
      "voiceId": "stella", "format": "wav", "profile": "sentence",
      "fingerprint": "5f0c2e9a7b1d4c83", "bytes": 98348
    }
  }
}
```

- `fingerprint` 是原文、voice_id、`provider.filterMarkdown`、接口返回的 PCM 规格、文件格式与处理设置
  的摘要；其中任何一项变了，这个文件就是 `outdated`，下次合成时重做。接口地址不计入。
- `bytes` 是写入时的文件大小；与实际大小不同时为 `modified`。
- 有文件而清单没有记录的为 `unrecorded`，按要合成处理：工具无法确认它是用当前设置生成的。
- 清单随音频一起提交，供人工核对与项目测试读取；不要手工编辑。
