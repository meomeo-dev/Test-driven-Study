# 简短请求与指令

本单元学习在桌面质检分拣工位上听懂并发出直接工作指令，礼貌地提出协作请求，
并能用简短的 Yes / No 回答工位日常提问。

## 本单元知识点

- **祈使句指令**：听懂并准确发出以动词原形开头的直接指令及以 `Don't` 开头的禁止指令。
- **一般疑问句**：掌握用 `Are you` 与 `Do you` 询问设备和人员状态，并能规范简短回答。
- **礼貌请求**：掌握添加 `Please` 或使用 `Can you … please?` 礼貌求助及应答。

## 祈使句指令
<!-- concepts: imperatives -->

祈使句（Imperative Sentences）是工位日常操作与安全管理中最直接、最高效的句型，
专门用于向现场操作人员下达明确的动作指令、标准作业步骤或紧急安全提示。
由于说话双方在工位面对面协作，指令直接指向眼前的操作者，因此句子通常省略主语 `you`，
开门见山以动词原形开头，确保听者在最短时间内捕捉到核心动作，减少误操作风险。

### 语法结构与工位核心句型表

| 句型类别 | 语法公式 | 典型工位指令 | 中文含义与工位操作场景 |
| --- | --- | --- | --- |
| 肯定祈使句（单动作） | `动词原形 + 其他成分` | `Press the button.` | 按下按钮（启动分拣站检测或复位单片机） |
| 肯定祈使句（双词短语） | `动词 + 副词 + 宾语` | `Turn off the light.` | 关闭指示灯（检测结束后关闭补光灯） |
| 肯定祈使句（单动词） | `动词原形!` | `Stop!` / `Wait.` | 紧急停机！/ 等待相机完成识别 |
| 肯定祈使句（含地点） | `动词原形 + 宾语 + 地点` | `Put it here.` | 把它放在这里（放入传感器感应区） |
| 否定祈使句（禁止） | `Don't + 动词原形 + 其他` | `Don't touch.` | 不要触碰（舵机摆动或通电运行禁止伸手） |
| 否定祈使句（防误动） | `Don't + 动词原形 + 宾语` | `Don't move it.` | 不要移动它（上位机拍照判定时固定工件） |

在学习 `Turn on`（打开电器或光源）与 `Turn off`（关闭电器或光源）时，要与 `Open`（打开门、盒、盖子等物理容器）和 `Close`（关闭门、盒、盖子）严格区分。例如：打开零件盒说 `Open the box.`，打开指示灯说 `Turn on the light.`；千万不能说成 `Open the light.` 或 `Close the light.`。

当同一条指令需要带出具体次数或简单条件时，可以直接把数量词短语放在宾语后面，例如：
- `Press the red button 3 times.`（按三次红色按钮，用于进入校准模式。）
- `Wait 5 seconds.`（等待五秒，等待传送带完全停稳。）
- `Check the box before leaving.`（离开前检查料盒，确保没有遗留待检工件。）

### 车间对话示范

下面是新员工小李与带教师傅在桌面质检分拣站联调时的一段真实对话：

- **Master（师傅）**: `Put the red part on the belt. Wait for the camera.`（把红色工件放到传送带上，等相机识别。）
- **Li（小李）**: `OK. The green light is on.`（好的，绿灯亮了。）
- **Master（师傅）**: `Stop! Don't touch the servo. Turn off the power switch first.`（停下！不要碰舵机。先关掉电源开关。）
- **Li（小李）**: `Power is off. What next?`（电源关好了。接下来做什么？）
- **Master（师傅）**: `Check the sensor and press the reset button.`（检查传感器，然后按下复位按钮。）

对话中可以看到，在设备出现异常或舵机即将动作时，师傅连续使用了 `Stop!`、`Don't touch...`、`Turn off...` 等祈使句，短促有力、毫无歧义，这是车间安全沟通的黄金准则。

### 例题 1：识别祈使句结构与动作响应

**题目**：
桌面分拣站运行中，带教师傅连续对你发出两条指令：
`Don't touch.` 和 `Press the button.`。
请写出这两句话的语法结构、中文含义，并说明工位操作人员应做出的规范动作。

**解答**：
1. `Don't touch.`
   - 结构：否定祈使句（`Don't + 动词原形`）。
   - 含义：不要触碰。
   - 动作：双手立即离开工件传输轨道与舵机挡板动作区域，防止夹手或损坏元件。
2. `Press the button.`
   - 结构：肯定祈使句（`动词原形 + 宾语`）。
   - 含义：按下按钮。
   - 动作：找到控制箱上的启动或复位按钮并按下，恢复系统运行。

