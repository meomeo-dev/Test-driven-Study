# WebView 壳的原生化（Tauri 2）与去网页行为（WebView Shell）

执行到用 Tauri 2 做标题栏融合、原生菜单与右键菜单、托盘与全局快捷键、窗口材质与状态记忆，
或去掉 WebView 中残留的网页行为时加载。来源、核验日期与复核期登记在
`index/knowledge-index.yaml` 的条目 `webview-shell-tauri`；正文只写结论与可操作的事实。

配置项随版本变化，会漂移，以当次查询为准。核验时 `tauri` crate 为 2.12.6、`@tauri-apps/api`
为 2.12.5（2026-11-16 发布）。标「未核实」的条目没有在官方文档中找到原文；标「经验」的是
使用判断。

## 1. 窗口与原生集成

标题栏（`titleBarStyle`，取值 `Visible`、`Transparent`、`Overlay`，只在 macOS 生效）：

- `Overlay`：内容延伸到标题栏下方；标题栏高度随系统版本不同，必须自备拖动区域。
  `hiddenTitle: true` 隐藏窗口标题；`trafficLightPosition` 调整红绿灯位置，要求
  `titleBarStyle: Overlay` 且 `decorations: true`。
- `Transparent`：标题栏透明并显示窗口背景色；不在标题栏下放内容时用它，避开 `Overlay` 的限制。
- macOS 上点击未激活窗口时，第一次点击可能只激活窗口，需要点击穿透时设 `acceptFirstMouse`
  （未核实）。

Windows 与自绘标题栏：

- Windows 上保留系统标题栏（经验）。自绘标题栏用 `decorations: false` 加 HTML 属性
  `data-tauri-drag-region`，并在 capability 中授权 `core:window:allow-start-dragging`；自绘的
  窗口按钮另需 `core:window:allow-minimize`、`core:window:allow-toggle-maximize`、
  `core:window:allow-close`。
- 自绘后要自行还原贴靠布局悬停、双击最大化、右键系统菜单、失焦态与高对比度（经验）。
- 裸属性 `data-tauri-drag-region` 只作用于它所在的元素，子元素需各自标注；2.11.0 起
  `data-tauri-drag-region="deep"` 让不可点击的后代也能拖动窗口，`="false"` 退出拖动。
- `shadow` 默认 `true`。Windows 上无装饰窗口开阴影会出现 1 px 白边，Windows 11 上还带圆角；
  有装饰的窗口在 Windows 上始终有阴影，`shadow: false` 不生效。

菜单：

- JS 用 `Menu.new`、`Submenu.new`；Rust 用 `MenuBuilder`、`SubmenuBuilder`、`MenuItem`、
  `PredefinedMenuItem`。
- macOS 上菜单显示在屏幕顶部的应用菜单栏，顶层条目必须都是子菜单（Submenu）；Windows 与
  Linux 上菜单显示在窗口内。
- 加速键写作 `CmdOrCtrl+O`、`CmdOrCtrl+Shift+K`。
- 右键菜单：在 `contextmenu` 事件中 `preventDefault()` 阻止网页菜单，再用
  `menu.popup(at?, window?)` 弹出原生菜单；`at` 相对窗口左上角，省略时取当前鼠标位置。

官方插件与托盘：

- window-state：保存并恢复窗口位置与大小。窗口先隐藏，恢复后再显示，避免闪动（经验）。
- single-instance：必须第一个注册；回调默认不聚焦窗口，需在回调中自行调用 `set_focus()`。
- global-shortcut：权限默认被阻止，需逐项授权，如 `global-shortcut:allow-register`、
  `global-shortcut:allow-unregister`、`global-shortcut:allow-is-registered`。
- 系统托盘：启用 Cargo feature `tray-icon`；Rust 用 `TrayIconBuilder`，JS 用 `TrayIcon.new`。

窗口材质（`windowEffects`，要求窗口 `transparent: true`，Linux 不支持）：

- macOS 取值包括 `sidebar`、`hudWindow`、`underWindowBackground`、`titlebar`、`menu`、
  `popover`、`sheet` 等；macOS 26 起另有 Liquid Glass 的 regular 与 clear 两种。
- Windows 取值：`mica` 与 `tabbed` 只在 Windows 11（各有深浅变体）；`acrylic` 支持
  Windows 10 与 11；`blur` 支持 Windows 7、10 与 11 22H1。
- 性能：`acrylic` 在 Windows 10 v1903 及以上与 Windows 11 build 22000 上调整窗口大小或拖动时
  性能差；`blur` 在 Windows 11 build 22621 上有同类问题。
- 材质只用于导航栏与浮窗，不用于数据密集区（经验）。

主题、背景与 WebView 行为：

- `theme` 不设置时跟随系统，只在 Windows 与 macOS 10.14 及以上实现。
- `backgroundColor` 设置窗口与 WebView 的背景色；与界面底色一致可避免首帧白屏（经验）。
- `dragDropEnabled` 默认开启，接管拖放事件；Windows 上要在网页中使用 HTML5 拖放时必须关闭
  （对应 Rust `WebviewBuilder::disable_drag_drop_handler`）。
- `zoomHotkeysEnabled`（默认值未核实）：Windows 由 WebView2 的缩放控制处理；macOS 与 Linux
  为注入实现，Ctrl 或 ⌘ 加 `-`、`=`，每步 20%，范围 20%～1000%，另需
  `webview:allow-set-webview-zoom` 权限。
- 远程来源的页面调用 Tauri 接口，要在 capability 的 `remote.urls` 中显式允许。capability 按
  `windows` 或 `webviews` 标签授权，每个窗口都要列入（或用 `"*"`）；常驻小窗等新增窗口容易
  漏授（经验）。
- `tabbingIdentifier` 只在 macOS 生效，标识相同的窗口合并为页签；只在需要多个同类窗口合并
  时考虑。

## 2. 去网页行为

- `body` 设 `user-select: none`；输入框、原文类文本与表格单元格恢复 `user-select: text`。
- 按钮与列表行用 `cursor: default`，只有外部链接用手形。
- `html, body { overflow: hidden; overscroll-behavior: none }`，只让区域内滚动；版面铺满
  窗口，不用 `max-width` 居中与页面外边距。
- 细滚动条用 `scrollbar-width: thin` 或 `::-webkit-scrollbar`。
- `img, a { -webkit-user-drag: none }`。
- 拦截 F5 与 ⌘R 刷新；生产构建是否仍响应刷新需实测。
- 外部链接交给系统浏览器打开，窗口内只载入本应用页面。
- 监听窗口焦点，失焦时降低导航栏与工具栏对比度。
- 关键信息不用浏览器原生 `title` 属性的悬停提示承载。
- 去掉渐变背景与卡片阴影堆叠，用分隔线与背景层次划分区域。
