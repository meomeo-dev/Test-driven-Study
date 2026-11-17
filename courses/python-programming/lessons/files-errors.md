# 文件与异常
本单元围绕桌面质检分拣站的数据落地需求，学习文本文件读写、异常处理、csv 模块应用以及工件记录的数据校验，为后续统计工件良率与清洗坏记录奠定基础。

## 本单元知识点
- 读写文本文件：掌握 open 函数、with 上下文管理、常见读写模式与 UTF-8 编码。
- 异常处理：理解 try-except 结构、常见异常类型与主动抛出异常的防御性编程。
- 用 csv 模块读写表格：使用 reader 与 DictReader 读取字段，用 writer 规范输出表格。
- 检查记录：空值与格式：定位并记录缺失、无效或类型错误的劣质工件数据，隔离异常行。

## 读写文本文件
在桌面质检分拣站中，相机与传感器采集的工件尺寸、判定结果等信息需要长期保存在
本地磁盘中。Python 内置的 open() 函数用于打开指定路径的文件并返回文件对象。
open 函数最常用的三个模式是只读 'r'、覆盖写入 'w' 和末尾追加 'a'。若未显式
传入模式参数，Python 默认采用只读模式。若以 'r' 模式打开一个不存在的文件，
程序会引发异常；而以 'w' 或 'a' 模式打开时，若文件不存在则会自动创建新文件。

跨设备或跨操作系统传输文本时，不同系统的默认字符编码可能不同。为避免中文或
特殊符号出现乱码，打开文件时应始终显式传入 encoding='utf-8' 参数。同时，
操作系统对同时打开的文件句柄数量有限制，文件读写完毕后必须及时关闭。推荐使用
with open(...) as f 语句进行上下文管理。with 语句块会在缩进代码执行完毕后
自动关闭文件，即便中途发生错误也不会发生文件泄漏。

对于大型工件检测日志，一次性使用 read() 读取整个文件可能会耗尽内存。最推荐
的做法是使用 for line in f 语句逐行迭代读取。需要注意的是，读取出的每一行
文本末尾默认都会包含换行符 '\n'，在处理字段前通常先调用 line.strip() 清除
字符串首尾的换行符与多余空白。

### 例题
分拣站运行产生了一份原始检测日志 logs.txt，每行记录一个工件的编号与测量尺寸。
编写代码读取该文件，过滤掉首尾空白，将尺寸大于 50.0 毫米的合格记录写入新文件
filtered.txt，并统计写入的记录条数。logs.txt 的内容如下：

```text
P01,50.5
P02,49.8

P03,51.2
```

```python
count = 0
with open("logs.txt", "r", encoding="utf-8") as f_in:
    with open("filtered.txt", "w", encoding="utf-8") as f_out:
        for line in f_in:
            text = line.strip()
            if text:
                part_id, size_str = text.split(",")
                if float(size_str) > 50.0:
                    f_out.write(f"{part_id},{size_str}\n")
                    count += 1

print(f"共筛选并写入 {count} 条合格记录")
# 运行结果：
# 共筛选并写入 2 条合格记录
```

### 常见错误
1. 本意是向已有检测日志末尾追加数据，却误用了 'w' 模式打开文件，导致原有记录被直接清空。
2. 逐行读取文本后未调用 strip()，字符串末尾保留的换行符在再次拼接输出时造成非预期的多余空行。
3. 在中文 Windows 系统下打开包含中文字符的文本时省略了 encoding='utf-8'，导致程序抛出解码错误。

## 异常处理
质检流水线连续运转时，可能会遇到不可避免的外部意外，例如工件记录文件被操作工
误删除、传感器偶尔输出非数字乱码、或者因除以零导致计算失败。如果不对这些错误
进行处理，Python 解释器会立即中断并崩溃，导致整个分拣系统停摆。

