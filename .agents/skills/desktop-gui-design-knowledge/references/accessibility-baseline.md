# 可访问性基线（Accessibility Baseline）

执行到确定颜色对比度、点击目标尺寸、焦点可见性、地标与键盘焦点顺序时加载。来源、核验日期
与复核期登记在 `index/knowledge-index.yaml` 的条目 `accessibility-baseline`；正文只写结论
与可操作的事实。

## 1. WCAG 2.2 条款

| 条款 | 级别 | 要求 |
| --- | --- | --- |
| 1.4.3 Contrast (Minimum) | AA | 正文 4.5:1，大字 3:1 |
| 1.4.6 Contrast (Enhanced) | AAA | 正文 7:1，大字 4.5:1 |
| 1.4.11 Non-text Contrast | AA | 图标、边框、控件状态等非文本元素 3:1 |
| 1.4.1 Use of Color | A | 不能只靠颜色传达信息 |
| 2.5.8 Target Size (Minimum) | AA | 点击目标不小于 24×24 CSS px（有例外） |
| 2.4.11 Focus Not Obscured (Minimum) | AA | 获得焦点的元素不被固定表头、浮层等完全遮挡 |
| 1.3.2 Meaningful Sequence | A | 视觉顺序与文档顺序一致 |
| 2.4.3 Focus Order | A | 焦点顺序保持含义与可操作性 |
| 2.4.6 Headings and Labels | AA | 标题与标签说明用途 |

- 次级文字、过期数据等降低对比的文字仍须满足 1.4.3。
- 状态同时用颜色之外的手段表达：文字、图标、字重或形状。

## 2. 结构与焦点

- 主要区域用 `banner`、`navigation`、`main`、`complementary`、`region` 地标（landmark）并
  命名；标题不跳级。
- 保留 `:focus-visible` 焦点环，不全局写 `outline: none`。
- 复合控件（列表、网格、树、工具栏、页签）内用 roving tabindex 或 `aria-activedescendant`
  管理焦点：Tab 进入控件，方向键在控件内移动。
- 区域之间的焦点循环（F6 与 Shift+F6，见 `interaction-layers.md` 第 3 节）是 Windows 桌面
  应用的常见惯例，需要应用自行实现；WAI-ARIA 只在窗口分隔条（window splitter）模式中把 F6
  列为可选键，没有为地标定义 F6。
- 高对比度模式与读屏软件逐组件走查。
