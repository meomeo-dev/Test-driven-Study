# 桌面专业 GUI 反模式（Anti-patterns）

执行到评审一个桌面客户端或高密度工作台界面、回答「为什么像网页套壳」时加载。来源、核验
日期与复核期登记在 `index/knowledge-index.yaml` 的条目 `anti-patterns`；正文只写结论与可
操作的事实。每条后括号内是对应的正面做法所在文件。

## 网页感

网页感的五个来源：浏览器式留白与卡片堆叠；保留的网页行为（文字可选中、网页右键菜单、回弹
滚动）；缺少原生菜单栏；标题栏与内容割裂；信息密度偏低（控件偏大、字号 15 px 以上）。

## 反模式清单

| 反模式 | 正面做法所在 |
| --- | --- |
| 窗口内堆叠卡片与阴影、渐变背景、内容最大宽度居中，像网页后台 | `webview-shell-tauri.md` 第 2 节 |
| 系统标题栏下再放一条带产品名的网页顶栏，形成两层标题 | `platform-conventions.md` |
| 顶栏大字号、下划线页签作为主导航 | `visual-hierarchy-and-dense-tables.md`、`layout-and-regions.md` |
| 整页滚动，用 `position: sticky` 模拟固定区域 | `layout-and-regions.md`、`webview-shell-tauri.md` |
| 状态挤在顶栏胶囊里，没有状态栏 | `layout-and-regions.md` |
| 所有功能同时摆出、不分层披露；同一功能出现在多个导航入口 | `interaction-layers.md`、`layout-and-regions.md` |
| 浮动面板作为默认布局；默认打开的面板过多 | `layout-and-regions.md` |
| 悬停提示承载关键信息；模态用于普通通知或常规表单 | `interaction-layers.md` |
| 只靠颜色表达状态；新鲜度只显示时间、不标过期 | `accessibility-baseline.md`、`professional-software-conventions.md` |
| 组件内写死 z-index 数值与色值 | `interaction-layers.md`、`design-systems-and-tokens.md` |
| 一次大面积重做用户已经熟悉的操作 | `professional-software-conventions.md` |
| 常驻小窗承担过多操作，与主窗口职责重叠 | `layout-and-regions.md` |
| 引入重型表格或停靠组件后被其主题与接口绑定，没有适配层隔离 | `react-component-libraries.md` |
