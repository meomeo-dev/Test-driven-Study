# React 组件库与无样式原语（React Component Libraries）

执行到为桌面界面选择组件库、无样式原语、分栏或停靠布局、命令面板与表格逻辑库时加载。来源、
核验日期与复核期登记在 `index/knowledge-index.yaml` 的条目 `react-component-libraries`；
正文只写结论与可操作的事实。

版本、许可证与发布日期是快照，会漂移，以当次查询为准。表中数据取自 npm 注册表（最新版本与
该版本的发布日期）；采用前用 `npm view <包> version license time --json` 复核。标「经验」的
是使用判断，没有单一出处。

## 1. 默认方案

- 自有设计令牌 + 一套无样式原语（headless primitives）。原语封装在自有 UI 包内，业务代码只
  依赖该包；换库只改这一层。
- 同一类控件只选一个原语库，不混用。
- 必须采用完整组件库时，也用适配层隔离其主题与接口，避免被绑定。

## 2. 无样式原语

| 包 | 许可证 | 版本 | 发布日 | 覆盖与要点 |
| --- | --- | --- | --- | --- |
| `react-aria-components` | Apache-2.0 | 1.22.1 | 2026-10-09 | Table、Tree、GridList、Menu、ComboBox、Tabs、Toolbar、Autocomplete；键盘、焦点与跨平台交互处理细致（经验）；样式全部自写，接口较多 |
| `radix-ui` | MIT | 1.8.1 | 2026-10-12 | Dialog、Popover、DropdownMenu、Tabs、ScrollArea；组件清单中没有 Table 与 Tree；可装统一包或按需装单个 `@radix-ui/react-*` 子包 |
| `@base-ui/react` | MIT | 1.9.0 | 2026-10-09 | 1.0.0 于 2025-12-11 发布；覆盖少于 `react-aria-components`（经验）；旧包名 `@base-ui-components/react` 已弃用，停在 1.0.0-rc.0 |
| `@ariakit/react` | MIT | 0.4.43 | 2026-11-08 | 轻量；组合框与复合控件适合做命令面板；仍为 0.x，破坏性变更放在 minor 版本 |

- `react-aria-components` 的 Autocomplete 底层包在核验时仍为预发布（RC）版本。

## 3. 完整组件库

| 包 | 许可证 | 版本 | 发布日 | 适用与代价 |
| --- | --- | --- | --- | --- |
| `@fluentui/react-components` | MIT | 9.75.2 | 2026-11-10 | 令牌分 global 与 alias 两层；控件有 small、medium、large 尺寸（未核实全部控件）；深浅色完整，接近 Windows 11 视觉。代价：在 macOS 上像 Windows 应用，绑定其样式引擎 |
| `@blueprintjs/core` | Apache-2.0 | 6.23.0 | 2026-11-13 | 面向数据密集的桌面类应用，外观偏紧凑（经验）；表格在 `@blueprintjs/table`（6.3.2），全局搜索 Omnibar 在 `@blueprintjs/select`，自带 HotkeysProvider 与深色主题。代价：外观风格固定 |
| `@carbon/react` | Apache-2.0 | 1.120.0 | 2026-11-04 | 企业数据产品；数据表格行高五档；外观风格固定 |
| `@mantine/core` | MIT | 9.8.1 | 2026-11-15 | 面向通用网页产品；排序、虚拟滚动等数据表格能力需另装（未核实） |
| `antd` | MIT | 6.7.1 | 2026-11-16 | 中后台；有紧凑与深色算法 |
| `@arco-design/web-react` | MIT | 2.66.18 | 2026-10-12 | 中后台 |
| `tdesign-react` | MIT | 1.18.6 | 2026-10-30 | 中后台 |
| `@douyinfe/semi-ui` | MIT | 2.105.0 | 2026-11-12 | 中后台 |

- Blueprint 与 React 19：`@blueprintjs/core` 6.16.0 起 peer 依赖才包含 React 19；旧的 Popover
  与 Overlay 在 React 19 下不可用，换用 PopoverNext 与 Overlay2；Popover2 包在 6.0 已移除；
  Table 需要外层的 HotkeysProvider。
- 中后台组件库默认是网页后台外观，与「不像网页套壳」的目标相反，不用于桌面客户端主界面
  （经验）。

## 4. 分栏与停靠布局

| 包 | 许可证 | 版本 | 发布日 | 要点 |
| --- | --- | --- | --- | --- |
| `react-resizable-panels` | MIT | 4.24.0 | 2026-11-15 | 只做可调整分栏与尺寸保存；v4 去掉 `autoSaveId`，改用 `useDefaultLayout` 钩子配合 `defaultLayout` 与 `onLayoutChanged`，组件改名为 Group、Separator |
| `allotment` | MIT | 1.20.6 | 2026-10-12 | 分栏 |
| `dockview` | MIT | 8.9.0 | 2026-11-08 | 停靠、拆分、页签、浮动组、弹出为独立窗口（popout）、`toJSON` 与 `fromJSON` 布局序列化；popout 的恢复是异步的 |
| `flexlayout-react` | MIT | 0.11.2 | 2026-11-16 | 停靠布局；0.x |
| `golden-layout` | MIT | 2.6.0 | 2022-09-26 | 此后没有新发布，不用 |

- 需求小时用 CSS Grid 加一个拖动手柄自研。

## 5. 命令面板、表格逻辑与虚拟滚动

| 包 | 许可证 | 版本 | 发布日 | 要点 |
| --- | --- | --- | --- | --- |
| `cmdk` | MIT | 1.1.1 | 2025-03-14 | 命令菜单；一年以上没有新发布。备选：自研带模糊匹配的弹出列表 |
| `@tanstack/react-table` | MIT | 9.3.1 | 2026-10-12 | 当前主版本 v9；无界面（headless），样式与键盘导航自建 |
| `@tanstack/react-virtual` | MIT | 3.14.26 | 2026-11-03 | 虚拟滚动 |

- 数字列的处理见 `visual-hierarchy-and-dense-tables.md` 第 3 节。

## 6. 选型与 WebView 差异

- 引入前比较打包体积（用构建产物实测）、维护状态、许可证与退出路径。包管理器配置了最短发布
  时长（release cooldown）时，选用已过冷却期的版本。
- macOS 的 WKWebView 跟随系统的 WebKit 版本，Windows 的 WebView2 跟随 Chromium；两者对新
  CSS 特性的支持不同，字体渲染粗细也不同，令牌取值在两个平台实测。
- `backdrop-filter`：Chromium 76 起支持无前缀写法；Safari 9 起只支持 `-webkit-` 前缀，18.0 起
  支持无前缀，较早的系统仍需前缀。两种写法同时写。
- `color-mix()`：Safari 16.2、Chromium 111 起支持。
