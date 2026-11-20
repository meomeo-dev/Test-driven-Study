---
name: design-course-package
description: >-
  指导从零规划、扩编、重构或审计符合 v2 课程包规范与 golden-course-template 基准的可安装课程包
  （courses/<id>/course.json、lessons/*.md、questions/*.json）：拆分单元/讲义/知识点/题库层次、
  设计无环先修知识图谱与学习路径节点、按目标课时与自底向上工作量模型反推讲义字数与多题型配额
  （防止高学时低题量空壳或共享讲义重复计入）、规范零题实操自评锚点，并执行课时质量门与课程校验。
  新建课程包、把课时大纲转为课程包、重校准课程 estimated_minutes 与题量配比时使用；
  纯声明式 TTS 切片与音色规则由 design-course-tts 负责。
---

# 课程包设计与课时对齐

为 `courses/<id>/` 设计结构清晰、知识图谱有效、**内容量与设计课时自底向上严格匹配**的 v2 可安装课程包
（基准参照 `courses/golden-course-template`）。本文是索引：只保留核心决策、配额规则与四重质量门；
完整题型权重矩阵、HTML 锚点写法与大纲映射细节在 `references/package-and-effort-spec.md`，执行到对应环节再加载。

## 触发与形态

- [主观] 从零设计课程包、把课时大纲（`syllabus_180h.json`）或历史研学稿件转化为可安装 v2 课程包。
- [自动+主观] 评估或修复课程包的“学时—内容量”失配（如 60 分钟课时仅 3–5 道短单选题、零题自评虚标 60–110 分钟）。
- [主观] 边界划分：题库 JSON 的 `tts`/`tts.text`/`pinyin`/`transcript` 细则由 `design-course-tts` 负责；静态音频文件离线生成由 `maintain-deepseek-tts-audio` 负责。

## 五层自底向上结构与分工

| 层级 | 载体与标识规则 | 职责与守恒约束 |
| --- | --- | --- |
| **题目** (`Item`) | `questions/<unit>.json`；`id` 匹配 `[a-zA-Z0-9_-]+` | 最小练习与考核单位；必须通过 `concepts: ["<id>"]` 关联同单元知识点，多标按 $1/k_q$ 向上分摊耗时 |
| **讲义** (`Lesson`) | `lessons/<lesson-slug>.md`；ID 须为小写横杠 `^[a-z0-9]+(-[a-z0-9]+)*$` | 学习材料载体（无独立时长字段）；共享讲义按 `## <Concept Title>` 或 `<!-- concepts: ... -->` 分节归属，未匹配前沿/总结均摊，严禁重复计入 |
| **知识点** (`Concept`) | `units[].concepts[]`；含 `estimated_minutes` (`1..600`) | 唯一原子学时真值与掌握判定单元（`min(3, n)` 对题且正确率 $\ge 75\%$）；零题实操/自评须用步骤+清单或 `effort-lab` 锚定 |
| **单元** (`Unit`) | `units[]`；绑定 `question_file`、`lessons[]`、`concepts[]` | `UnitMinutes ≡ sum(concept.estimated_minutes)`，由下层自底向上求和得出，不另写冗余总额字段 |
| **课程** (`Course`) | `course.json`（`protocol_version: 2`，SemVer `version`） | `CourseHours ≡ sum(UnitMinutes) / 60`；升版改内容必须递增 `version` 并用 `course:install` 更新 |

## 按课时倒推配额（核心设计口径）

规划阶段**先算配额、再写讲义与出题**（详表见 `references/package-and-effort-spec.md`）：

1. **预算分解**：单个计分知识点目标设计工时 `design_minutes(c)`（匹配 `estimated_minutes`）拆分如下：
   - **讲义精读与例题 (~35%)**：$1.8 \times T_{\text{read}}(S)$（中文约 250 字/分、英文约 90 词/分、例题/代码块额外计入）。如 `30m` 知识点对应约 `850–1,400` 字结构化讲解、例题与错题对照。
   - **题库训练与间隔复盘 (~65%)**：$1.45 \times \sum T_{\text{item}}(q)$。不要只靠 3 道短单选凑数——按 2–5 分钟/题计权，用 `single_choice`/`multiple_choice`/`true_false`/`numeric` 搭配重型 v2 题型（`cloze`、`listening`、`reading_comprehension`、`translation`、`writing`）填满练习预算。
2. **微知识点粒度**：长课时（如 60 分钟）优先拆为 `25–35` 分钟的 2 个聚焦知识点（例如“规则讲解+听说辨析”与“综合读写应用”），减少学习路径单步跨度并防止 3 分钟速通刷绿。
3. **零题自评与实操节点**：`itemCount == 0` 的口语自评通常 `5–15` 分钟；超过 `30` 分钟的硬件/CAD 实操必须在讲义对应小节给出分步步骤与验收清单，并使用 `<!-- effort-lab: modeling=25, test=20 -->` 声明各环节真实人工耗时（不含无人值守等待时间）。
4. **容忍区间（匹配度 $\eta = T_{\text{design}} / \text{estimated\_minutes}$）**：
   - **平衡区间**：$0.70 \le \eta \le 1.40$（速通通关下限 `first_pass` 不低于声明学时的 $20\%$）。
   - **阻断阈值**：$\eta < 0.50$ 判为严重注水空壳，$\eta > 2.50$ 判为严重超载。

## 流程

- [主观] **确认目标与版本契约**：明确课程受众、语言/工科定位、目标总学时，确认使用 `protocol_version: 2` 且新改动递增 `course.json` 版本号。
- [主观] **搭知识图谱与预算拆解**：设计语义化 `units`、`lessons`、`concepts`（无环 `prerequisites`，`estimated_minutes` 设真实目标），用 `references/package-and-effort-spec.md` 为每个知识点算出讲义字数与分题型配额。
- [主观] **写讲义与 v2 题库**：在共享讲义用 `<!-- concepts: id -->` 与 `## <Concept Title>` 对齐章节（杜绝 `"无资料"`/`TODO` 占位）；题库按配额编写 v2 题型（`true_false` 用 `grading.value` + `analysis`，`numeric` 含 `absolute_tolerance`，解析不写死 `选项 a/b/c/d`）。
- [自动] **四重质量门验收**：
  1. TTS 审计：`node .agents/skills/design-course-tts/scripts/audit-course-tts.mjs courses/<id>`（清零 error 与 warning）。
  2. 课时内容量门：`node scripts/audit-course-effort.mjs courses/<id>`（新课建议加 `--strict`，确认 $\eta$ 与速通比达标）。
  3. 课程结构校验：`npm run course:check -- courses/<id>`（0 未标注题、无环、Schema 通过）。
  4. 本地安装验证：`npm run course:install -- courses/<id>`。

## 失败与纠正反馈

1. 若 `audit-course-effort` 报 `SEVERE_UNDER_STUFFED_CONCEPT` / `FAST_MASTERY_BYPASS`：**优先按配额扩充重型题型或深案例讲义**；若课程定位本就是轻量示范/微课，则**诚实下调 `estimated_minutes`** 对齐真实学习时间，严禁虚标凑数。
2. 若报 `ZERO_ITEM_UNANCHORED_HIGH_HOURS`：补齐实操分步清单与 `effort-lab` 锚点，或把高虚标口语/实验课时降为真实人工操作时长。
3. 若从旧 18 单元 `syllabus_180h.json` 扩展现存精品课程包：必须通过显式 `unit_map` 保留既有 `unit.id`、`concept.id` 与 `item.id`，以免破坏学习者历史作答与知识点掌握记录。

## 贯穿原则

- **学时即工作量承诺**：每个声明出的分钟数都必须有对应密度的讲义案例或练习题背书，绝不用最低 3 题去撑 60 分钟。
- **单一真值、自底向上**：只有 `concept.estimated_minutes` 写时长，单元与课程总学时由下层客观汇总并经静态守恒校验，不手工填两份数字。
- **四门全过才算完**：结构合法 + TTS 合格 + 内容量匹配 + 可安装，缺一不可。

## 指针

- `references/package-and-effort-spec.md` —— `golden-course-template` 标杆口径、9 类题型工时权重、讲义锚点写法、大纲映射与四重检查命令参考。

执行到具体估算或改写环节再加载 `references/package-and-effort-spec.md`，不要一次全读。
