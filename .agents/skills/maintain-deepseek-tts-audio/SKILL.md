---
name: maintain-deepseek-tts-audio
description: >-
  用 DeepSeek 语音合成（/v1/tools/tts 整段接口，音色 stella、tide）为项目的静态句库预先生成多套音色
  的音频文件并持续维护：比对句库与现有音频、只合成缺失或过期的条目、清理不在句库中的文件、核对是否
  齐全、试听或更换音色、初始化与排查 DeepSeek API Key 配置、处理合成报错。句库位置、分组目录、文件
  命名、格式（wav、pcm、mp3、ogg）与音色由项目的配置文件声明。改了句子要补语音、「这句没声音」「声音
  不对」「换成男声」「重新生成音频」、核对或清理旧语音、配置 DeepSeek 语音的 Key、合成接口报 401、
  402 余额不足、429 限流或音色错误时使用。不用于运行时实时或 WebSocket 流式合成、声音复刻、其他服务商
  的语音合成或音频剪辑。
---

# DeepSeek 语音：静态句库的预生成音频维护

把一份静态句库的每条句子、每套音色合成为一个音频文件，随项目一起发布；句子或音色变化后只补做
受影响的文件。本文是索引：只留流程骨架、执行边界与指针，细节在 `references/`，执行到对应环节
再加载。

## 触发与形态

- [主观] 项目里有一份固定的句子清单，要预先生成音频文件随项目下发（应用内播报、按键朗读、
  提示音），并在句子增删改、换音色后保持音频与句库一致。
- [主观] 用户说句子没有声音、声音不对、要换音色或试听、要重新生成或清理音频、要配置或排查
  DeepSeek 语音的 Key、合成报错。
- [主观] 不属于本技能：运行时按用户输入实时合成、WebSocket 流式朗读、声音复刻、其他服务商、
  音频剪辑与混音。

## 前提与边界

- Node.js 18.3 或更新版本；工具只用 Node 标准库，安装后不需要 `npm install`。
- 输出格式由路径模板的扩展名决定：`.wav`、`.pcm` 不需要 ffmpeg；`.mp3`、`.ogg` 与处理设置
  （`postprocess`：去首尾静音、降采样、码率）需要本机的 ffmpeg 与对应编码器。
- 合成与试听需要网络，按计费字符收费（汉字算 2 个）；比对、核对、清理与初始化不联网。
- 接口只有 `stella`（女声）与 `tide`（男声）两个音色，语种自动识别，不能调语速。
- 项目差异全部写在使用者项目的配置文件（默认 `deepseek-tts.config.json`）与句库文件里：句库位置、
  分组目录、文件命名规则、格式、音色、处理设置。格式见 `references/project-config.md`。
- 输出目录只放本技能生成的音频：其中扩展名为 `.wav`、`.pcm`、`.mp3` 或 `.ogg`、却不对应句库的文件
  会被当作过期文件。

## 凭据

- API Key 只放在环境变量（默认 `DEEPSEEK_API_KEY`）或配置声明的凭据文件（默认
  `.env.deepseek-tts`，`KEY=VALUE` 格式）；环境变量优先。不写进配置文件、句库或提交。
- `init-project` 生成的凭据模板只含键名，权限 600；`check-setup` 核对 Key 来自哪里、文件权限与
  是否被 Git 忽略，只报变量名与路径。
- Agent 不读取、不打印、不转述凭据文件的内容；需要填写或更换 Key、充值余额时请用户自己操作。
  工具的输出不含 Key 与回包原文。

## 场景到命令

`<skill-root>` 指本 SKILL.md 所在目录；`--root` 指使用者项目根目录。

| 场景 | 命令 |
| --- | --- |
| 首次接入：生成配置骨架与凭据模板 | `node <skill-root>/scripts/init-project.mjs --root .` |
| 核对配置、句库、Key、权限、Git 忽略与 ffmpeg | `node <skill-root>/scripts/check-setup.mjs --root .` |
| 看要合成几条、计费字符多少、有哪些过期文件 | `node <skill-root>/scripts/plan-audio.mjs --root .` |
| 只列出将要合成的条目，不联网 | `node <skill-root>/scripts/synthesize-audio.mjs --root . --dry-run` |
| 补齐缺失与过期的音频 | `node <skill-root>/scripts/synthesize-audio.mjs --root .` |
| 分批合成，本次最多 20 条 | `node <skill-root>/scripts/synthesize-audio.mjs --root . --limit 20` |
| 服务端音色更新后整套重做一套音色 | `node <skill-root>/scripts/synthesize-audio.mjs --root . --force female` |
| 核对是否齐全且与配置一致 | `node <skill-root>/scripts/verify-audio.mjs --root .` |
| 预览要删除的过期文件 | `node <skill-root>/scripts/prune-audio.mjs --root .` |
| 删除过期文件与清单记录 | `node <skill-root>/scripts/prune-audio.mjs --root . --apply` |
| 用配置里的音色试听一句 | `node <skill-root>/scripts/preview-voice.mjs --root . --text "我想喝水" --voice female` |
| 试听另一个 voice_id，或试听 mp3 效果 | `node <skill-root>/scripts/preview-voice.mjs --root . --text "我想喝水" --voice-id tide --format mp3` |

