# 数据汇总与统计

本单元围绕桌面质检分拣站的检测数据，学习使用字典与计数器分类统计、
运用数学与统计模块计算指标、按指定字段排序输出报表，以及解析与筛选检测时间戳。

## 本单元知识点
- 计数与分组汇总：掌握计数字典、get 方法、按批次分组累加与 Counter 频数统计。
- 均值、最值与比例：掌握内置统计计算、statistics 模块、合格率计算及防除零处理。
- 排序与报告输出：掌握 sorted 与 lambda 键函数排序、格式化对齐打印与写入报表。
- 时间戳与日期：掌握 datetime 解析时间字符串、timedelta 计算耗时与日期筛选。

## 计数与分组汇总

在分拣工作站中，传感器与工控机会持续产生成批的检测记录。面对大批量的
检测数据，首要任务是统计不同判定结果（如合格、超差、划痕）的频次，或
按批次号将产量与尺寸偏差累加。

实现计数的基础方式是维护一个计数字典。遍历记录时，利用字典的 get 方法
设置默认值 0，即可安全地累加频次：counts[key] = counts.get(key, 0) + 1。
若需按批次汇总检测耗时或缺陷数，同样可以先判断批次键是否存在，再将数值
累加到对应的分组列表中或直接累加总和。

Python 标准库 collections 模块提供了 Counter 类，它是专门用于计数的
字典子类。直接向 Counter 传入可迭代对象（如所有工件的状态列表），即可
自动完成频次汇总，并能通过 most_common(n) 快速获取频次最高的前 n 项。

### 例题
统计分拣站当前批次工件的检测状态分布，并找出出现最多的前两种状态：

```python
from collections import Counter

records = [
    {"id": "A01", "status": "pass"},
    {"id": "A02", "status": "defect_size"},
    {"id": "A03", "status": "pass"},
    {"id": "A04", "status": "pass"},
    {"id": "A05", "status": "defect_scratch"},
    {"id": "A06", "status": "defect_size"},
]

# 提取所有状态并用 Counter 计数
statuses = [r["status"] for r in records]
counter = Counter(statuses)

print("全部状态统计:", dict(counter))
print("最常见状态:", counter.most_common(2))
```

运行结果：
```text
全部状态统计: {'pass': 3, 'defect_size': 2, 'defect_scratch': 1}
最常见状态: [('pass', 3), ('defect_size', 2)]
```

### 常见错误
- 直接使用 counts[key] += 1 而未赋初值或未使用 get，导致触发 KeyError。
- 误将 most_common() 当作字典使用，忘记其返回值是元素为 (键, 频数) 的列表。
- 分组求和时误修改了全局累加变量，导致不同批次的数据相互污染。

## 均值、最值与比例

质检分拣站判定工件时，关键依据是工件的物理尺寸测量值（如外径、厚度）
以及工位合格率指标。这就需要用到基本的数值统计计算。

求取测量数值列表的平均值，最直接的方式是使用内置函数 sum(data) / len(data)。
最大值与最小值可以直接调用 max(data) 和 min(data)。若需要计算中位数或
更精确的标准统计量，应使用 Python 标准库 statistics 模块中的 mean() 与
median() 函数。

计算合格率比例时，合格率公式为：合格数 / 总件数 × 100%。在工控系统启动
初期或筛选特定缺陷类型后，待测数据列表可能为空。若直接计算 len(data) 作为
除数，程序会抛出 ZeroDivisionError 异常导致分拣脚本崩溃。因此，在任何
除法与求均值计算前，必须先使用 if not data 检查列表是否为空，并设定默认值。

### 例题
计算一批工件外径测量值的最大值、最小值、均值与合格率：

```python
import statistics

# 设定标准外径为 20.0 mm，公差 ±0.2 mm 即 [19.8, 20.2] 为合格
diameters = [20.02, 19.85, 20.15, 19.78, 20.08, 20.11]

if not diameters:
    print("无有效测量数据")
else:
    d_max = max(diameters)
    d_min = min(diameters)
    d_mean = statistics.mean(diameters)
    pass_count = sum(1 for d in diameters if 19.8 <= d <= 20.2)
    pass_rate = (pass_count / len(diameters)) * 100
    print(f"最大值: {d_max:.2f} mm")
    print(f"最小值: {d_min:.2f} mm")
    print(f"平均值: {d_mean:.2f} mm")
    print(f"合格率: {pass_rate:.1f}%")
```

运行结果：
```text
最大值: 20.15 mm
最小值: 19.78 mm
平均值: 20.00 mm
合格率: 83.3%
```

### 常见错误
- 未对空列表进行前置检查，当传入空记录时直接调用 sum/len 触发 ZeroDivisionError。
- 忘记 statistics.mean 传入空列表会抛出 StatisticsError 异常。
- 比例计算时漏乘 100 导致百分比数值错误，或整数除法未保留合适的小数位数。

## 排序与报告输出

为了让质检工程师清晰掌握分拣站运行状况，需将混乱的工件记录按照工件编号、
测量偏差或检测时间排序，并在终端或文本文件中输出格式整齐的报表。

