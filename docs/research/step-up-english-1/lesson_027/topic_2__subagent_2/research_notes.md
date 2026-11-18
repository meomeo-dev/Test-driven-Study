# 工业质检流程中关于参数、时间、责任人的实操提问研究报告

## 一、 课程背景与主题概述
本报告隶属于【step-up-english-1】第 27 课时《一般现在时与动词基础形态：第 7 讲 特殊疑问句（5W1H）在一般现在时中的构建》。作为现场应用工程师（FAE），本研究旨在将一般现在时态与 5W1H（Who, What, Where, When, Why, How）特殊疑问句结构无缝嵌入真实工业制造与质量检验场景中，重点探讨**参数（What/How）**、**时间（When）**与**责任人（Who）**在现代化智能工厂与质检（QC/QA）流程中的实操提问与规范化管理。

---

## 二、 工业质检中的 5W1H 矩阵分析

下表梳理了在三大典型制造工业（CNC 精密加工、SMT 表面贴装、注塑成型）中，如何应用一般现在时与 5W1H 句式构建高频质检问答与现场控制逻辑：

| 5W1H 维度 | 对应英语句式示例 (Present Simple) | CNC 加工场景应用 | SMT 电子制造场景 | 注塑成型场景 |
| :--- | :--- | :--- | :--- | :--- |
| **What (何事/参数)** | *What parameters do we check?* | 检查主轴转速、进给速率、GD&T 公差与表面粗糙度 ($Ra$)。 | 检查回流焊温度曲线、锡膏厚度（SPI）及元器件坐标。 | 检查熔胶温度、注射压力、保压时间及制件重量。 |
| **Who (何人/责任)** | *Who inspects the first article?* | 生产操作工（自检）与质量检验员（QC）。 | SMT 工艺工程师与线长/巡检员。 | 调机技术员（Setter）与品质工程师（QA）。 |
| **When (何时/时间)** | *When do we perform calibration?* | 首件检验（FAI）及每 2 小时巡检一次。 | 换线首件确认及每批次实时在线 AOI/SPI。 | 开机首模确认及每小时外观/尺寸抽检。 |
| **Where (何地/地点)** | *Where is the CMM located?* | 机械加工车间与三坐标测量室（CMM）。 | SMT 无尘车间产线及离线 X-Ray 检测区。 | 注塑车间现场与实验室物理性能测试区。 |
| **Why (何因/目的)** | *Why do we measure tolerance?* | 防止尺寸超差导致装配失效。 | 消除电气短路、虚焊与冷焊。 | 避免翘曲、飞边、缩水及缺胶。 |
| **How (如何/方法)** | *How do you measure this?* | 使用数显千分尺、卡尺及三坐标测量仪。 | 使用在线 SPI、高速 AOI 与 AXI。 | 使用电子称（克重）、投影仪与游标卡尺。 |

---

## 三、 真实工程参数与典型实操问答案例

### 案例 1：CNC 机械加工车间的参数与责任问答
*   **英文场景对话 (English Operational Dialogue):**
    *   *Inspector:* " **What** tolerance limit do you check on this flange?"
    *   *Operator:* "We check $\pm 0.05\text{ mm}$ for the outer diameter and $Ra < 1.6\mu m$ for surface finish."
    *   *Engineer:* " **When** do you measure the first article?"
    *   *Operator:* "I measure it right after the CNC program starts, and **who** verifies the report is our shift QC inspector, John."
*   **工程解析:** 一般现在时用于描述标准工艺规程（SOP）中永恒或常规的质检动作。

### 案例 2：SMT 电子组装线的时间与工序质检
*   **英文场景对话:**
    *   *Manager:* " **How** does the SPI machine detect solder paste defects?"
    *   *Operator:* "It scans 3D height profiles in real-time."
    *   *Quality Lead:* " **When** do we run offline X-Ray inspection?"
    *   *Technician:* "We run it every two hours for BGA hidden solder joints, and **who** signs off the log is the SMT supervisor."

---

## 四、 参考文献与标准出处
1. **ISO 9001:2015** Quality Management Systems — Requirements (Clause 8.6 Release of Products and Services, Clause 9.1 Monitoring & Measurement).
2. **IATF 16949:2016** Automotive Quality Management System Standard (Control Plan and FAI requirements).
3. **IPC-A-610G** Acceptability of Electronic Assemblies (SMT Inspection Criteria).
4. **ASME Y14.5-2018** Dimensioning and Tolerancing (GD&T Standards).
