# 计时、中断与 PWM

本单元学习嵌入式系统的核心并发与节奏控制，包括基于 millis() 的非阻塞计时
架构、用于捕捉突发硬件事件的外部中断与 volatile 共享变量，以及基于片上定时
器的 PWM 脉宽调制与输出控制。

## 本单元知识点

- 阻塞延时与非阻塞计时：掌握 delay 阻塞的缺陷，学会利用 millis 差值判断超时与处理无符号回绕。
- 外部中断与 volatile：理解外部中断触发机制与 ISR 编写规范，掌握 volatile 共享变量与轮询取舍。
- 定时器与 PWM：理解 PWM 周期、频率与占空比，掌握硬件定时器独立生成 PWM 及调节平均电压。

## 阻塞延时与非阻塞计时

在单片机单线程顺序执行结构中，delay() 函数通过让 CPU 执行空循环消耗时间。
在延时期间，CPU 无法执行其他指令，既不能读取到位传感器电平，也无法接收
上位机串口命令，这会导致桌面分拣工位出现工件漏检或通信响应迟钝。

非阻塞计时的核心思想是利用单片机硬件定时器维护的系统运行时间。Arduino 提供
的 millis() 函数返回系统启动以来经过的毫秒数（类型为 32 位无符号整型
unsigned long）。程序每次循环仅需比较“当前时间”与“上次记录时间”的差值
是否达到预设的时间间隔。

计算超时的核心公式为：
当前时间 - 上次触发时间 >= 预设时间间隔
即：currentMillis - previousMillis >= interval

在 C 语言中，32 位无符号整型的取值范围为 0 到 4294967295（约 49.7 天）。当
数值达到最大值后会溢出回绕到 0。无符号整数减法在底层依据模 2^32 进行运算，
即便当前时间发生回绕变成较小的数值，二者的差值依然能正确反映实际流逝的
毫秒数，因此绝不能写成加法比较（如 currentMillis >= previousMillis + interval）。

### 例题

【题目】在桌面分拣工位中，当到位传感器检测到工件到达后，传送带需继续平移
运行 800 毫秒才能到达推料挡板位置。在此期间，单片机仍需保持运行指示灯以
200 毫秒为周期翻转闪烁。请使用 millis() 编写满足该需求的非阻塞核心逻辑代码。

【解答】
```c
unsigned long ledPreviousMillis = 0;
unsigned long sortStartMillis = 0;
bool sortingActive = false;
bool ledState = LOW;

void loop() {
  unsigned long currentMillis = millis();

  // 1. 独立运行的指示灯闪烁任务（非阻塞）
  if (currentMillis - ledPreviousMillis >= 200) {
    ledPreviousMillis = currentMillis;
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState);
  }

  // 2. 检测到工件触发，开启分拣等待计时
  if (digitalRead(SENSOR_PIN) == LOW && !sortingActive) {
    sortingActive = true;
    sortStartMillis = currentMillis;
  }

  // 3. 分拣超时到达判定（非阻塞）
  if (sortingActive && (currentMillis - sortStartMillis >= 800)) {
    sortingActive = false;
    triggerPusher(); // 触发推料挡板动作
  }
}
```
通过为不同任务维护独立的时间戳变量，指示灯任务与分拣延时任务在主循环中
快速轮询，互不阻塞，实现了多任务协同。该示例未做边沿检测，工件持续遮挡时会在推料后重新
开始计时；完整程序应结合边沿事件或状态机。

### 常见错误

1. 使用加法判断超时：写成 if (currentMillis >= previousMillis + interval)，在系统运行约 49.7 天发生回绕时，
   加法溢出导致判断出错，可能提前误触发或长时间不触发。
2. 误用有符号 long 存储时间：导致在系统运行约 24.8 天后符号位反转为负数，破坏差值比较。
3. 忘记在超时分支内更新基准时间：导致条件一旦满足就会在后续每次循环中重复触发。

## 外部中断与 volatile

外部中断是单片机引脚电平发生特定变化（如上升沿、下降沿或双边沿）时，由硬件
直接暂停当前主程序，强制跳转到中断服务函数（ISR）执行的硬件响应机制。对于
分拣工位中持续时间仅微秒级的高速工件遮光脉冲，中断能确保信号不被主循环其他
耗时代码漏掉。

编写中断服务函数必须遵循“快进快出”原则。ISR 内部仅执行修改状态标志或递增
计数值等极轻量操作，严禁调用 delay()、复杂数学运算或大量串口打印，具体的
机构驱动或算法处理应交由主循环轮询标志位完成。

在多任务或中断与主循环共享数据时，必须使用 volatile 关键字修饰共享变量。
例如 volatile int workpieceCount = 0;。volatile 明确告知编译器该变量可能在
主流程之外被意外修改，禁止编译器将其缓存在 CPU 寄存器中，确保主循环每次
读取都直接访问内存真实值。

合理取舍中断与轮询是系统设计的核心：
- 外部中断：适用于捕获不可预测、脉冲极窄、实时性要求极高的高速异步事件，但存在上下文切换开销和数据竞争风险。
- 轮询：适用于状态保持时间较长、低频或需要抗抖动的输入信号（如机械按键），结构简单且确定性高。

### 例题

【题目】分拣工位使用对射式光电传感器连接在单片机外部中断引脚（引脚 2）。工件
遮挡光线时传感器输出由高电平变为低电平（下降沿）。请编写中断初始化配置以及
中断服务函数，安全地对通过工件进行计数，并在主循环中安全读取该计数值。