### 例题 2：区分电器开关与物理开合指令

**题目**：
下班离岗前，班长安排你完成两项收尾操作：（1）关闭工位补光灯；（2）盖上待检螺丝盒。
请分别写出这两项操作对应的标准英文祈使句，并解释为什么不能互换动词。

**解答**：
1. 关闭工位补光灯：`Turn off the light.`
   - 解析：灯具、电源、机器等带电设备的“打开/关闭”必须用 `Turn on / Turn off`。
2. 盖上待检螺丝盒：`Close the box.`
   - 解析：门、窗、盒盖等机械或物理容器的“打开/关闭”必须用 `Open / Close`。
3. 不可互换的原因：英文中 `Open the light` 或 `Turn off the box` 均不符合母语与工业英语习惯，容易让外籍主管或同事产生理解困惑。

### 例题 3：带次数与前提条件的祈使句翻译

**题目**：
在交班点检表上看到一条英文操作要求：
`Press the yellow button twice and turn off the lights before leaving.`
请将其拆解为先后两个动作，并翻译成准确的中文。

**解答**：
- 动作拆解：第一个祈使动词 `Press` 要求按两次（`twice`）黄色按钮；连词 `and` 衔接第二个祈使动词 `turn off`，要求关灯；时间状语 `before leaving` 表示“在离开之前”。
- 中文翻译：“离开前按两次黄色按钮并关闭指示灯。”

### 常见错误

- **误加主语 `You`**：在下达直接指令时误说成 `You press the button.`，这样听起来像是在陈述日常习惯（“你按按钮”），削弱了工位指令的即时性与执行力。
- **动词形式错误**：误用现在分词或第三人称单数，如写成 `Pressing the button.` 或 `Puts it here.`。无论对象是谁，祈使句句首动词一律使用原形。
- **否定词误用 `No`**：受母语直译习惯影响说成 `No touch.` 或 `Not open the door.`。标准的英文禁止指令必须使用 `Don't + 动词原形`（正式书面标牌有时用 `Do not`，如 `Do not touch.`）。
- **混用 `turn off` 与 `close`**：把“关灯”误说成 `Close the light.`，把“关盒”误说成 `Turn off the box.`。记住“通电用 turn，开盖用 open/close”。

## 一般疑问句
<!-- concepts: yes-no-questions -->

一般疑问句（Yes-No Questions）是车间巡检、班前确认与故障排查时使用频率最高的一类问句。
它主要用于核实人员准备状态、工具佩戴情况、工件合格与否以及设备运转是否正常，
最大特点是可以用 `Yes` 或 `No` 作出简短、明确、毫不拖泥带水的回答。

### 两大核心句型与简短回答对照表

根据句子谓语动词的性质，一般疑问句分为 **`be` 动词引导** 和 **助动词 `do / does` 引导** 两大体系，提问与回答必须严格“同根呼应”：

| 疑问句类型 | 提问公式 | 工位例句 | 肯定简短回答 | 否定简短回答 |
| --- | --- | --- | --- | --- |
| `be` 动词（问人） | `Are you + 状态/身份?` | `Are you ready?` | `Yes, I am.` | `No, I'm not.` |
| `be` 动词（问物） | `Is + 单数主语 + 状态?` | `Is it OK?` / `Is the box full?` | `Yes, it is.` | `No, it isn't.` |
| `be` 动词（问复数） | `Are + 复数主语 + 状态?` | `Are the parts clean?` | `Yes, they are.` | `No, they aren't.` |
| 助动词 `Do`（问动作/拥有） | `Do you + 动词原形...?` | `Do you have gloves?` | `Yes, I do.` | `No, I don't.` |
| 助动词 `Does`（问单数设备） | `Does + 单数主语 + 原形?` | `Does it work?` | `Yes, it does.` | `No, it doesn't.` |
| 助动词 `Do`（问复数人/物） | `Do + 复数主语 + 原形?` | `Do they fit?` | `Yes, they do.` | `No, they don't.` |

掌握一般疑问句的秘诀在于“**用什么问，就用什么答；问谁就换成对应人称**”：
1. 听到 `Are you ...?` 时，问的是“你”，回答站在自己的角度要变成 `I`，且 `you` 配 `are`，`I` 配 `am`，所以回答 `Yes, I am.` 或 `No, I'm not.`。
2. 听到 `Is it ...?` 或 `Is the machine ...?` 时，主语是单数物，回答用 `it` 指代，所以回答 `Yes, it is.` 或 `No, it isn't.`。
3. 听到 `Does the sensor work?` 时，因为句首是 `Does`（第三人称单数助动词），主语 `the sensor` 在回答中简化为 `it`，所以回答 `Yes, it does.` 或 `No, it doesn't.`；切记在 `Does ...` 问句中，实义动词 `work` 要恢复原形，不能写成 `Does it works?`。

