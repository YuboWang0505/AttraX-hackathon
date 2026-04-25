# AttraX 产品需求文档（PRD）

> 春潮 Spring 深圳黑客松参赛项目
> 版本：v1.5（黑客松现场 demo 版 + 语音通话落地）
> 文档日期：2026-04-25

---

## 1. 产品概述

### 1.1 一句话定义
**AttraX** 是一款面向异地情侣 / SM 搭子的远程互动情趣产品，由 **Web 应用 + 蓝牙跳蛋硬件** 组成。S 方在网页上打字聊天即可实时控制 M 方佩戴的硬件震动强度，让 SM 场景中的"语言调教"与"硬件调教"合一；M 方可通过安全词随时强制断开控制权。

### 1.2 产品定位
- **差异点 1**：文本驱动硬件。S 不再需要一边打字一边切档位，LLM 理解文本意图后自动下发强度指令。
- **差异点 2**：语音安全词。M 在行动能力受限的时刻（被束缚、捂嘴等）能仅靠说话中断一切控制，保障"玩得安全"。
- **差异点 3**：双端 Web，无需装 App，浏览器直接走 Web Bluetooth 连硬件。

### 1.3 目标人群
| 人群 | 特征 | 痛点 |
|---|---|---|
| 异地情侣 | 物理距离阻隔亲密感 | 想要有身体参与的远程互动，而非单纯打字 |
| SM 搭子 | 偏好调教场景，对安全与信任有明确边界需求 | 现有工具要么只有聊天、要么只有硬件开关，S 方一心多用，M 方的安全出口不够顺滑 |

### 1.4 目标场景
S 方坐在电脑前想要远程调教异地的 M，打开网页 → 输入同一个 6 位匹配 code → 进入聊天页。S 发"给我跪好"，M 端跳蛋自动进入中档；S 发"给我丢"，跳蛋切到最高档。整个过程 S 只需要打字。中途 M 感到不适，脱口而出"安全词"三个字，硬件立即停止，会话终止。

---

## 2. 版本规划

| 版本 | 范围 | 状态 |
|---|---|---|
| **v1**（核心通路） | 角色/code 登入、安全词、文字聊天、意图→档位映射、真实 Web Bluetooth（Vibration_Egg 协议）、安全词断开、档位可视化、响应式 UI、Landing 页 | ✅ 已交付（周五 Day 1） |
| **v2**（多模态升级） | WebRTC 语音通话、服务端 STT（SiliconFlow SenseVoice）→ 意图管线、来电振铃流程、紧急停止按钮、通话期 chat UI 不打断 | ✅ 已交付（周六 Day 2，提前并入主分支） |
| **v3**（可选增强） | 阅后即焚照片/视频、安全词浏览器端语音监听 | 黑客松后续 |

本 PRD 覆盖 **v1 + v2 已落地部分**，v3 留作章节末尾 roadmap。

---

## 3. 角色定义

| 角色 | 标识 | 在系统中 | 硬件 |
|---|---|---|---|
| **S**（Dom / 支配方） | 输入 code 后选 S | 发聊天消息，触发档位变化 | 不佩戴硬件 |
| **M**（Sub / 被支配方） | 输入 code 后选 M | 接收聊天，硬件受控 | 佩戴蓝牙跳蛋 |

每个房间只允许 **1 个 S + 1 个 M**。code 为 **6 位数字**（0-9），服务端随机生成。**任一角色都可以创建房间**（先连接该 code 的 ws 视为创建方）：登入页不预先区分创建 / 加入，留空 code 点击"开始匹配" = 创建；输入已有 code 点击 = 加入。code 由创建方带出，用任意渠道（微信、口头）告诉对方。

**安全词由创建方在登入页设置**，默认值为 "安全词"。若创建方没填、加入方填了，则加入方的值生效（以服务端收到的第一个非空值为准）。双方进入聊天页后均可见当前房间生效的安全词。

---

## 4. 功能需求（v1）

### 4.1 登入页

#### 功能清单
- **角色选择**：S / M 单选
- **Code 输入框**：6 位纯数字（0-9），数字键盘友好；**留空表示创建房间，服务端自动生成 code**
- **安全词输入**（**S 和 M 都显示**）：
  - 文本输入框，占位提示 "安全词"
  - 留空则使用默认值 "安全词"
  - 最长 16 字符，服务端 trim 前后空格
  - 先进入房间的一方（创建方）设置的安全词生效；加入方填入的值若创建方已设则被忽略
- **主按钮**：动态文案
  - code 为空 → "创建房间"（先 `POST /api/room` 拿 code 再连 ws）
  - code 有值 → "加入房间"
- **匹配等待态**：进入聊天页后，若对方未到 → 消息区显示房间号大字体、安全词和"等待对方加入…"

#### 登入后流程分叉
- **S 点击按钮** → 直接进入聊天页（S 不需要硬件）
- **M 点击按钮** → 先进入**蓝牙连接页（BtGate）**，成功配对后才进聊天页；未配成则卡在此页直到重试成功或显式切演示模式
- M 侧 WS **延后到 BT 配对成功（或显式演示模式）后才建连**。这样 S 看到的 `room_waiting` 状态反映的是 M 真正可用，而非 M 只完成登入但硬件未就绪

#### 交互细节
- 同一个 code 若已有两人占用，第三人进入提示"房间已满"并阻止
- 同一个 code 若当前为空，第一个进入者即创建房间，等对方
- 角色冲突：两人选同一角色（两个 S 或两个 M），提示"角色冲突，请其中一方切换"
- **安全词归属**：安全词跟着 M 走。M 先进的房间，M 的安全词立即生效；S 先进房间，房间处于等待 M 设词的状态，此时若 S 发消息不触发档位变化（聊天页暂不开放输入），直至 M 加入并配置完毕
- M 端进入聊天页前需触发一次 **Web Bluetooth 配对弹窗**，允许脱机跳过（脱机演示用）

#### UI 要点
- 响应式布局：桌面端居中卡片（最大宽 480px），移动端全屏
- 极简风格，暗色底，紫红渐变强调色
- 角色选择用两个大卡片（S / M）

### 4.2 聊天页

#### 功能清单
- **常驻安全词展示**：页面顶部固定区域，任何时刻可见
- **档位可视化**：当前档位（0/1/2/3）以动画呈现
  - 0 档：静止
  - 1 档：缓慢呼吸波纹（约 2 秒/周期）
  - 2 档：中速脉冲（约 1 秒/周期）
  - 3 档：快速高频脉冲（约 0.3 秒/周期）
