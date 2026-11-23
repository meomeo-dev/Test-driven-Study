---
name: desktop-gui-design-knowledge
description: >-
  设计或评审专业桌面客户端与高密度工作台界面时查阅的知识库（只提供知识，不规定流程）：
  macOS 与 Windows 平台规范的字号、间距、控件、标题栏、菜单与快捷键，WCAG 2.2 对比度与
  目标尺寸，企业设计体系的密度模式与表格行高，设计令牌分层与深浅色、密度切换，React 无样式
  原语与组件库的版本、许可证与取舍，功能分区与布局保存，视觉与文字层级、信息披露、反馈、
  键盘、结构与叠放层级（z-index），集成开发环境、设计工具、影音后期、金融终端等专业软件的
  界面惯例与改版方向，Tauri 2 WebView 壳的原生化做法与反模式。用户说「像网页套壳」「不像
  客户端」「专业 GUI 怎么设计」「功能区怎么划」「检查器、状态栏、底部面板放什么」「信息
  层级」「快捷键体系」「z-index 怎么定」「紧凑密度」「表格行高」「深色主题令牌」「用哪个
  组件库」「headless 组件」时都先读，即使没提 GUI。不负责出设计稿、写实现代码或发布前审计。
---

# 桌面专业 GUI 设计知识（Desktop GUI Design Knowledge）

本技能是随包发布的知识库：专业桌面 GUI 的平台规范、设计体系、组件库与界面惯例。它只提供
知识，不规定设计流程；回答问题或给出设计依据时，按主题打开对应的 reference。

## 触发与形态

- 触发：设计、评审或重构桌面客户端与高密度工作台界面之前需要依据；用户问字号、间距、行高、
  密度、令牌、组件库、功能分区，或披露、反馈、键盘、叠放层级，或抱怨界面像网页。
- 形态：只读知识，没有脚本与流程。
- 不触发：移动端界面、营销类网页、出设计稿或效果图、写实现代码、发布前的签名与审核检查。

## 用法

1. 先读 `index/knowledge-index.yaml` 中各条目的 `summary`，按「指针」表选文件，只打开需要的
   那一篇。
2. 回答涉及版本、许可证、平台数值或配置项时，同时给出该条目的 `verified_at`；距今超过
   `review_after_days` 时说明需要复核。
3. 标「未核实」的内容没有找到一手出处，采用前查原文或在目标平台实测；标「经验」的是多个
   产品的共同做法归纳，不是规范。
4. 组件库的版本与许可证是快照，采用前运行 `npm view <包> version license time --json` 复核。

## 总则

- 专业感来自固定骨架、键盘体系、可调布局与高密度，不来自配色。
- 设计标准由三部分组成：平台规范（字体、字号层级、间距网格、控件尺寸、深浅色）、设计令牌、
  组件的交互与可访问性规范。

## 失败与纠正反馈

条目与当前官方资料不符时，按官方资料回答，并告诉用户该条目的 id 需要复核；用户纠正某条知识
时同样处理。不要修改本技能的安装目录：它是发布副本，改动不会回到维护者手里。

## 指针

`index/knowledge-index.yaml` —— 十个条目的摘要、来源、核验日期与复核期；先读它。

| 问题 | 文件 |
| --- | --- |
| 平台字号、间距、控件、标题栏、菜单、快捷键、材质，一套界面适配两个平台 | `references/platform-conventions.md` |
| 对比度、目标尺寸、焦点可见与焦点顺序、地标 | `references/accessibility-baseline.md` |
| 密度档位、表格行高、间距刻度、令牌分层、主题与密度切换、令牌交换格式 | `references/design-systems-and-tokens.md` |
| 无样式原语、完整组件库、分栏与停靠、命令面板、表格逻辑、WebView 的 CSS 差异 | `references/react-component-libraries.md` |
| 窗口功能区、检查器与底部面板与状态栏、布局保存、常驻小窗 | `references/layout-and-regions.md` |
| 文字层级与明度、高密度表格的对齐、行高、空态与加载态 | `references/visual-hierarchy-and-dense-tables.md` |
| 信息披露、反馈、键盘、结构与叠放层级 | `references/interaction-layers.md` |
| 按软件类别的布局变体、金融终端与行情监控、改版方向 | `references/professional-software-conventions.md` |
| Tauri 2 标题栏、菜单、托盘、窗口材质，去网页行为 | `references/webview-shell-tauri.md` |
| 评审「为什么像网页」、反模式清单 | `references/anti-patterns.md` |

常见的多文件问题：定表格行高与字号，依次读 `references/design-systems-and-tokens.md`、
`references/visual-hierarchy-and-dense-tables.md` 与 `references/platform-conventions.md`；
评审「像网页」，先读 `references/anti-patterns.md`，再按其中每条指向的文件展开。

按问题打开对应 reference，不要一次全读。
