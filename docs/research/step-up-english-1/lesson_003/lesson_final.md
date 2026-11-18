# 第 3 课时：国际音标与自然拼读规律：第 3 讲 开闭口双元音 /eɪ/, /aɪ/, /ɔɪ/, /aʊ/, /əʊ/
所属单元：第1单元：国际音标与自然拼读规律

## 1. 核心理论与技术标准
# 调研笔记：双元音滑动口型（Glide）轨迹与发音时长规律

- **课程代码**：`step-up-english-1`
- **第 3 课时**：国际音标与自然拼读规律：第 3 讲 开闭口双元音 `/eɪ/`, `/aɪ/`, `/ɔɪ/`, `/aʊ/`, `/əʊ/`
- **研究主题**：双元音滑动口型（Glide）轨迹与发音时长规律
- **子代理编号**：`topic_1__subagent_1`
- **调研时间**：2026-11-17

---

## 一、 检索关键词与技术标准框架

### 1. 检索关键词
- English diphthongs formant transitions
- Glide trajectory acoustic phonetics
- Two-target vowel models $F_1\text{--}F_2$ plane
- Diphthong duration and demisyllable segmentation
- IEEE Speech Processing standards, ISO acoustic terminology

### 2. 相关标准与学术组织参考
- **IEEE Signal Processing Society / IEEE Transactions on Audio, Speech, and Language Processing**：提供语音信号处理、语图分析、线性预测编码（LPC）、梅尔频率倒谱系数（MFCC）及共振峰轨迹提取的底层算法与工程标准。
- **ISO (International Organization for Standardization)**：声学术语标准（如 ISO 131 - 声学词汇）及电信/多媒体语音传输质量评价规范（PESQ / POLQA），隐式依赖对元音动态共振峰过渡特性的精确还原。
- **Acoustical Society of America (ASA)**：声学期刊标准，为现代英语元音共振峰动态建模、目标欠射（Target Undershoot）及动态轨迹分析提供核心理论框架。

---

## 二、 开闭口双元音核心声学与发音学原理

英语双元音（Diphthongs）不同于单元音（Monophthongs, One-target vowels），属于典型的**双目标元音（Two-target vowels）**。发音过程中发音器官（舌位、唇形、下颌）从起始目标核（Onset Nucleus, $T_1$）向结束目标滑行（Offset Target, $T_2$），在声学共振峰上表现为连续的轨迹变化。

本讲涉及的 5 个开闭口双元音：
1. **/eɪ/**：由半开前元音向闭前元音滑动（如 *face*）
2. **/aɪ/**：由开前元音向闭前元音滑动（如 *price*）
3. **/ɔɪ/**：由半开后元音向闭前元音滑动（如 *choice*）
4. **/aʊ/**：由开前元音向闭后元音滑动（如 *mouth*）
5. **/əʊ/**（或 $/oʊ/$)：由中中央元音向闭后元音滑动（如 *goat*）

---

## 三、 滑动口型（Glide）轨迹规律与 $F_1\text{--}F_2$ 平面建模

### 1. 共振峰变迁规律 ($F_1$ 与 $F_2$)
- **第一共振峰 ($F_1$)**：与舌位高低（Vowel Height）呈强烈的反比关系。舌位高（如 /i/, /u/）时 $F_1$ 较低；舌位低（如 /a/, /ɑ/）时 $F_1$ 较高。因此在 /aɪ/, /aʊ/ 等由开音向闭音滑动的双元音中，$F_1$ 会经历从高到低的显著下降。
- **第二共振峰 ($F_2$)**：与舌位前后（Backness/Frontness）呈正相关。前元音 $F_2$ 极高，后元音 $F_2$ 较低。因此像 /eɪ/, /aɪ/, /ɔɪ/ 结尾处向前元音 /i/ 靠拢时，$F_2$ 呈现明显的上升趋势；而 /aʊ/, /əʊ/ 结尾向后圆唇元音 /u/ 靠拢时，$F_2$ 则显著下降。

### 2. 非线性轨迹与目标欠射（Target Undershoot）
- 声学时频分析（如通过 Praat 进行 10–11 点等时间间隔采样）表明，双元音的共振峰轨迹**绝非直线**。
- 由于语速加快、协同发音（Coarticulation）以及前后音环境的限制，发音人往往无法完全触及理论上的终点目标（$T_2$），这种现象被称为**目标欠射（Target Undershoot）**。
- 现代语音识别与声学建模使用 **离散余弦变换 (DCT) 系数** 或多项式曲线拟合来精确捕捉这种非线性动态轮廓。

---

## 四、 发音时长（Duration）与音节切分规律

1. **内在时长与动态特征**：
   - 双元音的整体绝对时长通常长于松元音（Lax monophthongs），但其本质特征不在于“长”，而在于**轨迹的动态变化率（Dynamic Spectral Change）**。
2. **双音段切分（Demisyllable Segmentation）**：
   - 声学研究将双元音总时长划分为起始核保持段与滑动过渡段。
   - 年轻说话人或特定语境下，双元音的总时长延长，且在起始核心目标（$T_1$）阶段占用的时间比例相对恒定，滑动阶段（Transition）表现出高度对齐的动态特征。
3. **共振峰归一化处理**：
   - 由于不同说话人的声道长度（VTL）差异，绝对频率值差异较大。IEEE 相关研究广泛采用 Nearey 对数均值归一化或 Lobanov 算法，将个体差异映射至标准声学空间。

---

## 五、 结论与教学启示
1. **教学重点**：不能将双元音静态割裂为两个独立元音的简单拼接，而应强调**“从 $T_1$ 到 $T_2$ 的连续平滑滑动轨迹（Glide Trajectory）”**。
2. **口腔肌肉控制**：训练时需关注口型开合度（对应 $F_1$ 变化）与舌位前后移动（对应 $F_2$ 变化）的协调配合，避免发音僵硬或目标欠射。

## 2. 工程实践与典型参数
无资料

## 3. 常见失效模式与诊断要点
无资料
