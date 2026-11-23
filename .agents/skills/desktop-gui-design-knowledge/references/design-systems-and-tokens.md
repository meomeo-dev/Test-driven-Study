# 企业设计体系的密度模式与设计令牌（Design Systems and Tokens）

执行到确定密度档位、表格行高、间距刻度、颜色命名，或设计令牌分层、深浅色与密度切换、令牌
交换格式时加载。来源、核验日期与复核期登记在 `index/knowledge-index.yaml` 的条目
`design-systems-and-tokens`；正文只写结论与可操作的事实。标「经验」的条目是多个体系的共同
做法归纳，没有单一出处。

## 1. 密度模式

公开体系的密度档位：

| 体系 | 档位 | 要点 |
| --- | --- | --- |
| IBM Carbon 数据表格 | xs 24、sm 32、md 40、lg 48（默认）、xl 64 px 行高 | xl 只用于单元格有两行内容 |
| SAP Fiori | Cozy（默认，触控区 2.75rem = 44 px）、Compact | 触屏设备用 Cozy，鼠标键盘用 Compact；整个应用统一，不混用 |
| Salesforce Lightning | Comfy（默认）、Compact，另有组织级 Cozy | Compact 的信息密度约比 Comfy 高 30% |
| Adobe Spectrum | scale：medium（桌面，默认）、large（触控）；density：compact、regular（默认）、spacious | scale 与 density 是两条独立的轴 |
| Ant Design | `defaultAlgorithm`、`darkAlgorithm`、`compactAlgorithm`，可组合 | 例：`[darkAlgorithm, compactAlgorithm]` |

共同做法：

- 密度分两到三档（紧凑 compact、标准、宽松 spacious）；专业桌面场景默认紧凑；整个应用只用
  一种密度，不混用。
- 紧凑模式缩小控件高度、内边距、行高与间距，字号不变（经验）。
- 表格行高的常见取值：紧凑 24～32 px、标准 40 px、宽松 48 px。
- 间距以 4 px 为基本单位，紧凑界面另用 2 px；常用档 2、4、8、12、16、24、32（经验）。
- 颜色按用途命名（主文字、次级文字、强调、成功、警告、危险、信息），不按色名命名。
- 深色是同一组语义令牌的另一组取值，不是另一套组件。
- 面向数据分析的体系默认偏紧凑；面向中后台的体系默认控件偏高，外观像网页后台（经验）。
- 专业界面需要的组件：数据表格（排序、冻结、虚拟滚动、批量操作）、树、页签、可拖动分栏、
  通知、快捷键管理、命令面板或全局搜索。命令面板在多数体系中没有现成组件，需要自建（经验）。

## 2. 令牌分层

- 三层：基础（primitive，如 `blue-600`、`space-100`）→ 语义（semantic，如
  `color-text-primary`）→ 组件（component，如 `table-cell-bg-selected`）。
- 叫法因体系而异，结构一致：Ant Design 为 Seed、Map、Alias（另有组件级令牌）；Fluent 2 为
  global 与 alias 两层，alias 指向 global。
- 业务组件只引用语义或组件令牌，不直接引用基础色板，不写色值。
- 命名用途优先于数值；尺寸用 xs～xl 档或与像素对应的数值。
- 字号层级、密度、叠放层级、平台差异都定义为令牌。

## 3. 运行时切换

- 令牌输出为 CSS 自定义属性；运行时切换主题与密度只改根节点属性。
- 深浅色：语义令牌在 `[data-theme="dark"]` 下重新赋值，不另写一套组件。
- 密度：控件高度、内边距、行高在 `[data-density="compact"]` 下重新赋值，字号不变。

## 4. 交换格式

- Design Tokens Community Group 的 Format Module 2025.10（2025-10-28 发布）是 W3C 社区组的
  最终报告（Final Community Group Report），不是 W3C 标准，不在标准轨道上。
- 每个令牌必须有 `$value`；`$type` 可选，缺省时继承别名目标或最近的父级组，工具不得从值推断
  类型。别名写作 `{group.token}`。`dimension` 类型的值是带 `value` 与 `unit`（`px` 或 `rem`）
  的对象，不是字符串。
- 只在需要与设计工具同步令牌时采用该格式；否则直接维护 CSS 变量。