- **聊天流**：气泡式上下滚动，S/M 左右分列
- **输入框 + 发送按钮**：支持回车发送，移动端兼容软键盘
- **退出按钮**：点击后双方会话立刻关闭
- **连接状态指示器**：蓝牙已连 / 未连 / 脱机模式

#### 交互细节
- S 发送的消息：前端显示 → WebSocket 传给后端 → 后端做意图识别得出 intensity → 广播 `{text, intensity}` 给 M 与 S 自己
- M 端收到消息后：
  - 显示文字气泡
  - 更新档位动画
  - 调用 Web Bluetooth 写指令到跳蛋（若已连接）
- M 也能发送文字消息（SM 场景中 M 同样可能有话说），但 **M 的消息不触发档位变化**
- **档位持续时间**：intensity 持续至下一条 S 消息；不自动衰减，不定时脉冲。M 端在收到新 S 消息前，档位保持不变
- **消息乱序保护**：服务端为每条 chat 消息分配单调递增的 `seq_id`；M 端（以及 S 自己的回显）只在 `seq_id > last_applied_seq_id` 时应用该条消息的 intensity，**过时的 LLM 回包被丢弃**。场景：S 快速连发两条，第二条命中码表秒回、第一条等 LLM 1s 后回来 —— 第一条的 intensity 会被丢弃，避免"老意图覆盖新档位"
- 任一方点退出 或 命中安全词 → 服务端广播 `safe_word_triggered` 或 `session_end` → 双方立即断开、停马达、跳回登入页

#### UI 要点
- 桌面端：左侧聊天流占主，右侧档位动画面板
- 移动端：上下分区，档位动画压缩到顶部条
- 动画用纯 CSS keyframes 或 Framer Motion，**非色情暗示**（用波纹/光晕/呼吸）

### 4.3 安全词（核心安全机制）

#### 设置（v1）
- **任一角色均可在登入页输入**，可自定义；留空则默认 "安全词"
- **首个提供非空 safeWord 的连接胜出**（first-write-wins）：
  - 创建方（首个连入）若带了 safeWord → 服务端保存
  - 创建方未带、加入方带了 → 服务端保存加入方的值
  - 两方都没带 → 双方就位时服务端兜底写入默认 "安全词"
  - 胜出后任何后续 `set_safe_word` 或 query 参数均被静默忽略
- 服务端在创建/更新房间时持久化（内存中）该房间的安全词
- 不区分大小写；前后空格 trim；不区分全角/半角标点

#### 触发条件（v1）
1. **文字触发**：S 或 M 任一方在输入框中发送的文本精确匹配当前房间配置的安全词
2. **优先级最高**：在所有意图识别之前短路判断，直接终止
3. **匹配策略**：归一化后做全字符串相等比较，避免误触（不做子串匹配）。归一化步骤：
   1. trim 首尾空白
   2. 去除首尾标点（`!?,.;:、，。！？；：` 及对应全角符号）
   3. 全角转半角 + 统一小写
   4. 处理后的字符串与房间配置的安全词相等则命中
   - 例："安全词！"、"  安全词  "、"安全词。" 均命中；"说了安全词" 不命中（子串不算）

#### 触发后系统行为（在 50ms 内完成）
1. 服务端广播 `safe_word_triggered` 消息
2. M 端浏览器立即执行蓝牙写 `intensity=0` + 断开 GATT 连接
3. 双方页面跳出模态："会话已安全终止"
4. 2 秒后自动跳回登入页
5. 房间内存记录清除

#### v2 扩展
- 接入 Web Speech API（浏览器原生 STT），M 端常驻监听麦克风，识别到房间配置的安全词触发同样流程

### 4.4 意图识别管道（核心算法）

#### 管道结构
```
S 发送文本
  │
  ▼
[第 0 层] 安全词短路：精确匹配 "安全词" → intensity=0 + 终止会话
  │（未命中）
  ▼
[第 1 层] 码表子串匹配（Keywords Substring Match）
  - 数据源：附录 A 意图码表的 "关键词池" 列
  - 匹配方式：**子串包含**（中文无需分词），一条文本可命中多个 Intent_Code
  - 多命中策略：取最高 intensity（让 S 的升档意图主导）
  - **歧义词已剔除**：附录 A 的 3 档词池中已去掉"给你""现在""彻底""规矩"等日常高频词，避免 "我现在给你倒水" 之类的误触 3 档
  │（未命中）
  ▼
[第 2 层] LLM 语义识别（OpenRouter → Grok-4-Fast）
  - 调用 OpenRouter API（统一中转），默认模型 `x-ai/grok-4-fast`
  - prompt 内嵌档位语义规则；LLM **直接输出 intensity**（0/1/2/3 或 null=HOLD）
  - 返回 null 表示 LLM 也判别不出，前端不更新档位（保持上次状态）
  │
  ▼
返回 intensity，广播给房间内双方
```

#### 码表（v1 初始内容）
取自原文档 Worksheet2/3，17 条意图编码，覆盖开场、撩拨、指令、警告、惩罚、高潮、奖励、安抚七大类。完整表见附录 A。

#### LLM 调用规范（OpenRouter）
- 模型：`x-ai/grok-4-fast`（默认；可通过 `OPENROUTER_MODEL` 环境变量切换）
- API 端点：`https://openrouter.ai/api/v1/chat/completions`
- 超时：1.5 秒；超时回退 intensity=null（不更新档位）
- `response_format: { type: "json_object" }` 强制 JSON-only 响应
- temperature=0.2，max_tokens=80（识别任务而非生成任务）
- LLM 返回的 `intensity` 为 null 时，视作"无明确信号"，档位保持原值（HOLD 语义）
- **无 API Key 降级**：若 `OPENROUTER_API_KEY` 未配置，第 2 层直接返回 fallback；第 1 层未命中的消息统一返回 `{intensity: 1, source: "no_key"}`。开发期未配 key 时全链路可跑通 demo

#### Prompt 基本结构（伪码）
```
SYSTEM: You classify SM dialog text into vibration intensity (0/1/2/3 or null=hold).
Rules: [档位语义说明 + 边界示例]
USER: [S 的原文]
OUTPUT (JSON only): {"intensity": 0|1|2|3|null, "reason": "短语,≤12 中文字"}
```

