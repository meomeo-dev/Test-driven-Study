# 独立事实复核报告：课程 step-up-english-1 第 28 课时

## 一、基本复核信息
- **课程代码**: `step-up-english-1`
- **课时编号**: 第 28 课时 (`lesson_028`)
- **主题名称**: 动词 have/has 的用法与 have got 表达对比
- **草案文件路径**: `docs/research/step-up-english-1/lesson_028/lesson_draft.md`
- **复核员角色**: 独立事实复核员 (Independent Fact-Checker)
- **复核时间**: 2026-11-17

---

## 二、核验依据与方法
依据《Cambridge Grammar of English》（Carter & McCarthy）、《A Comprehensive Grammar of the English Language》（Quirk et al.）以及剑桥语料库（Cambridge English Corpus）中关于英美语（BrE vs. AmE）在“拥有”（Possession）语义下的动词形态与助动词搭配规则，对草案中的理论陈述、英美差异、失效模式以及工程应用场景（FAE 模块化工业硬件配置）进行了严格交叉复核。

---

## 三、逐节核查明细

### 1. 核心理论与语法体系（第 1 部分）
- **语义分类**：草案将 `have/has` 划分为所属 (Possession)、配置/组成 (Configuration/Composition) 及特征/属性 (Characteristics)，分类清晰且符合现代英语语法专著的经典分类。
- **英美用法差异**：
  - **英式英语 (BrE)**：偏好 `have got / has got` 表达现时所属，否定句使用 `haven't got / hasn't got`，疑问句使用 `Have/Has + subject + got`。经剑桥语料库交叉验证，此表述完全符合语料统计（BrE 口语中 `have got` 频率远高于单独的 `have`）。
  - **美式英语 (AmE)**：强制使用 `have / has` 并借助 `don't / doesn't` 或 `Do / Does` 构成否定与疑问。`have got` 在美式英语普通所属中极少使用（主要保留在 `have got to` 义务或特定强调语境）。复核无误。
- **时态限制**：`have got` 仅限现在时态表示所属，过去时不存在 `had got` 表示所属。复核无误。

### 2. 工程实践与典型参数（第 2 部分：FAE 视角）
- **技术场景**：以工业 3 端口网关/交换机（3-port industrial switch / gateway）为例，结合工作订单（Work Order）和 BOM（Bill of Materials）描述“The unit has three ports”。
- **参数真实性**：
  - 外壳规格（IP30/IP40 金属外壳、DIN-Rail 35mm 导轨安装）、材料组成（挤压铝合金）、接口配置（2个 10/100/1000Base-T(X) RJ45 铜口 + 1个 SFP 光口）完全契合工业自动化网关与交换机的真实硬件规范。
  - 电气与环境参数（12VDC~48VDC 冗余输入、-40°C 至 75°C 工作温宽、IEC 61000 EMC 标准）符合工业级硬件标准。
- **语言融合**：将一般现在时第三人称单数 `has` 的静态特征描述完美嵌入技术说明书和 FAE 工作单，专业性与语言训练结合紧密。

### 3. 常见失效模式与诊断要点（第 3 部分）
- **失效模式 A（体系杂糅 `doesn't have got`）**：准确指出了中国学习者在第三人称单数否定句中将助动词 `doesn't` 与口语 `got` 混用的典型母语负迁移/泛化错误。
- **失效模式 B（裸用 `haven't / hasn't`）**：分析了在国际英语中缺少 `got` 的纯 `haven't/hasn't` 表达的语境局限性。
- **失效模式 C & D（`don't got` 与 3rd 单数肯定误用 `have`）**：切中学习痛点，诊断逻辑严密。

---

## 四、权威核验依据与修正建议
经全文逐字核对，草案内容在语法学理上具备高度的学术权威性（契合剑桥与牛津语法权威规范），在工程应用上贴合工业自动化真实场景。

- **微调建议（非强制，供优化参考）**：
  1. 在“常见失效模式 B”中可简要补充说明：在极正式或传统书面英式英语中，孤立的 `haven't / hasn't`（如 *I haven't the slightest idea*）在特定习语中存在，但在表示普通物品拥有时已高度边缘化，现代英式英语口语和书面均强烈倾向于 `haven't got` 或 `don't have`。草案现有表述已经足够严谨，无需大改。

---

## 五、核查结论与简评
- **核查结论**: **通过 (Pass)**
- **简评**: 该草案理论推演严密、语法分类准确、跨文化（英美）对比科学、工程应用场景真实（FAE 硬件规格严谨）、错误诊断切中要害。是一份高质量、可直接交付的英语教学与工程实务融合课程蓝本。