每个工具都支持 `--help`、`--json`、`--set <句库组>`（试听只取一个）与 `--config <文件>`；退出码
0 成功，1 失败（含核对不通过、部分条目合成失败），2 用法错误，3 未就绪（缺文件、音色未填、
没有 Key、缺 ffmpeg 或编码器）。

## 流程

- [自动] **就绪**：先运行 `check-setup`。退出码 3 时按输出补配置、句库或 Key；退出码 1 时先修
  权限与 Git 忽略。没有配置时运行 `init-project`，再请用户填句库路径与 Key（模板已填两个音色）。
- [自动] **比对**：运行 `plan-audio`，读出每个句库组要合成的条数、原因（`missing`、`unrecorded`、
  `outdated`、`modified`、`forced`）、计费字符与过期文件。
- [交互] **费用确认**：换音色、`--force`、改 `filterMarkdown` 或首次接入这类整套合成，先把条数与
  计费字符告诉用户，得到确认再合成；日常补几条句子不必单独确认。条目很多时用 `--limit` 分批。
- [自动] **合成**：运行 `synthesize-audio`。部分失败时按输出的类别处理（见
  `references/error-handling.md`），修正后重跑，只补没成功的条目。`auth` 或 `balance` 会停止
  全部请求：把类别与 HTTP 状态告诉用户，由用户换 Key 或充值，不要反复重跑。
- [自动] **清理**：`plan-audio` 或 `verify-audio` 报过期文件时，先运行 `prune-audio` 预览，确认
  列出的都是已删除或已修改句子的旧文件，再加 `--apply`。
- [自动] **核对**：运行 `verify-audio`，退出码 0 才算完成。
- [人工] **提交**：提交音频文件、音频清单、句库与配置的改动；不提交凭据文件与试听文件（默认写在
  系统临时目录）。

常见情形：

- **改了句子**：比对 → 合成 → 清理 → 核对。新增句子只合成新句子的每套音色；删除或修改句子
  后，旧文件成为过期文件。
- **换音色**：先用 `preview-voice` 试听候选音色，用户选定后改配置 `sets[].voices`，比对会把这一套
  全部标为 `outdated`，经费用确认后合成。音色与语种见 `references/voices-billing-limits.md`。
- **声音不对或某句没声音**：`verify-audio` 看这句是缺失、过期、被改动还是文件头损坏；需要时用
  `preview-voice` 听同一句的原始合成结果，判断是句子、音色还是处理设置的问题。
- **要压缩体积**：把路径模板扩展名改为 `.mp3` 或 `.ogg`，或加带 `sampleRate`、`bitrate` 的处理
  设置；整组会变为 `outdated`，经费用确认后合成，再用 `prune-audio` 清掉旧格式的文件。

## 失败与纠正反馈

某步骤失败或用户纠正做法时，把哪一步、什么错误、怎么改的告诉用户；只管这一次的纠正照做。遇到
`references/error-handling.md` 没有列出的状态码或 message，记下状态码与 message 报给用户。需要修改
本技能本身时，告诉用户由维护者更新；不要修改本技能的安装目录：它是发布副本，改动不会回到维护者
手里，下次更新时也会被覆盖。

## 贯穿原则

- 先比对再合成：真实请求花钱，`plan-audio` 与 `--dry-run` 不联网。
- 只做必要的合成：一个文件只有在缺失、没有记录、设置变了或被改动时才重做。
- 清理默认只预览；删除需要 `--apply`。
- 音频清单由工具维护，不手工编辑。

## 指针

- `references/project-config.md` —— 配置文件、句库文件、路径模板、文件格式与处理设置、文件名键算法
  与音频清单格式。
- `references/deepseek-tts-api.md` —— 接口地址、鉴权、请求体与回包；接口变化时先核对这里。
- `references/voices-billing-limits.md` —— 音色与语种、计费口径与价格、并发上限。
- `references/error-handling.md` —— 报错类别、工具的重试与停止行为、处理方法。
- `index/knowledge-index.yaml` —— 以上知识的来源、核验日期与复核期。
- `templates/deepseek-tts.config.json.tpl`、`templates/credentials.env.tpl` —— `init-project` 用的配置
  骨架与只含键名的凭据模板。
- `scripts/` —— 七个工具；共享代码在 `scripts/lib/`（命令行外壳、配置、凭据、接口、比对、编码）。
- `tests/` —— `node --test <skill-root>/tests/` 运行全部测试；`tests/mock-deepseek-server.mjs` 是不联网
  的本地模拟服务，覆盖成功、鉴权失败、余额不足、限流、音色不存在、输入超长、审核拦截与中途断开。

执行到对应环节再加载对应 reference，不要一次全读。