Python 使用 try-except-else-finally 结构来捕获并优雅处理运行时异常。可能引发
错误的代码段放在 try 块中；except 块指定捕获的具体异常类型并执行容错补救逻辑；
仅在 try 块无任何异常发生时，才会执行可选的 else 块；而 finally 块无论是否发生
异常都必定会执行，非常适合放置释放硬件端口或复位分拣挡板的清理代码。

本单元需重点掌握四种基础异常类型：
- FileNotFoundError：试图打开不存在的文件路径；
- ValueError：函数接收到类型正确但内容非法的参数，如 float("abc")；
- KeyError：在字典中访问了不存在的键名；
- ZeroDivisionError：除法或求模运算中除数为零。
此外，当检测到违反业务逻辑的严重情形（如尺寸为负数）时，可使用 raise 语句主动抛出异常。

### 例题
分拣站相机返回了工件像素宽度字符串，需将其转换为浮点数并计算缩放比率（标称尺寸除以像素值）。
编写函数 parse_scale，安全处理数据转换失败和除以零的情形，成功返回比率，失败返回 None。

```python
def parse_scale(nominal, pixel_str):
    try:
        val = float(pixel_str)
        scale = nominal / val
    except ValueError:
        print("错误：像素值包含非数字字符")
        return None
    except ZeroDivisionError:
        print("错误：像素值不能为零")
        return None
    else:
        return round(scale, 2)
    finally:
        print("完成一次比例解析尝试")

res = parse_scale(10.0, "0")
print("解析结果:", res)
# 运行结果：
# 错误：像素值不能为零
# 完成一次比例解析尝试
# 解析结果: None
```

### 常见错误
1. 使用不带具体异常类型的裸 except: 语句，导致键盘中断（KeyboardInterrupt）或变量拼写错误也被隐蔽吞掉。
2. 将整个复杂业务流程全部塞进一个庞大的 try 块中，掩盖了真正引发异常的具体代码行。
3. 误认为 finally 块仅在发生异常时才触发，实际上没有异常时 finally 块依然会无条件执行。

## 用 csv 模块读写表格
CSV（逗号分隔值）是桌面质检分拣站保存检测批次的最常用表格格式。每一行对应
一个工件的检测数据，字段之间用逗号分隔。虽然可以使用字符串的 split(',') 手动
分割，但当字段内部本身包含逗号、双引号或换行符时，手动分割极易出错。Python
标准库内置的 csv 模块能自动处理这些转义细节。

csv 模块提供了两种主流读取方式：
- csv.reader(f)：将每行解析为纯字符串列表，第一行通常作为表头列表；
- csv.DictReader(f)：默认把第一行作为字段名键，将后续每一行数据封装为字典，
  可以通过 row["part_id"]、row["status"] 等列名直接取值，可读性极高。
需要牢记的是，csv 模块读取出来的所有字段内容在 Python 中都是纯字符串（str）类型，
进行大小比较或数值累加前，必须显式调用 int() 或 float() 完成转换。

写出 CSV 表格时，使用 csv.writer(f) 或 csv.DictWriter(f, fieldnames)。特别注意，
在使用 open() 打开待写入的文件时，必须显式传入 newline='' 参数。因为 csv 写入器
自带换行符终止控制，若不指定 newline=''，在 Windows 系统下每写一行便会自动产生一个多余空行。

### 例题
读取工件检测文件 records.csv（表头包含 part_id,weight,status），筛选出判定状态
为 "PASS" 的合格记录，并将工件编号与重量两列写出到新表格 pass_summary.csv 中。records.csv 的内容如下：

```text
part_id,weight,status
P01,50.5,PASS
P02,49.8,REJECT
P03,51.2,PASS
```

```python
import csv

with open("records.csv", "r", encoding="utf-8") as f_in:
    reader = csv.DictReader(f_in)
    with open("pass_summary.csv", "w", newline="", encoding="utf-8") as f_out:
        writer = csv.writer(f_out)
        writer.writerow(["part_id", "weight"])
        for row in reader:
            if row["status"] == "PASS":
                writer.writerow([row["part_id"], row["weight"]])

print("合格工件汇总完成")
# 运行结果：
# 合格工件汇总完成
```