### 车间对话示范

下面是开班前质检组长与工位操作员进行班前五分钟核查的对话：

- **Leader（组长）**: `Good morning, Chen. Are you ready for the morning shift?`（早上好，小陈。早班准备好了吗？）
- **Chen（小陈）**: `Yes, I am.`（是的，我准备好了。）
- **Leader（组长）**: `Do you have safety gloves and a screwdriver?`（你有防护手套和螺丝刀吗？）
- **Chen（小陈）**: `Yes, I do. They are on my tray.`（有的，都在我的托盘上。）
- **Leader（组长）**: `Good. Look at the green light. Does the camera work today?`（很好。看那盏绿灯，今天相机工作正常吗？）
- **Chen（小陈）**: `No, it doesn't. The cable is loose.`（不正常，线缆松了。）
- **Leader（组长）**: `Is the spare camera in the blue box?`（备用相机在蓝盒子里吗？）
- **Chen（小陈）**: `Yes, it is. Let me check it.`（在的，我来检查一下。）

通过这段对话可以看出，短短四组一问一答就完成了人员就绪、劳保工具、主设备状态和备用件位置的全部确认，既省时又不易出错。

### 例题 1：情境化匹配 `be` 动词与助动词回答

**题目**：
分拣班次开始前，质检组长巡检工位并向你询问两个问题：
问题 1：`Are you ready?`
问题 2：`Do you have gloves?`
请分别写出你在“已准备好且佩戴了手套”与“未准备好且手套缺失”两种情境下的规范回答。

**解答**：
1. 情境一（已准备好且有手套）：
   - 对问题 1 回答：`Yes, I am.`
   - 对问题 2 回答：`Yes, I do.`
2. 情境二（未准备好且无手套）：
   - 对问题 1 回答：`No, I'm not.`
   - 对问题 2 回答：`No, I don't.`

### 例题 2：第三方设备提问的人称转换与 `does` 还原

**题目**：
工友指着 2 号台面上的电动螺丝刀问你：“它能正常运转吗？”
请写出标准英文一般疑问句，并分别给出“正常”与“故障不能转”两种简短回答。

**解答**：
- 英文提问：`Does it work?`（或 `Does the electric screwdriver work?`）
- 解析：“运转/工作”是实义动词 `work`，主语是单数设备 `it`，因此句首必须用第三人称单数助动词 `Does`，后面的动词 `work` 保持原形，不可加 `-s`。
- 肯定回答：`Yes, it does.`
- 否定回答：`No, it doesn't.`

### 例题 3：识别混合句型中的一般疑问句

**题目**：
判断下列四句工位用语中，哪两句属于可以用 `Yes` / `No` 回答的一般疑问句，并说明另外两句分别是什么句型：
A. `Where is the wrench?`
B. `Is the tray clean?`
C. `Don't press that button.`
D. `Do you need a new box?`

**解答**：
- 属于一般疑问句的是 **B**（`Is the tray clean?`，用 `Yes, it is. / No, it isn't.` 回答）和 **D**（`Do you need a new box?`，用 `Yes, I do. / No, I don't.` 回答）。
- A 是以疑问词 `Where` 开头的特殊疑问句，需要回答具体地点，不能只答 `Yes/No`。
- C 是以 `Don't` 开头的否定祈使句，表示禁止指令，不是疑问句。

### 常见错误

- **混淆 `be` 动词与助动词**：听到 `Do you have gloves?` 时脱口而出 `Yes, I am.`，或者听到 `Are you ready?` 时答成 `Yes, I do.`。牢记助动词 `Do` 问必须用 `do` 答，`Are` 问必须用 `am/is/are` 答。
- **在 `Does` 问句中动词多加 `-s`**：误写成 `Does it works?` 或 `Does the light blinks?`。一旦句首出现了 `Does`，后面的实义动词必须立刻打回原形。
- **仅回答单个生硬的 `Yes.` 或 `No.`**：在嘈杂的车间环境中，单音节词容易听漏或引起歧义，规范的做法是带上主语和核心词（如 `Yes, it is.`、`No, it doesn't.`）。
- **否定回答前后矛盾**：写成 `No, I do.` 或 `No, it is.`。否定简短回答必须前后双重否定，即前面用 `No`，后面也必须用否定缩写 `don't`、`doesn't`、`isn't`、`aren't` 或 `I'm not`。