#### 历史决策记录
- v1.2 设计为 Gemini Flash + intent_code 中间层；v1.5 改为 OpenRouter（国内可达且统一计费）+ Grok-4-Fast，并简化为直接输出 intensity（去掉 intent_code 层），降低 LLM 推理负担
- v2 阶段曾尝试浏览器 Web Speech API 作为 STT，验证发现国内不可达（Google 服务器被墙）后切换到 SiliconFlow SenseVoice 服务端方案，保留同一条 chat 管线

### 4.5 房间匹配与消息通道

#### Code 生成
- 服务端 API `POST /api/room`：生成 **6 位纯数字**（0-9，例如 `483921`），插入内存 Map，返回 code
- 生成时检测冲突；若命中已存在的房间则重抽，最多重试 10 次
- 也支持由客户端提议 code（直接输入 6 位数字），服务端校验不冲突后占用（黑客松简化：默认服务端生成，客户端输入同一个）

#### WebSocket 协议
- 建连 URL：`ws://host/ws?code=483921&role=s|m&safeWord=...`（S 或 M 任一方均可携带 `safeWord`；服务端按 first-write-wins 决定生效值）
- 服务端校验 code 存在、角色未占用、房间未满 → 接入；否则关连接 + error code
- 消息格式（JSON）：

**客户端 → 服务端**
```json
// 建连后首包（设置房间安全词；也可通过建连 query 参数一次传入）
// 任一角色均可发送；服务端按 first-write-wins 采纳首个非空值
{"type": "set_safe_word", "word": "我的安全词"}
// 发消息
{"type": "chat", "text": "给我跪好"}
// 主动退出
{"type": "leave"}
// 心跳
{"type": "ping"}
```

**服务端 → 客户端**
```json
// 房间就绪（S 收到时携带 safeWord；M 收到时 safeWord 即自己设置的值）
{"type": "room_ready", "selfRole": "s", "peerRole": "m", "safeWord": "我的安全词"}
// 房间等待
{"type": "room_waiting"}
// 消息转发（含意图识别结果）。timestamp 为服务端接收该消息时间（Date.now()，单位毫秒）
// seq_id 单调递增，客户端按 seq_id 单调过滤过时的 intensity 更新
{"type": "chat", "from": "s", "text": "给我跪好", "intensity": 2, "intent_code": "S_COMMAND_POSTURE", "seq_id": 17, "timestamp": 1730000000000}
// 安全词触发
{"type": "safe_word_triggered", "by": "m"}
// 对方退出
{"type": "peer_left"}
// 错误
{"type": "error", "code": "ROOM_FULL|ROLE_TAKEN|INVALID_CODE|INVALID_CODE_FORMAT", "message": "..."}
// 心跳响应
{"type": "pong"}
```

#### 状态管理
- 房间状态机：`WAITING` → `READY` → `ACTIVE` → `CLOSED`
- 内存 Map `rooms: Map<code, Room>`，Room 结构：`{code, safeWord, sWs, mWs, seqCounter, createdAt, lastActivity, disconnectAt?}`
- **安全词生效时序**：S 先到 → 房间 WAITING 状态但 `safeWord` 可能还没设 → 等 M 进入并带来安全词 → 房间进入 READY 并通过 `room_ready` 推送给 S
- 心跳机制：客户端 15 秒 ping 一次，服务端 45 秒无消息认为掉线
- 30 分钟无活动自动回收

#### 断线重连
- 任一端 WS 断开后，服务端对该 role 槽位保留 **30 秒**（记录 `disconnectAt`），期间不发 `peer_left` 给另一端
- 在 30 秒窗口内，同一 `(code, role)` 可重新建连；服务端替换旧 ws 句柄，清空 `disconnectAt`，并向重连方推送当前房间快照（`room_ready` 或 `room_waiting`）
- 重连**不重放**历史聊天（与"不持久化聊天内容"原则一致）；重连后档位从 **0** 重新起步
- M 重连时若带 `safeWord` query 参数，保留原安全词（以服务端已记录值为准，不允许中途改）
- 超过 30 秒仍未重连 → 房间 CLOSED，对端收到 `peer_left`

### 4.6 蓝牙与硬件控制

#### 连接时机（v1.4 严格模式）
- M 端登入成功后进入**蓝牙连接页（BtGate）**，必须**显式点击按钮**触发 `navigator.bluetooth.requestDevice()`；不再在聊天页 mount 时静默弹出
- 未配成则**卡在 BtGate**，可重试；只有成功（绿灯）或显式点击页脚的"演示模式"link 才放行到聊天页
- 演示模式进入聊天页后，档位动画正常，但不写硬件；状态胶囊显示"脱机模式"

#### 中途断连（v1.4）
- 聊天页通过 `gattserverdisconnected` 事件监听硬件断连
- 触发后：
  - 全屏模态覆盖聊天页（z-40），文案"蓝牙已断开"
  - 输入框禁用，不可发消息
  - 提供两个按钮：
    - **重新连接硬件** → 重开 BT 选设备框
    - **退出会话** → 走 `leave` 流程，两端回登入页
- 不会自动 peer_left，避免一次信号抖动就终止会话

#### 协议（v1.5 已与硬件组对齐，跳蛋广播名 `Vibration_Egg`）
| 项 | 值 |
|---|---|
| 设备过滤 | `namePrefix: "Vibration_Egg"` |
| Service UUID | `0000ffe0-0000-1000-8000-00805f9b34fb`（HM-10 兼容标准服务） |
| Characteristic UUID | `0000ffe1-0000-1000-8000-00805f9b34fb` |
| 写入格式 | UTF-8 字符串：`"0"` / `"1"` / `"2"` / `"3"`（注意是 ASCII 字符，不是字节 0x00-0x03） |
| 写入方式 | Write With Response |
| 握手 | 暂无，连上即可用 |
| LED 状态 | 固件根据档位切换不同 LED 颜色，便于 demo 时一眼看到生效 |

#### 降级策略
- Web Bluetooth 不支持（例如 iOS Safari）：前端提示"当前浏览器不支持蓝牙控制，将以动画模式演示"
- 连接失败：显示"硬件未连"提示，但不阻塞聊天与动画

### 4.7 语音通话（v2 已落地）

