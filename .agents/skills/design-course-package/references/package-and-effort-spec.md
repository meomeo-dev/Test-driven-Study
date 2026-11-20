# v2 课程包规范与自底向上课时配额参考

本文件补充 `SKILL.md` 的量化口径、锚点写法与工作流对接细则；基准参照 `courses/golden-course-template`（`v1.1.0`）。

---

## 1. 黄金模板标杆对照（`golden-course-template@1.1.0`）

- 唯一单元 `extended-practice`（题型展示）共 `1` 篇讲义 `lessons/workplace-handover.md`、`5` 个知识点（合计 `65m`）、`15` 道覆盖全部 9 类题型的题目：
  - `workplace-quantities` (`10m`): `numbers-1` (sc), `numbers-3` (mc), `numbers-5` (num) → 估算 ~`7.45m`
  - `workplace-instructions` (`15m`): `sue1-extended-cloze` (2 空), `sue1-extended-judgment` (tf), `sue1-extended-translation` (en→zh), `sue1-extended-translation-zh-to-en` (zh→en), `sue1-extended-writing` (sentence_making), `sue1-extended-reading`（共享）→ 估算 ~`21.85m`
  - `workplace-notices` (`15m`): `sue1-extended-listening` (dialogue, 2 sub_q), `sue1-extended-listening-passage` (passage, 2 sub_q), `sue1-extended-listening-recording` (recording, 2 sub_q), `sue1-extended-reading-single-choice` (2 sub_q) + 共享 `sue1-extended-reading` → 估算 ~`17.42m` ($\eta = 1.16$)
  - `handover-writing` (`20m`): `sue1-extended-writing-short` (40–65w), `sue1-extended-writing-full` (110–160w), + 1 篇阅读/写作相关练习 → 估算 ~`35.19m`
  - `handover-self-check` (`5m`): 零题口语复述自评 → 估算 ~`4.25m` ($\eta = 0.85$)
- 全包 `audit-course-effort`: `65m 声明 / 86.16m 设计估算 | η=1.33 | error=0`。

---

## 2. 题型工时权重与计算模型

每题总设计工时 $= \rho_{\text{bank}} \times \big(T_{\text{solve}}(q) + T_{\text{expl}}(q)\big) / k_q$，其中复盘重刷系数 $\rho_{\text{bank}} = 1.45$，$k_q = |\text{concepts}(q)|$（跨知识点题按 $1/k_q$ 均摊，防止单元汇总膨胀）。

| 题型 (`type`) | 首次作答估算 $T_{\text{solve}}(q)$（分） | 审阅解析 $T_{\text{expl}}(q)$（分） | 典型单题设计计入 ($1.45\times$) |
| --- | --- | --- | --- |
| `true_false` | $0.6 + 0.2 \cdot \mathbb{I}[\text{有音频}]$ | `0.35` | ~`1.4–1.7m` |
| `single_choice` | $0.9 + 0.2 \cdot \mathbb{I}[\text{有音频}]$ | `0.35` | ~`1.8–2.1m` |
| `multiple_choice` | $1.2 + 0.2 \cdot \mathbb{I}[\text{有音频}]$ | `0.40` | ~`2.3–2.6m` |
| `numeric` | `1.1`（长题干计算 $>60$ 汉字加 `0.5`） | `0.35` | ~`2.1–2.8m` |
| `cloze` | $0.6 + 0.6 \times \text{空格数} + N_{\text{en}}(\text{passage})/90$ | `0.50` | 1 空 ~`2.6m`，2 空 ~`3.5m` |
| `reading_comprehension` | $0.5 + N_{\text{cjk}}(P)/250 + N_{\text{en}}(P)/90 + \sum T_{\text{sub}}$ | `0.80` | 2 小题 ~`4.5–6.0m` |
| `listening` | $0.5 + 2.0\max(0.25, N_{\text{spoken}}/110) + \sum T_{\text{sub}}$ | `0.80` | 2 小题 ~`4.5–5.5m` |
| `translation` | $1.0 + \text{文本长度}/R_{\text{dir}} + 0.25 \times \text{key\_terms}$ | `0.50` | 短句 ~`2.6–3.8m` |
| `writing` | `sentence`: $1.5+\bar{w}/12$；`short`: $2.0+\bar{w}/13$；`full`: $3.0+\bar{w}/15$ | `0.8 / 1.2 / 1.5` | `sentence` ~`4.8m` / `short` ~`10.2m` / `full` ~`19.1m` |