## 礼貌请求
<!-- concepts: polite-requests -->

在工位日常协同中，除了突发险情需要大声下达直接指令外，绝大多数场景都需要向邻位同事求助、
借用工具或协调工作节奏。在指令和问句中加入礼貌表达，既能清晰传递需求，又能体现职业素养与团队尊重。
只要掌握了前两节的祈使句或一般疑问句基础，就能轻松学会车间礼貌请求与得体应答。

### 礼貌请求的三种梯度与应答句型表

| 礼貌程度 | 句型结构 | 工位常用例句 | 适用场景 |
| --- | --- | --- | --- |
| 基础礼貌（句首加 `Please`） | `Please + 动词原形...` | `Please open the box.` | 常规流程交办、公告牌提示 |
| 缓和礼貌（句尾加 `, please`） | `动词原形..., please.` | `Pass the screwdriver, please.` | 递接工具、日常配合（注意逗号） |
| 委婉求助（`Can you...?`） | `Can you + 原形..., please?` | `Can you check the parts, please?` | 请忙碌中的同伴搭把手 |
| 客气商量（`Could you...?`） | `Could you (please) + 原形...?` | `Could you help me?` | 搬运重箱、跨组借调器材 |

收到同事的礼貌请求时，无论能否帮忙，都需要给出清楚、友善的口头回应：
- **爽快答应**：`Sure.`（当然可以。）/ `Sure, here you are.`（好的，给你。）/ `OK, no problem.`（没问题。）
- **手头正忙、委婉拒绝**：`Sorry, I can't.`（抱歉，我现在抽不开身。）若能补充一句原因，对方会更理解，例如 `Sorry, I can't. I'm checking this batch.`（抱歉不行，我正在检查这一批。）

### 车间对话示范

下面是两位装配员在流水线交接物料与工具时的对话：

- **Worker A（甲）**: `Excuse me, Tom. Could you help me lift this heavy box?`（打扰一下，汤姆。能帮我抬一下这个重箱子吗？）
- **Tom（汤姆）**: `Sure, no problem. Where do we put it?`（当然没问题。我们把它放哪儿？）
- **Worker A（甲）**: `Please put it on the blue pallet. And can you pass me the wrench, please?`（请放到蓝色托盘上。能再递给我一下扳手吗？）
- **Tom（汤姆）**: `Sure, here you are.`（好的，给你。）
- **Worker A（甲）**: `Thanks! Could you also check the timer at station two?`（谢谢！你还能顺便核对一下二号工位的计时器吗？）
- **Tom（汤姆）**: `Sorry, I can't. I have to finish my tray first.`（抱歉我抽不开身，我得先做完我托盘上的工件。）

### 例题 1：比较直接祈使句与礼貌问句的语气差异

**题目**：
比较以下两句表达同一操作的英文句子：
句子 A：`Press the button to stop.`
句子 B：`Can you press the button, please?`
请分析两者的语法形式差异与语气差别，并说明各自适合在何种工位情境下使用。

**解答**：
1. 语法形式差异：
   - 句子 A 是直接祈使句，使用动词原形 `Press` 开头，带不定式目的状语 `to stop`。
   - 句子 B 是情态动词引导的疑问句，使用 `Can you … please?` 句型。
2. 语气与适用场合差别：
   - 句子 A 语气直接、坚决且果断，适用于工件卡死或紧急停机等争分夺秒的现场操作。
   - 句子 B 语气客气、委婉且尊重，适用于自己双手正在测量工件尺寸，请同伴顺手协助按键复位的协作场景。

### 例题 2：将直接指令改写为不同礼貌层级的请求

**题目**：
同伴正在整理工具台，你想请他把蓝色文件夹递给你。直接指令是：`Pass me the blue folder.`
请分别用（1）句尾加 `please`、（2）`Can you...` 和（3）`Could you please...` 三种形式改写，并写出一句答应对方请求的自然回复。

**解答**：
1. 句尾加 `please`：`Pass me the blue folder, please.`（注意 `please` 放在句尾时前面要有逗号。）
2. `Can you...` 形式：`Can you pass me the blue folder, please?`
3. `Could you please...` 形式：`Could you please pass me the blue folder?`
4. 答应回复：`Sure, here you are.` 或 `OK, no problem.`

### 例题 3：礼貌拒绝请求的情境表达

**题目**：
组长走过你的工位问：`Can you clean station 3 right now?`（你现在能去清理 3 号工位吗？）
但你的主机正在进行 100 件抽检，必须紧盯屏幕不能离开。请选出最得体的回复并说明原因：
A. `No!`  B. `Don't ask me.`  C. `Sorry, I can't.`  D. `Yes, I am.`