Python 内置的 sorted() 函数可以接收任何可迭代对象，并返回排序后的新列表。
对字典记录列表排序时，通过 key 参数指定单行匿名函数（lambda 表达式）提取
排序字段，例如 key=lambda r: r["deviation"]。若需要从大到小降序排列，
只需添加参数 reverse=True。

在格式化输出方面，利用 f-string 的对齐与宽度指示符能够生成整齐的报表列。
例如 {var:<10} 表示左对齐且占 10 个字符宽度，{var:>8.2f} 表示右对齐、占 8 字符
且保留两位小数。使用 with open(filename, "w", encoding="utf-8") as f 结构
可以将终端打印的格式化字符串逐行写入文件，生成持久化报告。

### 例题
将检测记录按尺寸偏差从大到小排序，格式化打印表格并写入文本报告：

```python
records = [
    {"id": "P001", "diameter": 20.05, "diff": 0.05},
    {"id": "P002", "diameter": 19.75, "diff": -0.25},
    {"id": "P003", "diameter": 20.18, "diff": 0.18},
]

# 按偏差绝对值从大到小排序
sorted_records = sorted(records, key=lambda r: abs(r["diff"]), reverse=True)

header = f"{'工件编号':<8}{'测量外径(mm)':>14}{'偏差(mm)':>12}"
print(header)
print("-" * 34)
for r in sorted_records:
    line = f"{r['id']:<8}{r['diameter']:>14.2f}{r['diff']:>12.2f}"
    print(line)

with open("report.txt", "w", encoding="utf-8") as f:
    f.write(header + "\n")
    f.write("-" * 34 + "\n")
    for r in sorted_records:
        f.write(f"{r['id']:<8}{r['diameter']:>14.2f}{r['diff']:>12.2f}\n")
```

运行结果：
```text
工件编号          测量外径(mm)      偏差(mm)
----------------------------------
P002             19.75       -0.25
P003             20.18        0.18
P001             20.05        0.05
```

### 常见错误
- 误用 list.sort() 并期待其返回新列表，忽视了 sort() 原地修改返回 None 的特性。
- 排序字符串格式的数字字段（如 "2" 和 "10"）时未先转换为 float/int，造成字典序错误。
- 文本对齐时未考虑中文字符与英文字符显示宽度差异，导致在部分控制台显示轻微不对齐。

## 时间戳与日期

质检分拣站每次到位传感器触发并完成拍照判级后，都会在 CSV 文件中写入
当前时间的文本时间戳（如 "2026-03-15 08:30:12"）。为了统计节拍周期与
按班次筛选，必须学会处理日期和时间。

Python 的 datetime 模块中，datetime 类用于表示日期与时间。使用
datetime.strptime(date_string, format) 可以将固定格式的时间字符串解析为
datetime 对象。常用格式化占位符包括：%Y（四位年份）、%m（两位月份）、
%d（两位日期）、%H（24小时制小时）、%M（分钟）、%S（秒）。

两个 datetime 对象相减会产生一个 timedelta 对象，代表时间间隔。通过调用
timedelta.total_seconds() 方法，可以得到两个时间点相差的浮点秒数，便于
计算单件分拣耗时与工位节拍。此外，datetime 对象之间支持直接比较大小，
这使得按日期区间（如筛选某天早班 08:00 至 16:00 之间的记录）变得非常直观。

### 例题
解析分拣站的进料与出料时间戳，计算工件在夹具上的驻留秒数并筛选超时件：

```python
from datetime import datetime

records = [
    {"id": "W1", "t_in": "2026-03-15 09:00:00", "t_out": "2026-03-15 09:00:03"},
    {"id": "W2", "t_in": "2026-03-15 09:00:10", "t_out": "2026-03-15 09:00:17"},
    {"id": "W3", "t_in": "2026-03-15 09:00:25", "t_out": "2026-03-15 09:00:29"},
]

fmt = "%Y-%m-%d %H:%M:%S"
for r in records:
    dt_in = datetime.strptime(r["t_in"], fmt)
    dt_out = datetime.strptime(r["t_out"], fmt)
    duration = (dt_out - dt_in).total_seconds()
    is_overtime = duration > 5.0
    status = "超时" if is_overtime else "正常"
    print(f"工件 {r['id']} 耗时: {duration:.1f} 秒 [{status}]")
```

运行结果：
```text
工件 W1 耗时: 3.0 秒 [正常]
工件 W2 耗时: 7.0 秒 [超时]
工件 W3 耗时: 4.0 秒 [正常]
```

### 常见错误
- 混淆格式化代码的大小写，例如将月份 %m 误写为分钟 %M，或将 24 小时制 %H 误写为 %h。
- 误用 strptime 与 strftime：strptime 是解析字符串为时间对象，strftime 是格式化为字符串。
- 直接使用不同格式的字符串比较大小，导致跨日期或不同时间长度时比较逻辑失效。

## 单元小结
- 掌握使用字典 get 方法与 Counter 类对质检记录的工件状态与缺陷分类进行高效计数。
- 学会结合 sum、len、max、min 与 statistics 模块计算测量指标，并严格做好空列表防除零保护。
- 熟练运用 sorted 配合 lambda 按指定测量字段排序，并使用格式化字符串输出清晰对齐的报告文件。
- 掌握 datetime.strptime 解析 CSV 时间戳，利用 timedelta.total_seconds 计算节拍耗时与执行筛选。