#### 功能清单
- **聊天页右上角 📞 按钮** → 点击向对方发起来电邀请
- **来电振铃**：被叫方弹出 RingingOverlay 模态（接听 / 拒绝两个按钮，30 秒超时）
- **接通后**：上方插入一条 CallBar 玻璃胶囊（状态点 / mm:ss 时长 / 静音 / 红色挂断）；**chat UI 保持完全可用**，可继续打字、骰子、紧急停止
- **音频通路**：浏览器 P2P WebRTC，使用 Google 公共 STUN，**音频流不经服务器**
- **STT 通路**：本地 MediaRecorder 切 ~2.5s opus 段 → POST `/api/stt` → 后端代理 SiliconFlow SenseVoice → 转写文本作为普通 chat 消息进入意图管线 → 触发档位变化
- **紧急停止按钮**（floating 红色，chat 右上角永久可见）：绕过 STT/LLM，直接命中 safe_word_triggered 路径，确保即使语音管线挂掉也能立刻断开

#### 振铃协议
| 客户端消息 | 服务端中继 | 含义 |
|---|---|---|
| `call_invite` | `peer_call_invite` | 主叫发起 |
| `call_accept` | `peer_call_accept` | 被叫接听，开启 SDP 协商 |
| `call_reject` | `peer_call_reject` | 被叫拒绝 |
| `call_cancel` | `peer_call_cancel` | 主叫超时前撤回 |
| `call_timeout` | `peer_call_timeout` | 30 秒未接听服务端兜底广播 |

接通后用 `rtc_offer` / `rtc_answer` / `rtc_ice` / `rtc_hangup` 走标准 WebRTC 信令，服务端透传不解析。

#### STT 调用规范（SiliconFlow）
- API：`https://api.siliconflow.cn/v1/audio/transcriptions`
- 默认模型：`FunAudioLLM/SenseVoiceSmall`（中文友好，国内可达）
- 输入：webm/opus 二进制段（前端 MediaRecorder 切片）
- 端到端预算：录制 2.5s + 上传 + 推理 + 入意图管线 ≤ 4 秒
- **无 key 降级**：若 `SILICONFLOW_API_KEY` 未配置，后端返回 `{source: "no_key"}`，前端浮窗提示，但通话音频不受影响

#### 降级策略
- WebRTC 跨网失败（无 TURN）：当前仅同 WiFi / 同局域网可通，跨蜂窝网络需后续补 TURN
- 浏览器无 `getUserMedia` 权限：通话按钮置灰，提示授权
- iOS Safari：Web Speech API 之前的方案不支持，已被 SiliconFlow 后端方案替代，iOS 通话现可用

---

## 5. UI / UX 规范（v1.5）

### 5.1 风格（v1.5 落地后）
- **visionOS-style 浅色磨砂**：放弃 v1 设计的暗色底，改用浅色 mesh gradient（淡蓝 #E6F3FF → 奶油 #FFF5E6 → 浅粉 #FFEBEB）+ 模糊光晕（橙/蓝径向 blur 80px）作为统一背景
- **强调色**：橙色 #FF8A3D（accent-500）替代紫红渐变，对应 Vibration_Egg 跳蛋的暖色品牌
- **玻璃材质**：所有卡片/胶囊/banner 使用 `bg-white/40-70 + backdrop-blur-xl + border-white/60-80`，营造"视觉穿透"
- **字体**：系统默认无衬线 stack（`system-ui, -apple-system, Segoe UI, PingFang SC, Microsoft YaHei`）；不再硬编码 hero 字体，避免 Mac/Win 渲染差异
- **圆角**：999px（pill 胶囊，主语言）、24px（气泡/卡片）、16px（feature badge）
- **动画**：Framer Motion，切档位过渡 300ms；档位档动 0=静止 / 1=2s 呼吸 / 2=1s 脉冲 / 3=0.3s 高频

### 5.2 响应式断点
- **Landing 页**：自定义断点 500px——<500px 上下堆叠（hero 上 / CTA 下），≥500px 左右分栏。降低断点是为了 Win Chrome 带浏览器侧边栏（Edge sidebar 等）挤压视口时仍保持分栏
- **其它页**：标准 Tailwind `md:` (768px) 断点；移动端单列，桌面端双列（chat + 右侧档位面板）

### 5.3 页面清单（v1.5）
- **Landing**（新增）：进入前的品牌页，hero "Hi! Synesthesia Lab" + 三个 feature badge（AI 调控 / 玩后即焚 / 安全词）+ START 按钮
- **Login**：S/M 角色 + Create/Join tab + 6 位 code 或安全词输入
- **BtGate**（仅 M）：蓝牙配对必经页
- **Chat**：聊天 + 档位 + 通话入口；通话期内嵌 CallBar，不再全屏覆盖

### 5.4 关键页面线框（文字描述）

**登入页**（S / M 一致：两端都看到安全词字段；按钮文案随 code 状态切换）
```
┌──────────────────────────────────┐
│        AttraX                    │
│                                  │
│  ┌─────────┐  ┌─────────┐        │
│  │  [S]    │  │   M     │        │  <- S/M 单选
│  └─────────┘  └─────────┘        │
│                                  │
│  Code: [             ]  生成     │  <- 留空 = 创建 / 输入 = 加入
│                                  │
│  安全词：[ 安全词          ]     │  <- 两端可填；first-write-wins
│   任一方说出安全词会话立即终止    │
│                                  │
│     [   创建房间   ]              │  <- code 为空时
│     [   加入房间   ]              │  <- code 填了时
└──────────────────────────────────┘
```

**等待态**（进入聊天页但对方未到）
```
┌──────────────────────────┐
│                          │
│  把下面的房间号发给对方   │
│                          │
│      4 8 3 9 2 1         │
│                          │
│  等待对方加入…            │
│  当前安全词：安全词        │
│                          │
└──────────────────────────┘
```

**BT Gate 页**（仅 M 侧，登入成功 → 聊天页之间的必经关口）
```
┌────────────────────────────────┐
│         房间已就绪              │
│                                 │
│       4  8  3  9  2  1          │
│   把 code 发给对方加入房间       │
│   当前安全词：安全词              │
│                                 │
│   ─────────────────             │
│                                 │
│   连接你的硬件跳蛋                │
│   • 开启硬件电源                 │
│   • 广播名需为 Vibration_Egg     │
│   • 点按钮,在浮层里选设备         │
│                                 │
│   [     连接蓝牙设备     ]       │
│                                 │
│         ○ 未连接                │
│                                 │
│   ─────────────────             │
│ ← 返回登入       没有硬件?演示模式 │
└────────────────────────────────┘
```

**BT 中途断连覆盖**（聊天页被全屏盖住）
```
┌─────────────────────────────┐
│        蓝牙已断开             │
│                              │
│  硬件跳蛋的连接丢失。          │
│  聊天已暂停。                 │
│                              │
│  [   重新连接硬件   ]          │
│  [    退出会话    ]            │
└─────────────────────────────┘
```