【解答】
```c
const int sensorPin = 2;
volatile unsigned int workpieceCount = 0;

void workpieceISR() {
  workpieceCount++; // ISR 内仅做计数自增，迅速退出
}

void setup() {
  pinMode(sensorPin, INPUT_PULLUP);
  // 配置引脚 2 为下降沿触发中断
  attachInterrupt(digitalPinToInterrupt(sensorPin), workpieceISR, FALLING);
  Serial.begin(9600);
}

void loop() {
  static unsigned int lastReportedCount = 0;
  // 8 位单片机读取 16 位变量需要多条指令，读取期间暂时关中断以获得完整数值
  noInterrupts();
  unsigned int count = workpieceCount;
  interrupts();
  if (count != lastReportedCount) {
    lastReportedCount = count;
    Serial.print("Workpiece detected, total: ");
    Serial.println(lastReportedCount);
  }
}
```
workpieceCount 声明为 volatile，确保主循环能及时感知 ISR 的累加；ISR 仅包含
一行计数自增，执行耗时仅数微秒，保证了系统的实时性。主循环读取多字节共享变量时
须先关中断拷贝，volatile 本身不提供原子性。

### 常见错误

1. 在 ISR 中调用 delay() 或长文本 Serial 打印：ISR 执行期间全局中断默认处于关闭状态，依赖计时与串口中断的函数无法正常推进，
   可能导致延时失准或系统卡死。
2. 共享变量未加 volatile 修饰：编译器优化可能将变量常驻寄存器，导致主循环读不到中断更新的值。
3. 对机械按键盲目使用外部中断：机械触点抖动会在几毫秒内触发数十次中断，导致计数严重失真，按键应采用软件定时轮询消抖。

## 定时器与 PWM

脉宽调制（PWM，Pulse Width Modulation）是一种利用数字引脚输出高频方波，并通过
调节高电平持续时间来等效模拟电压输出的技术。它广泛应用于桌面分拣工位中的
传送带直流电机调速、舵机挡板角度定位和状态指示灯亮度平滑调节。

PWM 的核心参数与物理意义包括：
- 周期（T）：一个完整方波脉冲的时间长度，单位为秒或微秒。
- 频率（f）：单位时间内周期出现的次数，f = 1 / T，单位为赫兹（Hz）。
- 脉冲宽度（Ton）：一个周期内高电平持续的时间。
- 占空比（Duty Cycle, D）：高电平时间占总周期的百分比，D = (Ton / T) * 100%。

PWM 输出等效的直流平均电压公式为：
Vavg = Vhigh * D
其中 Vhigh 为单片机输出高电平电压（如 5.0 V）。当占空比为 50% 时，等效平均
电压为 2.5 V。只要 PWM 频率足够高（远超执行机构或人眼的响应极限），受控
对象就会将方波平滑积分，表现为连续的模拟受控效果。

PWM 信号由单片机片内的硬件定时器（Timer）全自动生成。在 Arduino 平台上调用
analogWrite(pin, value) 后，硬件定时器在后台自动比较计数并翻转引脚电平，
取值范围为 0 到 255（8 位分辨率）。在具备硬件 PWM 通道的引脚上（如 Arduino Uno 的
3、5、6、9、10、11 脚），整个 PWM 输出过程不需要 CPU 执行代码干预。

### 例题

【题目】在分拣工位中，单片机供电电压为 5.0 V。需要驱动传送带直流电机以约 60%
的额定速度运转，同时使工作状态指示灯输出等效 2.0 V 的平均电压。请分别计算：
指示灯所需的 PWM 占空比、调用 analogWrite 对应的整型参数值（四舍五入），
以及电机对应的 analogWrite 参数值。

【解答】
1. 指示灯输出 2.0 V 平均电压所需的占空比：
   根据公式 Vavg = Vhigh * D，可得：
   D = Vavg / Vhigh = 2.0 V / 5.0 V = 0.40（即 40%）。
2. 指示灯 analogWrite 参数计算（8 位分辨率，满量程 255）：
   参数值 = 255 * D = 255 * 0.40 = 102。
   故指示灯输出调用为 analogWrite(LED_PIN, 102);。
3. 电机 60% 额定转速对应的 analogWrite 参数计算：
   参数值 = 255 * 0.60 = 153。
   故电机调速输出调用为 analogWrite(MOTOR_PIN, 153);。

### 常见错误

1. 误以为 analogWrite 输出平滑直流电：该引脚输出的依然是高频数字方波，用普通万用表交流挡或示波器可观察到明显的周期波形。
2. 混淆占空比与频率：改变 analogWrite 的数值只会改变脉冲的高电平宽度（占空比），并不会改变定时器的基准方波频率。
3. 在不支持 PWM 硬件输出的引脚上调用 analogWrite：在未连接定时器通道的引脚上调用该函数通常会退化为简单的数字高低电平切换。

## 单元小结

- 非阻塞计时利用 millis() 与无符号差值运算判断超时，避免 CPU 空等，是实现分拣工位多外设协同的关键。
- 无符号 32 位整数相减天然支持溢出回绕，时间比较必须采用 (now - last >= interval) 形式。
- 外部中断用于微秒级突发事件捕获，中断服务函数必须快进快出，且共享变量须声明为 volatile。
- PWM 通过片上硬件定时器自动调节方波占空比，无需占用 CPU 周期即可等效输出不同平均电压。
- 在工位系统设计中，应权衡轮询与中断的适用场景，合理结合非阻塞定时与 PWM 驱动各类执行器。