*(子题权重 $T_{\text{sub}}$：`true_false` `0.6`、`single_choice` `0.8`、`numeric` `0.9`、`multiple_choice` `1.0`。)*

---

## 3. 讲义小节与零题实操锚点规范

当单元内多个知识点共享同一篇 `lessons/<unit>.md` 时：

1. **小节归属**：用 `## <知识点精确标题>` 或在章节标题下方紧跟 HTML 注释锚点标注归属知识点，确保阅读工时只归属一次、不重复累加：
   ```markdown
   ## 常见安全标志与必须禁止
   <!-- concepts: modal-must, safety-signs -->
   ...
   ```
2. **讲义有效阅读与精读换算**：
   $$T_{\text{read}}(S) = \frac{N_{\text{cjk}}(S)}{250} + \frac{N_{\text{en}}(S)}{90} + 0.15\,(N_{\text{代码块}} + N_{\text{例题/错题}})$$
   设计阶段按精读模仿系数 $\lambda_{\text{study}} = 1.8$ 计入知识点预算。
3. **零题实操/自评锚点（仅当 `itemCount == 0`）**：
   - 口语/小自评：必须在讲义写明有序步骤（`1.` `2.` ...）和 `-` 核对清单（均 $\ge 2$ 项），按 $T_{\text{lab}} = 2.5 k_{\text{steps}} + 1.5 k_{\text{rubric}} + 2.5$ 计入。
   - 大于 `30` 分钟的物理/CAD/电路实验：须额外声明不含无人值守等待（如 3D 打印时长）的真实人工操作拆解：
     ```markdown
     ## 基础定位底板实操
     <!-- concepts: base-plate-lab -->
     <!-- effort-lab: modeling=25, slicing=10, measure_verify=25 -->
     1. 完成定位底板参数化草图与公差建模...
     ```

---

## 4. 典型 `30m` 与 `60m` 课时配额蓝图（给作者与批处理脚本参考）

- **方案 A：1 个 `30m` 英语微知识点（推荐拆分粒度）**
  - **讲义配额（~`10.5m` 设计工时）**：约 `950–1,350` 中文字符（含 `2` 个例题 + `1` 组易错对照）。
  - **题库配额（~`19.5m` 设计工时）**：例如 `1 × listening(2 sub_q)`（~4.8m）+ `1 × cloze(2 blanks)`（~3.5m）+ `1 × writing(sentence_making)` 或 `1 × translation`（~3.8m）+ `3 × single_choice/multiple_choice/true_false`（~6.5m），合计 `6–7` 题、至少覆盖 `3` 种题型。
- **方案 B：1 个 `30m` 理工微知识点**
  - **讲义配额（~`11m` 设计工时）**：约 `1,000–1,400` 中文字符（含原理公式推导 + `2` 道典型计算/工艺例题 + 失效分析）。
  - **题库配额（~`19m` 设计工时）**：例如 `2 × numeric` 多步工程计算（~5.4m）+ `1 × cloze`（参数/规程填空，~3.5m）+ `5 × single_choice/multiple_choice/true_false`（~10.2m），合计 `8` 题。
- **方案 C：把 `60m` 旧大纲课时接入现存精品小课**
  - 严禁把 `lesson_001` 直接当 `unit-01` 覆盖现存 `course.json`；应通过 `unit_map` 对齐现存语义单元（如 `intro`），保留全部旧 `item.id` 与 `concept.id`，按 `60m = 2 × 30m` 微知识点拆分新增内容并在最后递增 `course.json` 版本号。