**聊天页（桌面）**
```
┌───────────────────────────────┬─────────────────┐
│  安全词：安全词  |  退出       │                 │
├───────────────────────────────┤    档位动画      │
│                               │                 │
│  [S] 给我跪好          10:32  │     ～～～      │
│                               │    波纹/光晕     │
│           10:33  我乖乖的 [M] │                 │
│                               │   当前：2 档    │
│  [S] 叫出来            10:34  │                 │
│                               │                 │
│                               │                 │
├───────────────────────────────┴─────────────────┤
│  [           输入消息           ] [ 发送 ]      │
└─────────────────────────────────────────────────┘
```

**聊天页（移动）**
```
┌──────────────────┐
│ 安全词  |  退出  │
├──────────────────┤
│   ～～～ 2 档     │  <- 档位动画压顶
├──────────────────┤
│                  │
│  [S] 给我跪好    │
│                  │
│     我乖乖的 [M] │
│                  │
├──────────────────┤
│ [输入..] [发送]  │
└──────────────────┘
```

---

## 6. 技术方案

### 6.1 系统架构
```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  S 浏览器   │◄───WS──►│              │◄───WS──►│  M 浏览器   │
│  (Web App)  │         │   Backend    │         │  (Web App)  │
└─────────────┘         │  (Node+TS)   │         └──────┬──────┘
                        │              │                │
                        │  意图管道:    │                │ Web Bluetooth
                        │  码表 +      │                ▼
                        │  Grok-4-Fast │         ┌──────────────┐
                        │  STT proxy   │         │ Vibration_Egg │
                        └──────┬───────┘         │  (ESP32-S3)   │
                               │                  └──────────────┘
                               ▼
                ┌──────────────────────┐
                │  OpenRouter (LLM)    │
                │  SiliconFlow (STT)   │
                └──────────────────────┘

通话音频走 WebRTC P2P，不经服务器；STT 录制切片走后端代理。
```

### 6.2 技术选型（v1.5 实际使用）
| 层 | 选型 | 说明 |
|---|---|---|
| 前端框架 | Vite + React 18 + TypeScript | 快速热更新，类型安全 |
| 前端样式 | TailwindCSS 3.4 + 原生 CSS（mesh-bg / 玻璃材质） | 响应式快写 |
| 前端动画 | Framer Motion + CSS keyframes | 档位呼吸 / 通话振铃 / 骰子 |
| 前端状态 | zustand | 轻量全局状态（page / role / callState 等） |
| 前端图标 | lucide-react | Mic/Phone/Shield 等 |
| 前端蓝牙 | Web Bluetooth API（浏览器原生） | Vibration_Egg 协议 |
| 前端 WebRTC | simple-peer + vite-plugin-node-polyfills | 复用 WS 信令通道 |
| 前端 STT 录制 | MediaRecorder + opus codec | 切 ~2.5s 段上传 |
| 后端运行时 | Node.js 20 + TypeScript（tsx 跑 dev） | 与前端同语言 |
| 后端 Web 框架 | Express | 托管静态 + REST + STT proxy |
| 后端 WS 库 | `ws` | 原生 WebSocket |
| LLM | OpenRouter → `x-ai/grok-4-fast` | 语义识别（替代 v1 的 Gemini） |
| STT | SiliconFlow → `FunAudioLLM/SenseVoiceSmall` | 通话语音识别（替代 v2 初版的 Web Speech API，国内可达） |
| 存储 | 进程内存 Map | 黑客松不上 DB |
| 工程结构 | npm workspaces monorepo | `frontend` / `backend` / `shared` 三 package；`shared` 包名 `@attrax/shared` |
| 部署 | 本地 Node 进程 + Cloudflare Tunnel（trycloudflare.com） | 现场展示；Cloudflare 自动签 HTTPS/WSS 满足 Web Bluetooth 与 getUserMedia 的安全上下文要求 |

### 6.3 项目目录结构（v1.5 实际）
```
AttraX-hackathon/
├── PRD.md                      <- 本文档
├── package.json                <- 根 workspaces: { "workspaces": ["frontend", "backend", "shared"] }
├── frontend/                   <- npm workspace, name: @attrax/frontend
│   ├── package.json            <- simple-peer + lucide-react + zustand + framer-motion
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.tsx     <- 品牌入口页（v1.5 新增）
│   │   │   ├── Login.tsx       <- Create/Join + S/M + 安全词
│   │   │   ├── BtGate.tsx      <- M 配对蓝牙跳蛋必经页
│   │   │   └── Chat.tsx        <- 聊天 + 档位 + 通话入口 + CallBar/RingingOverlay
│   │   ├── components/
│   │   │   ├── SynthHero.tsx   <- "Hi! Synesthesia Lab" 大字 hero
│   │   │   ├── IntensityViz.tsx
│   │   │   ├── ChatBubble.tsx
│   │   │   └── BluetoothStatus.tsx
│   │   ├── lib/
│   │   │   ├── ws.ts           <- WebSocket 客户端 + seq_id 过滤
│   │   │   ├── bluetooth.ts    <- Web Bluetooth 封装（Vibration_Egg）
│   │   │   ├── webrtc.ts       <- simple-peer wrapper + WS 信令
│   │   │   └── chunked-stt.ts  <- MediaRecorder 切片 + POST /api/stt
│   │   ├── store.ts            <- zustand global store（含 callState）
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html              <- 含 simple-peer global 兼容 shim
│   ├── tailwind.config.js
│   └── vite.config.ts          <- nodePolyfills + define global=globalThis
├── backend/                    <- npm workspace, name: @attrax/backend
│   ├── package.json
│   ├── src/
│   │   ├── server.ts           <- Express + WS + /api/stt + 静态托管
│   │   ├── rooms.ts            <- 房间匹配 + 断线重连 + seq_id + 11 路 voice 信令中继
│   │   ├── safe-word.ts        <- 归一化 + 相等匹配 + 单元测试覆盖
│   │   ├── stt/
│   │   │   └── siliconflow.ts  <- SiliconFlow ASR 代理（含无 key 降级）
│   │   └── intent/
│   │       ├── pipeline.ts     <- 0 层安全词 / 1 层码表 / 2 层 LLM
│   │       ├── keyword-table.ts <- 17 行码表（附录 A）
│   │       ├── keywords.ts     <- 子串匹配
│   │       ├── llm.ts          <- OpenRouter Grok 调用（含无 key 降级）
│   │       └── repl.ts         <- 离线 CLI，调试管线用
│   ├── .env.example            <- OPENROUTER_API_KEY + SILICONFLOW_API_KEY 模板
│   └── tsconfig.json
└── shared/                     <- npm workspace, name: @attrax/shared
    ├── package.json
    ├── src/
    │   └── protocol.ts         <- WS 消息类型（含 v2 voice 信令）
    └── tsconfig.json
```

