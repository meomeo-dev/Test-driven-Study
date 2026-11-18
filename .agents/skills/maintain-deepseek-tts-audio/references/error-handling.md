# 合成报错的类别与处理

执行到 `synthesize-audio` 或 `preview-voice` 报错时加载。本文件的来源、核验日期与复核期登记在
`index/knowledge-index.yaml` 的条目 `error-handling` 中；状态码以当次查阅的官方文档为准。

## 结论

工具把每个失败归入一个类别，按类别决定重试、停止派发或只停一套音色；输出只含 HTTP 状态与服务端
message 摘要（其中的 Key 被遮盖），不含 Key 与回包原文。

## 类别对照

| 类别 | 判定 | 工具行为 | 处理 |
| --- | --- | --- | --- |
| `auth` | HTTP 401 或 403 | 停止派发其余请求 | 核对 API Key 是否有效、是否已被作废；用 `check-setup` 确认 Key 来自哪里 |
| `balance` | HTTP 402（余额不足） | 停止派发其余请求 | 请用户到 DeepSeek 开放平台查看余额并充值，再重跑 |
| `voice` | HTTP 400（实测 message 为 `Invalid voice_id '<id>': supported values are …`）或 422，message 提到 voice | 停止该音色的其余请求，其他音色照常 | voice_id 写错或不可用；message 列出可用的音色；用 `preview-voice --voice-id` 单独试 |
| `rate-limit` | HTTP 429（账号并发超过上限） | 有 `Retry-After` 时按它等待，没有时等 1、2、4 秒直到最多 16 秒；重试 `request.maxRetries` 次后记失败 | 调低 `request.concurrency` 或加 `--concurrency 1`；检查同一账号是否有其他程序在调用 |
| `text` | 本地检查超过 10,000 计费字符或 64 KiB；HTTP 400（没有可朗读文本，实测 message 为 `No readable text to synthesize`；未通过内容审核 `Content Exists Risk`）或 413 | 记失败 | 看 message：拆短句子、改写被审核拦截的句子，或去掉只有标点与符号的条目 |
| `request` | HTTP 422 或其他 4xx | 记失败 | 核对 `provider` 配置；按 message 修正 |
| `server` | HTTP 500、503（服务繁忙）、504（合成超时）或其他 5xx | 退避重试，用尽后记失败 | 稍后重跑 |
| `network` | 连接失败或超时 | 退避重试，用尽后记失败 | 检查网络与 `provider.endpoint`；长句可调高 `request.timeoutSeconds` |
| `interrupted` | HTTP 200 后音频返回到一半连接断开 | 退避重试，用尽后记失败；不写半个文件 | 稍后重跑；同一句反复断开时用 `preview-voice` 单独试 |
| `protocol` | HTTP 200 但没有音频、字节数为奇数，或返回了 JSON | 记失败 | 文本可能只有标点或 Markdown 符号；检查句库中的这一条 |
| `postprocess` | ffmpeg 处理失败或处理后没有声音 | 记失败 | 看 ffmpeg 的报错；整段被判为静音时先用 `preview-voice` 听原始音频 |

## 依据与未公开项

- 语音合成页公开的状态码：400（没有可朗读的文本，或未通过内容审核）、429、503、504。401、402、
  413、422、500 取自通用错误码页。
- 2026-11-17 实测：音色不存在与没有可朗读文本都返回 HTTP 400，message 末尾带
  `(request_id: <id>)`；向服务方报障时附上它。
- 未公开、按假设判定的项：文本超长时服务端的状态码（工具先在本地拒绝）、错误回包的完整 JSON 形状
  （工具依次取 `error.message`、`message`、`detail` 或纯文本，实测能取到 message）、429 是否带
  `Retry-After`、内容审核拦截的 message。遇到与上表不符的应答，记下状态码与 message 报给用户。
- 中途断开是否计费官方没有说明。
- 部分条目失败时，已成功的条目已经写进音频清单；修正原因后重跑 `synthesize-audio` 只补没成功的。

## 未就绪（退出码 3）

| 输出 | 处理 |
| --- | --- |
| 缺配置文件 | 运行 `init-project` 生成骨架 |
| 缺句库文件 | 按配置 `sets[].phrases` 的路径提供句库 |
| 音色未填 | 在配置 `sets[].voices` 填 voice_id |
| 环境变量与凭据文件都没有 Key | `check-setup` 列出凭据文件里的变量名与格式问题（冒号写法、被注释、引号不成对、BOM）；变量名不同时把配置 `credentials.env` 改成文件里的名字，否则请用户修正凭据文件或设置环境变量 |
| 本机找不到 ffmpeg 或缺编码器 | 安装 ffmpeg（macOS 可用 `brew install ffmpeg`，带 libmp3lame 与 libopus），或改用 `.wav` 并去掉处理设置 |
