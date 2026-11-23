# macOS 与 Windows 平台规范（Platform Conventions）

执行到确定系统字体、字号层级、间距、控件尺寸、标题栏、菜单、快捷键与材质，或让一套界面
同时适配 macOS 与 Windows 时加载。来源、核验日期与复核期登记在
`index/knowledge-index.yaml` 的条目 `platform-conventions`；正文只写结论与可操作的事实。
平台规范会随系统版本修订，标「未核实」的条目没有找到一手出处，采用前查原文或在目标平台
实测。

目录：1. macOS；2. Windows；3. 跨平台。

## 1. macOS

字体与字号：

- 系统字体是 SF Pro；网页中用 CSS 通用字体族 `system-ui` 取系统界面字体。中文回退苹方
  PingFang SC（未在平台设计规范中核实）。
- macOS 不支持 Dynamic Type。默认字号 13 pt，最小 10 pt。
- 内置文字样式（字号/行高 pt，常规字重，强调字重）：

| 样式 | 字号/行高 | 常规 | 强调 |
| --- | --- | --- | --- |
| Large Title | 26/32 | Regular | Bold |
| Title 1 | 22/26 | Regular | Bold |
| Title 2 | 17/22 | Regular | Bold |
| Title 3 | 15/20 | Regular | Semibold |
| Headline | 13/16 | Bold | Heavy |
| Body | 13/16 | Regular | Semibold |
| Callout | 12/15 | Regular | Semibold |
| Subheadline | 11/14 | Regular | Semibold |
| Footnote | 10/13 | Regular | Semibold |
| Caption 1 | 10/13 | Regular | Medium |
| Caption 2 | 10/13 | Medium | Semibold |

- 正文与标题同为 13 pt，层级主要靠字重区分。

布局与控件：

- 窗口内容边距约 20 pt（未核实，平台规范的布局页没有给出数值）。
- 控件有 mini、small、regular 等尺寸档（未核实当前档数，以 AppKit 或 SwiftUI 的
  ControlSize 为准）。

窗口与菜单：

- 标题栏与工具栏融合为一条，红绿灯按钮在左上，整条可拖动；工具栏放与当前内容相关的操作与
  搜索，侧边栏开关在最左。
- 屏幕顶部的全局菜单栏依次为：应用菜单、文件、编辑、格式、显示、应用自有菜单、窗口、帮助。
  「设置…」在应用菜单中，只放应用级设置；文档级设置放在文件菜单。设置惯例为独立窗口，不是
  主窗口中的一页。
- 编辑菜单承载剪贴板命令。WebView 类应用缺少编辑菜单时，输入框中的 ⌘C、⌘V 往往失效
  （实测经验，未在平台规范中核实）。缺少菜单栏也是界面显得不像原生的主要原因之一。
- 标准快捷键：⌘, 打开设置窗口，⌘W 关闭当前窗口，⌘Q 退出，⌘F 查找，⌘Z 撤销。
- 侧边栏（sidebar，source list）列出应用的顶层区域，选中项在相邻窗格展示；层级不超过两级，
  更深的层级改用带内容列表的分栏视图。分栏用可拖动分隔条，并为每个窗格设最小宽度。

外观与上架：

- 深浅色跟随系统，使用系统强调色；侧边栏可用半透明材质。状态栏少见，状态放在窗口底部细条
  或工具栏。
- App Store 审核指南 2.5.1：应用只能使用公开 API（适用于所有平台）；Mac App Store 的额外
  要求（沙盒、更新只能经 Mac App Store 等）见 2.4.5。依赖私有接口的窗口效果不能上架。

## 2. Windows

字体与字号：

- 系统字体 Segoe UI Variable；简体中文界面字体 Microsoft YaHei UI。
- 文字层级（epx，字号/行高）：

| 样式 | 字号/行高 | 字重 |
| --- | --- | --- |
| Caption | 12/16 | Regular |
| Body | 14/20 | Regular |
| Body Strong | 14/20 | Semibold |
| Body Large | 18/24 | Regular |
| Body Large Strong | 18/24 | Semibold |
| Subtitle | 20/28 | Semibold |
| Title | 28/36 | Semibold |
| Title Large | 40/52 | Semibold |
| Display | 68/92 | Semibold |

- 最小字号 12 px Regular 或 14 px Semibold；层级只用 Regular 与 Semibold，Bold 与 Italic
  不属于层级。

间距、控件与几何：

- 4 epx 网格。8 epx：按钮之间、按钮与浮层之间、控件与其标题（header）之间；12 epx：控件与
  标签（label）之间、内容区之间；16 epx：容器表面边缘到文字。
- 触控目标推荐约 40×40 epx（7.5 mm 见方），是推荐值不是硬性下限。
- 圆角：按钮等页内控件 4 px；窗口、浮层（flyout）、对话框 8 px；工具提示 4 px。
- 标准控件高度 32 epx（未核实，以 WinUI 控件默认样式为准）。

窗口与命令：

- 标题栏标准高 32 px，含搜索框或头像等交互内容时 48 px。最小化、最大化、关闭在右上；悬停
  最大化按钮出现贴靠布局（Snap Layouts）；双击标题栏最大化，右键出系统菜单。窗口失焦时
  标题栏元素变为半透明。
- 没有全局菜单栏：用窗口内菜单栏或不设菜单栏；命令放在内容区顶部的命令栏（command bar），
  次要命令收进「…」。
- 导航窗格（navigation pane）在左侧，可折叠为图标条；传统桌面应用常见底部状态栏。
- 快捷键以 Ctrl 为主：Ctrl+F 查找，Ctrl+W 或 Alt+F4 关闭；设置没有统一快捷键。

外观与材质：

- 支持浅色、深色与高对比度（对比度主题）。
- Mica 作长期存在窗口的底层背景，系统版本低于 Windows 11（build 22000）时回退为纯色。
- Acrylic 用于瞬态界面（右键菜单、浮层、非模态弹窗），不限 Windows 11；窗口失活、关闭透明
  效果或省电模式时降级为纯色。

## 3. 跨平台

- macOS 与 Windows 共用一套界面；平台差异（系统字体、正文字号、圆角、快捷键符号）由设计
  令牌按平台取值承载，不为两个平台各写一套组件。
- 快捷键定义统一写 `CmdOrCtrl+…`，界面按平台显示 ⌘ 或 Ctrl，不把 ⌘ 写死在界面文字里。
- 字体栈：`system-ui, "Segoe UI Variable", "PingFang SC", "Microsoft YaHei UI", sans-serif`。
- 两平台正文字号不同（13 pt 与 14 epx）：按平台取正文令牌，或统一取 13 px 并在 Windows 上
  实测可读性。
- WebView 渲染差异见 `react-component-libraries.md` 第 6 节。