---

## 7. 非功能需求

### 7.1 性能
- **消息端到端延迟 ≤ 800ms**（S 按下发送 → M 看到消息 + 档位变化）
  - 其中码表层 < 5ms；OpenRouter Grok-4-Fast 层 < 1500ms（超时回退）
- **蓝牙写延迟 ≤ 100ms**（M 端收到 intensity → 马达启动）
- **STT 端到端 ≤ 4s**（说话开始 → 档位变化）：录制 2.5s + SiliconFlow ASR ≤ 1s + LLM ≤ 1.5s
- **WebRTC RTT**：同 WiFi < 100ms；跨网络无 TURN 暂不支持
- **WebSocket 心跳**：15s ping，45s 判断断线

### 7.2 可用性
- 浏览器兼容：Chrome 108+ / Edge 108+（Web Bluetooth 要求）
- iOS Safari 不支持 Web Bluetooth，此时前端自动进入"仅动画"模式
- 桌面 + 移动 响应式兼容

### 7.3 安全与隐私（黑客松范围内）
- 不持久化任何聊天内容（进程内存中短期缓存，断连即清）
- 不存储用户标识（无账号系统）
- HTTPS/WSS 部署（现场 demo 用 Cloudflare Tunnel 自动证书）
- 通话音频走 WebRTC P2P，**不经服务器**；只有 STT 录音切片会临时上传到 SiliconFlow（无持久存储）
- OpenRouter / SiliconFlow API key 仅在后端 .env，不暴露给前端

### 7.4 可演示性（黑客松专项）
- **脱机模式**：无蓝牙硬件时仍能演示全流程（档位动画替代）
- **快速复位**：现场可通过浏览器刷新重新匹配
- **两端同机演示**：允许同一台电脑开两个浏览器标签扮 S 和 M

---

## 8. 边界情况与异常处理

| 场景 | 处理 |
|---|---|
| 两人选同角色 | 后进者收到 `ROLE_TAKEN` 错误，提示切换 |
| Code 不存在 | `INVALID_CODE` 错误 |
| Code 格式不合法（非 6 位数字） | 前端拦截 + 服务端二次校验返回 `INVALID_CODE_FORMAT` |
| 房间已满 | `ROOM_FULL` 错误 |
| S 先于 M 进入 | 房间 WAITING 态，S 可见"等待 M 加入并设置安全词" |
| M 未设安全词（留空） | 服务端写入默认值 "安全词" |
| M 安全词过长（> 16 字符） | 前端拦截，提示上限 |
| 对方中途掉线 | 本方收到 `peer_left`，暂停发送但保持页面，30 秒内对方重连恢复 |
| LLM (Grok) 超时或失败 | 回退 intensity=null（保持原档），日志记录 |
| SiliconFlow STT 无 key 或失败 | 通话音频不受影响；前端浮窗提示后端缺 key；不阻断通话 |
| 通话邀请 30 秒未接 | 服务端广播 `peer_call_timeout`，主叫与被叫均回到 idle |
| 跨蜂窝网络通话失败 | 当前无 TURN，提示"请切换到同一 WiFi" |
| 蓝牙中途断连 | M 端提示"硬件已断开"，UI 继续聊天 |
| 浏览器刷新 | 视为 `leave`，不保留状态 |
| 文本为空或过长 | 前端拦截（最长 200 字符） |

---

## 9. 验收标准（v1 Demo）

### 9.1 必须项（现场 demo 前必须通过）
- [ ] S/M 能在同一个 6 位数字 code 下成功匹配进入聊天
- [ ] M 端能自定义安全词；未填写时默认为 "安全词"
- [ ] S 进入聊天页后能看到 M 设定的安全词
- [ ] S 发"给我跪好" → M 端档位到 2 档，动画正确播放
- [ ] S 发"给我丢" → M 端档位到 3 档
- [ ] S 发"抱抱" → M 端档位到 1 档
- [ ] 任一方发送 = M 设定的安全词 → 双方立即断开、马达停、跳回登入页（< 1 秒）
- [ ] 手机浏览器打开响应式布局正确
- [ ] 脱机模式下动画演示顺畅

### 9.2 加分项
- [x] 真实蓝牙跳蛋连接成功，震动强度切换流畅（v1.5 已交付）
- [x] 命中码表的消息延迟 < 100ms
- [x] LLM 回退路径延迟 < 1.5s（Grok-4-Fast）
- [x] UI 有完成度较高的设计（visionOS-style mesh + glass）
- [x] **WebRTC 语音通话 + STT 实时驱动档位**（v2 提前落地）
- [ ] 跨蜂窝网络通话（需 TURN，暂未配）

---

## 10. 依赖与未决事项

| 项 | 状态 | 负责人 | 备注 |
|---|---|---|---|
| OpenRouter API Key | ✅ 已配置 | Vicky | 在 `backend/.env`；模型默认 grok-4-fast，可通过 `OPENROUTER_MODEL` 切 |
| SiliconFlow API Key | ⚠️ 待配置 | Vicky | 不配置则通话能听到但语音不触发档位；在 `backend/.env` 加 `SILICONFLOW_API_KEY=` 即生效 |
| 蓝牙协议（Service/Char UUID） | ✅ 已确认 | 硬件组 | HM-10 兼容服务 ffe0/ffe1，UTF-8 字符串 "0/1/2/3" |
| 硬件固件 | ✅ 已交付 | 硬件组 | Vibration_Egg 跳蛋已可用，LED 反馈档位 |
| TURN 服务器 | ⚠️ 未配置 | - | 仅同 WiFi/局域网通话；跨蜂窝网络暂不支持，可后续接 coturn |
| UI 设计稿 | ✅ visionOS-style mesh + glass | Claude/Vicky | 已落地，参考 §5.1；后续若有稿再调整 |
| OpenClaw 扩展码表 | v1 使用附录 A 17 条完整码表 | Vicky | 已去重 + 剔除歧义词；OpenClaw 后续可在此基础上扩展 |

---

## 11. Roadmap

