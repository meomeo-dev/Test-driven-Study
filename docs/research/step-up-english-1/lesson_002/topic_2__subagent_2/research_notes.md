# 国际音标与自然拼读规律研究报告：第 2 讲 中元音与后元音 /ɜː/, /ə/, /uː/, /ʊ/

## 1. 现场应用与工程背景 (Field Application Context)
在英语语音教学与语音识别/合成（ASR/TTS）工程中，中元音（`/ɜː/`, `/ə/`）与后元音（`/uː/`, `/ʊ/`）的重读与弱读（Vowel Reduction）是决定自然度与词义辨识的核心参数。拼写组合 `er/ir/ur/oo/u` 在不同的重音配置（Stress Configuration）下表现出高度动态的音位映射特征。

## 2. 核心字母组合与音标参数矩阵 (Parameter Matrix)

| 字母组合 (Spelling) | 重读音位 (Stressed Form) | 弱读/非重读音位 (Unstressed/Reduced Form) | 典型工程案例 (Typical Examples) |
| :--- | :--- | :--- | :--- |
| **er** | `/ɜː/` (英) / `/ɝ/` (美) | `/ə/` (Schwa) | *term* /tɜːm/ vs. *teacher* /ˈtiːtʃə/ |
| **ir** | `/ɜː/` (英) / `/ɝ/` (美) | N/A (多见于重读音节) | *bird* /bɜːd/, *first* /fɜːst/ |
| **ur** | `/ɜː/` (英) / `/ɝ/` (美) | `/ə/` (极少数复合词弱化) | *turn* /tɜːn/, *nurse* /nɜːs/ |
| **oo** | `/uː/` 或 `/ʊ/` | `/u/` (语流中弱化) | *food* /fuːd/, *foot* /fʊt/ |
| **u** | `/ʌ/`, `/juː/`, `/ʊ/` | `/ə/` (元音弱化核心位点) | *cut* /kʌt/, *supply* /səˈplaɪ/ |

## 3. 规程与实操准则 (Operational Rules)
1. **重读控制规程**：当 `er`、`ir`、`ur` 位于重读音节时，必须保持长元音 `/ɜː/` 的口腔紧张度与中央舌位（R-colored 特征），避免发成短元音。
2. **弱化演进规程**：当多音节词发生重音前移或后移时，后缀 `er` 或词中字母 `u` 自动弱化为中性哑音/短促的舒瓦音 `/ə/`（如 *support* /səˈpɔːt/）。
3. **闭音节与开音节对齐**：`oo` 组合在双辅音前多发短音 `/ʊ/`（如 *book*），在长音环境下发 `/uː/`（如 *moon*），需严格依据音节结构进行合规拼读。

## 4. 参考出处 (References)
- Wikipedia: English Vowels and Phonotactics
- English Radar Phonetic Documentation
- Logic of English R-Controlled Vowels Stacking Specs