**解答**：
- 最得体的回复是 **C**（`Sorry, I can't.`）。
- 解析：A 只有一个字 `No!`，语气过于生硬对抗；B 表示“别问我”，态度粗鲁；D 用 `be` 动词回答 `Can` 问句且语义相反；只有 `Sorry, I can't.` 既礼貌致歉又明确说明当前无法协助。

### 常见错误

- **情态动词后动词未用原形**：误说成 `Can you pressing the button?` 或 `Could you helps me?`。情态动词 `Can` 和 `Could` 后面必须紧跟动词原形 `press`、`help`。
- **句尾 `please` 漏写逗号**：写成 `Open the door please.` 虽口语无大碍，但规范书面指令中，句尾的 `please` 前通常需加逗号：`Open the door, please.`。
- **把 `please` 塞进错误位置**：误说成 `Can please you help me?`。正确语序是 `Can you please help me?` 或 `Can you help me, please?`。
- **拒绝请求时语气过于生硬**：手头忙碌无法帮忙时直接冷冰冰地回复 `No!` 或 `I won't.`，容易破坏班组合作氛围，应养成用 `Sorry, I can't.` 缓冲的习惯。

## 工位实作：分拣站请求与指令自评

**目标**：能准确听懂并发出工位直接指令，熟练完成指令向礼貌请求的改写与口头表达，
并能对工位就绪与合格状态进行无误的简短问答。

**材料或准备**：
- 桌面质检分拣站（包含到位传感器、摄像头检验位、舵机挡板及良品/不良品料盒）。
- 工位常用装配与调试工具（螺丝刀 `screwdriver`、待检零件盒 `box`）。
- 两位学习者结对（一人扮演主检员，一人扮演装配协助员）。

**实作步骤**：
1. **指令改写训练**：将三条工位常见基础指令改写为礼貌请求形式：
   - `Open the box.` 改写为 `Please open the box.` 或 `Can you open the box, please?`。
   - `Pass the screwdriver.` 改写为 `Can you pass the screwdriver, please?`。
   - `Wait here.` 改写为 `Please wait here.`。
2. **工位协作对话演练**：主检员正在调试传感器灵敏度，向同伴发出请求：
   `Can you pass the screwdriver, please?`，同伴递送工具并回答 `Sure.`。
3. **工具与物料交互演练**：主检员指向零件盒发出请求：
   `Please open the box.`，同伴完成开盒并回复 `OK.`。
4. **一般疑问句状态对练**：同伴在开机前核对状态，向主检员提问：
   `Are you ready?` 与 `Do you have gloves?`；主检员根据真实状态
   分别回答 `Yes, I am.` / `No, I'm not.` 和 `Yes, I do.` / `No, I don't.`。
5. **分拣站联调实操**：启动分拣站，上位机串口监视器输出工位通信状态：
```text
SENSOR: DETECTED
CAMERA: INSPECTING
SERVO: SORTING
```
   当串口发生报警或传输卡滞时，一人发出指令 `Stop!` 与 `Don't touch.`，
   排查完毕后礼貌请对方启动：`Can you press the button, please?`。

### 自评清单

- [ ] 能在听懂 `Press the button.`、`Turn off the light.`、`Stop!`、`Wait.`、
  `Put it here.`、`Don't touch.` 后做出正确工位动作。
- [ ] 能将 `Open the box.`、`Pass the screwdriver.`、`Wait here.` 准确改写为
  带 `Please` 或 `Can you … please?` 的礼貌请求并流利说出。
- [ ] 能在听到 `Are you ready?` 与 `Do you have gloves?` 时，正确使用对应
  be 动词或助动词给出肯定与否定简短回答。
- [ ] 面对同伴的现场求助，能自然使用 `Sure.` 或 `Sorry, I can't.` 进行礼貌应答。

当上述自评标准全部达标后，请在“学习路径”中把本单元各知识点标记为“已会”。

## 单元小结

- 祈使句是工位最高效的指令方式：肯定指令动词原形打头，禁止动作一律使用 `Don't`。
- 一般疑问句回答看句首助词：`Are you` 用 `I am` 应答，`Do you` 用 `I do` 应答，`Does it` 用 `it does` 应答。
- 礼貌请求让工位协作更顺畅：在指令中加 `Please` 或使用 `Can you … please?` / `Could you please …?`。
- 区分工位紧急与协同场景：危急故障用直接指令，日常协助用礼貌请求，拒绝时使用 `Sorry, I can't.`。