### v2 多模态升级 — ✅ 已落地（v1.5）
- ✅ 聊天页 📞 按钮 → WebRTC 通话（simple-peer）
- ✅ MediaRecorder 切片 + 后端 SiliconFlow SenseVoice STT（替代不可用的 Web Speech API）
- ✅ STT 文本进入同一条意图管线，实时更新档位
- ✅ 来电振铃协议 + 接通后 inline CallBar
- ✅ 紧急停止按钮（floating red）

### v2.x 后续优化（黑客松后）
- TURN 服务器（跨蜂窝网络通话）
- 安全词浏览器端语音监听（M 端常驻 mic 识别"安全词"，不依赖 STT 上传）
- 通话录音上传与回放（合规前提下）

### v3 深度增强
- 聊天页支持发送照片 / 短视频，M 端查看后 3 秒销毁（"玩后即焚"已写入 Landing slogan，功能待补）
- 多设备支持（一个 M 同时连多个跳蛋，分部位控制）
- 房间持久化与重入（目前内存 Map，重启即清）

---

## 附录 A：意图码表（v1.2 完整版，17 条）

| Intent_Code | 阶段描述 | 档位 | 关键词池 |
|---|---|---|---|
| SYS_SAFE_WORD | 安全词 / 紧急停止 | 0 | （由 M 在登入页配置；默认 "安全词"；不进入子串匹配管道，走第 0 层全字符串相等） |
| S_WARM_UP | 前戏安抚 | 1 | 乖、想我吗、放松、好孩子、舒服点、慢慢来、宝贝、我的乖 |
| S_GREET_WARM | 开场温和 | 1 | 在干嘛、准备好 |
| S_GREET_DOM | 开场宣示 | 2 | 主人、跪下、问好、连上 |
| S_TEASE_LIGHT | 轻度撩拨 | 1 | 痒、轻轻、慢点、感受、舒服吗、有点感觉、轻一点、骚动 |
| S_TEASE_HEAVY | 重度挑逗 | 2 | 想要、求我、叫主人、自己动、憋着、忍着、湿了、难受、痒死、夹紧 |
| S_COMMAND_DAILY | 日常指令 | 2 | 听话、含住、坐好、脱掉、转过去 |
| S_COMMAND_POSTURE | 姿态指令 | 2 | 跪好、腿分开、看着我、不许动、趴下 |
| S_COMMAND_VERBAL | 言语指令 | 2 | 叫出来、说你想要、闭嘴、大声点、回答 |
| S_DENIAL_CONTROL | 边缘控制 | 1 | 不准丢、忍住、咽回去、收回去 |
| S_WARNING | 警告敲打 | 2 | 胆子大了、皮痒、再动一下、规矩、态度、忘了、试试看、不乖 |
| S_PUNISH_LIGHT | 轻度惩戒 | 2 | 挨打、掌嘴、认错、罚你、长记性 |
| S_PUNISH_STRICT | 严厉惩罚 | 3 | 惩罚、教训、废物、狠狠、弄坏 |
| S_CLIMAX_PERMISSION | 高潮恩赐 | 3 | 丢吧、释放、赏你、高潮 |
| S_CLIMAX_FORCED | 强制高潮 | 3 | 给我丢、坏掉、喷出来 |
| S_REWARD_HIGH | 重度奖励 | 3 | 表现真棒、全给你、太乖了、奖励、极品 |
| S_AFTERCARE | 事后安抚 | 1 | 抱抱、摸摸、辛苦了、睡觉、亲亲 |

**多条命中策略**：若一条消息同时命中多个 Intent_Code，取最高 intensity。

**v1.2 对码表的处理**
1. **去重**：多个 Intent_Code 共用的关键词，按"更具体 / 更高档位优先"原则归并：
   - "跪好 / 看着我 / 不许动" → 仅保留在 `S_COMMAND_POSTURE`（更具体）
   - "乖 / 想我吗 / 宝贝" → 仅保留在 `S_WARM_UP`
   - "抱抱 / 摸摸 / 辛苦了 / 睡觉 / 亲亲" → 仅保留在 `S_AFTERCARE`
   - "规矩" → 仅保留在 `S_WARNING`
   - "试试看" → 仅保留在 `S_WARNING`（2 档覆盖 1 档）
   - "憋着" → 仅保留在 `S_TEASE_HEAVY`（2 档覆盖 1 档）
2. **剔除高危歧义词**（避免日常用语误触 3 档）：
   - `S_CLIMAX_PERMISSION` 删除 "给你"（"我给你倒水" 会误触）
   - `S_CLIMAX_FORCED` 删除 "现在" "彻底"
   - `S_COMMAND_DAILY` 删除 "现在就做"
3. **匹配方式**：子串包含（中文无需分词）。关键词以半角逗号/顿号分隔展开，每个词作为独立模式

---

## 附录 B：WebSocket 消息 Schema 速查

### 客户端 → 服务端（v1.5）
```ts
type ClientMsg =
  | { type: "set_safe_word"; word: string }
  | { type: "chat"; text: string }
  | { type: "leave" }
  | { type: "ping" }
  | { type: "roll_start"; outcomeIdx: number }       // 骰子动画起始（v1.4）
  | { type: "emergency_stop" }                        // 紧急停止按钮
  // 通话振铃 (v2)
  | { type: "call_invite" }
  | { type: "call_accept" }
  | { type: "call_reject" }
  | { type: "call_cancel" }
  | { type: "call_timeout" }
  // WebRTC 信令 (v2)，服务端透传不解析
  | { type: "rtc_offer"; sdp: string }
  | { type: "rtc_answer"; sdp: string }
  | { type: "rtc_ice"; candidate: RelayIceCandidate }
  | { type: "rtc_hangup" };
```

### 服务端 → 客户端（v1.5）
```ts
type ServerMsg =
  | { type: "room_ready"; selfRole: "s" | "m"; peerRole: "s" | "m"; safeWord: string }
  | { type: "room_waiting" }
  | { type: "chat"; from: "s" | "m"; text: string; intensity: 0 | 1 | 2 | 3; intent_code: string; seq_id: number; timestamp: number }
  | { type: "safe_word_triggered"; by: "s" | "m" }
  | { type: "peer_left" }
  | { type: "peer_disconnecting"; expiresAt: number }   // 30s 优雅期开始
  | { type: "peer_reconnected" }
  | { type: "peer_roll_start"; outcomeIdx: number }
  | { type: "error"; code: "ROOM_FULL" | "ROLE_TAKEN" | "INVALID_CODE" | "INVALID_CODE_FORMAT"; message: string }
  | { type: "pong" }
  // 通话振铃中继
  | { type: "peer_call_invite" }
  | { type: "peer_call_accept" }
  | { type: "peer_call_reject" }
  | { type: "peer_call_cancel" }
  | { type: "peer_call_timeout" }
  // WebRTC 信令中继
  | { type: "peer_rtc_offer"; sdp: string }
  | { type: "peer_rtc_answer"; sdp: string }
  | { type: "peer_rtc_ice"; candidate: RelayIceCandidate }
  | { type: "peer_rtc_hangup" };
```