### 常见错误
1. 打开待写入的 CSV 文件时遗漏了 newline='' 参数，导致输出文件在 Excel 等软件中行距异常且中间夹杂空行。
2. 忽视了从 CSV 读出的值全是字符串的事实，直接进行数值比较 if row["weight"] > 50 导致抛出类型错误 TypeError。
3. 在 DictReader 中访问字段时键名拼写与 CSV 文件的首行表头不完全一致，引发 KeyError。

## 检查记录：空值与格式
在分拣站生产实况中，工件表面反光可能导致相机未检出尺寸、网络抖动可能丢失字段，
导出的 CSV 文件中难免混入坏数据。如果在统计前不清洗，脏数据将导致指标失真或程序崩溃。

健全的工件记录检查主要包含以下三层检验：
1. 必填空值检查：对字段调用 strip()，判断其是否为空字符串；
2. 数值有效性检查：使用 try-except ValueError 结构尝试将尺寸或重量转为浮点数，
   并确认数值在物理合理区间（例如大于零）；
3. 状态枚举检查：严格核对判定字段是否属于合法集合（如 {"PASS", "REJECT"}）。

进行数据校验时，推荐使用 enumerate(reader, start=2) 跟踪数据在文件中的实际物理行号
（第 1 行为表头，故从 2 开始计数）。遇到校验失败的坏记录时，记录其物理行号与具体错误原因，
并且坏记录绝不能计入良品或废品统计，以确保后续分析结论真实可靠。

### 例题
编写记录清洗函数 clean_records，输入包含原始工件字典的列表，对 part_id（不能为空）、
length（必须能转换为大于零的浮点数）、status（必须为 PASS 或 REJECT）进行校验。
返回清洗后的有效列表与包含物理行号和错误信息的异常日志列表。

```python
def clean_records(rows):
    valid_list = []
    bad_logs = []
    for line_no, row in enumerate(rows, start=2):
        pid = row.get("part_id", "").strip()
        status = row.get("status", "").strip()
        len_str = row.get("length", "").strip()
        if not pid or status not in {"PASS", "REJECT"}:
            bad_logs.append((line_no, "字段缺失或判定未知"))
            continue
        try:
            val = float(len_str)
            if val <= 0:
                raise ValueError("数值非正")
        except ValueError:
            bad_logs.append((line_no, "长度格式非法"))
            continue
        valid_list.append({"part_id": pid, "length": val, "status": status})
    return valid_list, bad_logs

raw = [
    {"part_id": "P01", "length": "45.2", "status": "PASS"},
    {"part_id": "", "length": "30.0", "status": "PASS"},
    {"part_id": "P03", "length": "abc", "status": "REJECT"},
]
goods, bads = clean_records(raw)
print("有效记录数:", len(goods))
print("坏行日志:", bads)
# 运行结果：
# 有效记录数: 1
# 坏行日志: [(3, '字段缺失或判定未知'), (4, '长度格式非法')]
```

### 常见错误
1. 遇到脏数据时仅在终端打印错误信息而未阻断后续流程，导致坏记录仍被计入最终的统计报表中。
2. 检查空字段时未调用 strip()，使得仅由空格组成的无效文本被漏检并放行。
3. 统计报错行号时直接使用从 0 开始的普通循环计数，未考虑 CSV 表头占用的首行，导致排查日志中的行号与表格实际行号偏差 2 行。

## 单元小结
- 掌握使用 with open(..., encoding='utf-8') 安全读写文件，利用不同模式按需读取或追加分拣数据。
- 熟练运用 try-except-else-finally 结构捕获特定异常并安全兜底，避免单条脏数据导致分拣系统崩溃。
- 掌握标准库 csv.reader 与 csv.DictReader 处理表格数据，牢记读取值均为字符串且写出需设置 newline=''。
- 建立空值、格式转换与状态枚举的严密校验流程，利用行号准确隔离坏记录，确保统计指标客观真实。