---

## 附录 C：硬件 BOM（参考原文档）

| 元器件 | 型号 | 数量 | 单价 |
|---|---|---:|---:|
| 4 节电池盒 | - | 1 | 5.67 |
| 5 号电池 | - | 4 | 10 |
| 锂电池 | 3.7V 55mA | 1 | - |
| ESP32-S3 | SuperMini | 1 | 20.66 |
| 震动电机 | CZ193 | 1 | 3.71 |
| DC-DC 稳压器 | AMS1117-3.3V | 1 | 2.53 |
| 5V 充放电模块 | DC 5V 1A | 1 | - |
| 杜邦线 | 公对公、母对母 | 若干 | 8.26 |
| LED 指示灯 / 电阻 / 洞洞板 | - | 若干 | - |

---

**文档版本记录**
- 2026-04-25 v1.5（语音通话落地 + LLM/STT 切换 + UI 重做）：
  - **意图管线 LLM 层**：从 Gemini 切换到 OpenRouter（Grok-4-Fast）；LLM 直接输出 intensity，去掉中间 intent_code 层
  - **语音通话**（v2 Roadmap 提前落地）：WebRTC + simple-peer，复用 WS 信令，新增 5 路振铃协议（call_invite/accept/reject/cancel/timeout）+ 4 路 RTC 信令中继
  - **STT**：原 v2 计划的 Web Speech API 在国内不可达，切换到 SiliconFlow SenseVoice 服务端方案；前端 MediaRecorder 切 ~2.5s opus 段，POST `/api/stt` 由后端代理；转录文本进入同一条 chat 管线
  - **通话 UI**：放弃全屏 InCallOverlay + 圆形 VoiceDial，改为 inline CallBar 玻璃胶囊，通话期间 chat 完全可用
  - **紧急停止按钮**：floating red，绕过 STT/LLM 直接触发安全词路径
  - **蓝牙协议**：硬件组交付 Vibration_Egg 跳蛋，HM-10 兼容服务（ffe0/ffe1），UTF-8 字符串 "0/1/2/3"，Write With Response
  - **UI 全面重做**：visionOS-style 浅色 mesh + 玻璃材质替代原暗色紫红渐变；橙色 #FF8A3D 替代紫红做品牌色；统一使用 system-ui 字体栈避免 Mac/Win 渲染差异
  - **新增 Landing 页**：进入 Login 之前的品牌入口，自定义断点 500px 应对 Win Chrome 侧边栏挤压
  - **聊天页增强**：骰子滚动动画（共享给 peer）、M 端一键安全词按钮、peer offline 优雅期 banner、Create/Join 双 tab 入口
  - **断线优雅期**：服务端 30s 窗口期间不立即广播 peer_left，新增 `peer_disconnecting` / `peer_reconnected` 事件
  - **部署**：Cloudflare Tunnel 替代 ngrok（国内访问更稳）
- 2026-04-24 v1.0：初版，基于春潮黑客松需求文档与与 Vicky 的需求对齐确认
- 2026-04-24 v1.1：
  - 房间 code 改为 **6 位纯数字**（原先为字母+数字）
  - 安全词从 v3 提前到 **v1** 即支持自定义
  - 明确安全词由 **M 端登入时输入**，S 端登入页不显示该字段；S 仅在匹配成功进入聊天页后看到 M 设定的安全词
- 2026-04-24 v1.4（BT 配对流程强化）：
  - M 登入与聊天之间新增**蓝牙连接页（BtGate）**；必须成功配对或显式切演示模式才能进入聊天页
  - 聊天页 mount 时**不再静默触发** BT 选设备框
  - 新增**中途断连保护**：`gattserverdisconnected` 触发全屏覆盖，聊天暂停，提供重连 / 退出两个选项
  - `bluetooth.ts` 的 `connect()` 在失败或用户取消时返回 `"error"`（不再是 `"offline"`）；`"offline"` 现仅表示显式演示模式
  - M 侧 WS **延后**到 BT 连接成功后才建连，避免 S 看到"假 ready"
  - store 增 `demoMode` 字段、`page` 枚举增 `"bt_gate"`
- 2026-04-24 v1.3（首页流程）：
  - 任一角色均可创建房间：登入页不再区分创建 / 加入，留空 code = 创建（服务端自动生成），填 code = 加入
  - 安全词字段对 **S 和 M 都显示**；服务端按 first-write-wins 采纳首个非空值，若双方都没填则双方就位时写入默认 "安全词"
  - 聊天页等待态显示大字体房间号和当前安全词，方便创建方分享给对方
  - 主按钮文案随 code 状态切换："创建房间" / "加入房间"
- 2026-04-24 v1.2（开发前对齐）：
  - 明确**档位持续策略**：intensity 持续至下一条 S 消息，不自动衰减
  - 新增 `seq_id` 机制：服务端给每条 chat 消息打单调递增序号，客户端只应用 seq_id 更新的 intensity，解决 Gemini 异步回包引发的档位乱序覆盖
  - 安全词**匹配归一化**补充"去首尾标点"步骤（"安全词！" 可命中）
  - 新增**断线重连协议**：30 秒窗口内同 (code, role) 可复用
  - **timestamp 单位**统一为毫秒（`Date.now()`）
  - 定义**无 Gemini API Key 的降级路径**（跳过第 2 层 → intensity=1），开发期无 key 也能跑
  - 工程结构定为 **npm workspaces monorepo**，`shared` 以包名 `@attrax/shared` 供前后端 import
  - 附录 A 码表：保留 17 条完整意图；**去重**共享关键词、**剔除高危歧义词** "给你" "现在" "彻底" "规矩" "现在就做"
  - 未决事项表更新：蓝牙 UUID / 硬件固件标记为阻塞等待硬件组；Gemini key 有降级路径不阻塞开发
  - 更新：登入页线框图（拆为 S/M 两版）、WS 协议（新增 `set_safe_word` 客户端消息；`room_ready` 增加 `safeWord` 字段）、异常处理、验收标准
