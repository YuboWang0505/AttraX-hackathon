# AttraX UI 设计系统 v1

基于 `参考UI/` 六张设计稿提取的**通用**设计规范。不绑定具体页面内容，任何新屏幕都应从本文档中取色、取字号、取圆角，以保持风格一致。

---

## 1. 设计关键词

**静默克制 + 感官渐变**。黑白灰为骨，暖橘为锚点，水彩渐变承载情绪。禁止霓虹色、禁止多色按钮、禁止硬阴影。

三条基调：

1. **Monochrome shell**：骨架永远是黑或白，不参与情绪表达
2. **One accent**：整套系统只有一个强调色（橘），只给"正向前进动作"
3. **Ambient color**：情绪/状态用背景水彩云雾传达，不用前景控件颜色传达

---

## 2. 色彩系统

### 2.1 基础色（Neutrals）

| Token | Hex | 用途 |
|---|---|---|
| `ink.900` | `#0A0A0A` | 深色页面背景、主按钮底色、强文字 |
| `ink.800` | `#1C1C1E` | 深色模态/卡片（iOS 风深灰） |
| `ink.700` | `#3A3A3C` | 次级面板、选中态反色片 |
| `ink.500` | `#8E8E93` | 次级文字、占位符、分隔线文字 |
| `ink.300` | `#D1D1D6` | 浅色分隔线、禁用态 |
| `ink.100` | `#F2F2F7` | 浅色页面底纹 |
| `paper` | `#FFFFFF` | 浅色页面背景、气泡、输入框片 |

### 2.2 强调色（Single Accent）

| Token | Hex | 用途 |
|---|---|---|
| `accent.500` | `#F07A3A` | 主 CTA、"前进/确认"按钮、激活强调 |
| `accent.600` | `#D65F21` | pressed / hover 暗态 |
| `accent.300` | `#F5A98C` | 水彩渐变暖端、图标轻量填充 |

> **规则**：一个屏幕最多一个橘色元素处于"激活"状态。出现第二个橘色块，视觉就混乱。

### 2.3 语义色（Semantic）

| Token | Hex | 用途 |
|---|---|---|
| `ok` | `#22C55E` | 连接成功、已就绪 |
| `warn` | `#F59E0B` | 连接中、弱警告 |
| `danger` | `#EF4444` | 终止、错误、安全词触发 |

语义色**仅用于状态指示点 / 细线**，不做按钮主色。

### 2.4 水彩渐变（Ambient Gradients）

情绪状态用背景渐变传达，覆盖全屏或大面积，模糊值 60–120px。

| 渐变名 | 组成色 | 情绪 |
|---|---|---|
| `grad.cool` | `#E5ECF5` → `#C6D3ED` → `#A9BEE1` | 安静、等待、冷静 |
| `grad.warm` | `#FBE5D6` → `#F5B089` → `#F07A3A` | 升温、亲密、主动 |
| `grad.fever` | `#F5A98C` → `#F07A3A` → `#C73E6E` | 高能、强度档位 3 |
| `grad.neutral` | `#EDEDEF` → `#D9D9DE` → `#BDBDC4` | 中性、无状态 |
| `grad.synesthesia` | `#E0D6F0` + `#F5A98C` + `#F07A3A` | 品牌闪屏 |

> 实现提示：三个径向渐变 (`radial-gradient`) 叠加 + `filter: blur(60px)`，而不是单个线性渐变。

---

## 3. 双模主题策略

参考稿清晰地划分了两套明暗用法：

| 场景 | 模式 | 背景 | 文字 | CTA |
|---|---|---|---|---|
| 登录 / 配对 / 鉴权 / 空状态 | **Dark** | `ink.900` | `paper` | `accent.500` pill |
| 聊天主界面 / 任何"内容消费"界面 | **Light + Ambient** | `grad.*` | `ink.900` | 黑底白字 pill |
| 模态弹层 / 底部 sheet | **Light Card** | `paper` on 虚化背景 | `ink.900` | `accent.500` |

**切换规则**：进入"产品核心体验"（聊天）时切到浅色 + 水彩；退回"功能性操作"（设置房间、连接蓝牙、登录）时切到深色。用户据此形成"黑色=我在配置，浅色=我在体验"的肌肉记忆。

---

## 4. 字体与文字层级

### 4.1 字体栈

```css
font-family: -apple-system, "SF Pro Display", "PingFang SC",
             "Microsoft YaHei", system-ui, sans-serif;
```

中文必带 PingFang SC / 微软雅黑 回退。不引入自定义字体（性能 + 版权）。

### 4.2 字号/字重阶梯

| Token | Size / Weight | 用途 |
|---|---|---|
| `display` | 40 / 800 / tight | 品牌闪屏（"Synesthesia Lab"） |
| `title` | 28 / 700 / 0 tracking | 页面主标题（"YOUR CODE"） |
| `h2` | 20 / 600 | 模态标题（"安全词设置"） |
| `body` | 16 / 400 | 聊天正文、表单值 |
| `label` | 13 / 500 | 表单标签、按钮文字 |
| `caption` | 12 / 400 | 辅助说明、时间戳 |
| `tiny` | 11 / 500 / 0.08em tracking | 状态徽章文字 |

### 4.3 英文大写惯例

所有英文页面标题 **全大写 + letter-spacing 0.02–0.06em**（"YOUR CODE"、"BLUETOOTH"、"START"）。中文不做大写处理。

---

## 5. 圆角系统

圆角强烈参与视觉识别，统一用以下 5 档：

| Token | Value | 用途 |
|---|---|---|
| `radius.tile` | `16px` | 数字位 / 分区卡 / 小控件 |
| `radius.card` | `20px` | 模态卡、列表容器 |
| `radius.bubble` | `24px` | 聊天气泡 |
| `radius.sheet` | `28px` | 底部 sheet 外轮廓 |
| `radius.pill` | `9999px` | 按钮、输入栏、徽章、档位切换 |

**禁止**：直角、4–8px 的小圆角（会打破整体调性）。

### 5.1 气泡尾巴

聊天气泡必须带尾巴（iMessage 风），三角小疙瘩贴着下底同色填充。自己发出 → 右下尾，对方 → 左下尾。

---

## 6. 形状语言（Shape Language）

三种基本形态，其它一律不用：

1. **Pill**（`radius.pill`）— 所有会"发生动作"的长条：按钮、输入、Tab
2. **Tile**（`radius.tile` 或 `radius.card`）— 所有承载数据的静态块：数字位、卡片、列表项
3. **Bubble**（`radius.bubble` + 尾巴）— 仅聊天消息

**圆形（Circle）** 仅保留给副按钮/图标按钮（X 关闭、电话、蓝牙）。直径 44–52px，背景 `ink.900` 或 `accent.500`。

---

## 7. 核心组件规格

### 7.1 主按钮（Primary Pill）

```
高度: 48–52px
圆角: pill
底色: accent.500（"前进"）/ ink.900（"默认动作"）
文字: 16px / 600 / white
图标: 24px 箭头，右置，与文字间距 8px
间距: horizontal padding 24–32px
激活态: 背景压 6% 到 accent.600
禁用: opacity 0.4
```

### 7.2 圆形副按钮（Circle Button）

```
直径: 48px
底色: accent.500 / ink.900 / paper
图标: 20px 白色或黑色 stroke
间距: 与主按钮间距 12px
```

### 7.3 输入栏（Input Pill）

```
高度: 48px
圆角: pill
浅色下: paper 填充 + 1px ink.300 边
深色下: ink.800 填充 + 1px ink.700 边
占位符: ink.500
聚焦: 边变 accent.500 2px
前置图标: 24px，左 padding 20px
```

### 7.4 数字位（Digit Tile）— 用于 code 输入展示

```
尺寸: 56 × 72px
圆角: radius.tile
底色: paper（深色模式下）/ ink.900（浅色模式下，反色）
数字: 28px / 700 / 居中
间距: tile 之间 8–12px
```

### 7.5 切换胶囊（Segmented Pill）— S/M 角色

```
外形: pill，底色 ink.700
两格: 宽 56px，高 32px
激活格: 背景 paper，文字 ink.900
未激活格: 文字 ink.500
动画: spring 切换 200ms
```

### 7.6 聊天气泡（Message Bubble）

```
最大宽度: 78% 容器
圆角: radius.bubble
自己: bg paper（浅色模式下也是 paper），文字 ink.900
对方: bg paper，文字 ink.900（同色，仅尾巴方向区分）
阴影: 0 1px 2px rgba(0,0,0,0.04) — 极弱，别抢画面
padding: 14 × 18px
尾巴: 12–14px 同色小三角，贴左下或右下
```

> ⚠️ 参考稿的气泡**两侧都用白色**，不用颜色区分你我。这是有意的：让水彩背景承担情感，气泡保持干净。如果觉得分不清，用尾巴方向 + 对齐方向（自己靠右、对方靠左）就够了。

### 7.7 模态卡（Modal Card）

```
圆角: radius.card
底色: paper
宽度: 82% 屏宽，max 360px
内边距: 24–28px
外层遮罩: rgba(0,0,0,0.08) + backdrop-blur 8px（让背景水彩透出）
入场: 缩放 0.92 → 1.0，opacity 0 → 1，200ms ease-out
```

### 7.8 底部列表（Bottom Sheet List）

```
容器: radius.sheet，底色 ink.700（深色模式）
每项: 高 56px，hairline 分隔线 ink.700/60
图标: 左 24px，stroke 2px white
文字: 16 / 400 / white
```

---

## 8. 间距与网格

8 点栅格。允许 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48。

| 场景 | 间距 |
|---|---|
| 同组控件 | 8 |
| 跨组 | 16 |
| 卡片内 padding | 24 |
| 页面左右 padding | 20（手机） / 32（桌面） |
| 顶部安全区 + 标题 | 32 |
| CTA 距底部 | 40 + safe-area |

---

## 9. 动效（Motion）

| 事件 | 持续 | 曲线 |
|---|---|---|
| 按钮 press | 100ms | ease-out |
| 页面切换 | 280ms | cubic-bezier(0.2, 0.8, 0.2, 1) |
| 模态进场 | 200ms | ease-out（spring 感） |
| 气泡出现 | 220ms | spring(stiffness=400, damping=28) |
| 水彩背景变换（跟随状态） | 800ms | ease-in-out |
| 加载/连接 pulse | 1400ms | ease-in-out, infinite |

**绝不**：飞入、翻转、抖动、3D 旋转、自动循环的夸张动画。动效只用于"状态切换的视觉注解"。

---

## 10. 图标

- stroke 2px，圆角端点，grid 24
- 线性图标：Lucide / Phosphor line 风
- 不用面性、不用多色
- 颜色只取 `ink.900` / `paper` / `accent.500`

---

## 11. 无障碍与移动端

- 所有可点元素 **touch target ≥ 44×44px**
- 文字对比度 ≥ 4.5:1（正文），≥ 3:1（大字/图标）
- iOS safe-area：顶部 `env(safe-area-inset-top)`、底部 `env(safe-area-inset-bottom)`
- 视口单位用 `100dvh`，不用 `100vh`（iOS 键盘遮挡）
- `input` 字号 ≥ 16px（防 iOS focus 时 zoom）
- 水彩渐变页面保证关键文字压在低饱和区（或加 2% 暗化蒙版）

---

## 12. Tailwind 落地 Tokens

```js
// tailwind.config.js
colors: {
  ink: {
    900: "#0A0A0A", 800: "#1C1C1E", 700: "#3A3A3C",
    500: "#8E8E93", 300: "#D1D1D6", 100: "#F2F2F7",
  },
  paper: "#FFFFFF",
  accent: { 300: "#F5A98C", 500: "#F07A3A", 600: "#D65F21" },
  ok: "#22C55E", warn: "#F59E0B", danger: "#EF4444",
},
borderRadius: {
  tile: "16px", card: "20px", bubble: "24px",
  sheet: "28px", pill: "9999px",
},
backgroundImage: {
  "grad-cool":
    "radial-gradient(120% 80% at 20% 10%, #E5ECF5 0%, transparent 60%)," +
    "radial-gradient(100% 70% at 80% 30%, #C6D3ED 0%, transparent 60%)," +
    "radial-gradient(120% 80% at 50% 90%, #A9BEE1 0%, transparent 70%)",
  "grad-warm":
    "radial-gradient(120% 80% at 30% 20%, #FBE5D6 0%, transparent 60%)," +
    "radial-gradient(100% 70% at 75% 50%, #F5B089 0%, transparent 60%)," +
    "radial-gradient(130% 90% at 50% 100%, #F07A3A 0%, transparent 70%)",
  "grad-fever":
    "radial-gradient(100% 70% at 30% 20%, #F5A98C 0%, transparent 60%)," +
    "radial-gradient(110% 80% at 70% 60%, #F07A3A 0%, transparent 60%)," +
    "radial-gradient(130% 90% at 50% 100%, #C73E6E 0%, transparent 70%)",
},
boxShadow: {
  bubble: "0 1px 2px rgba(0,0,0,0.04)",
  card: "0 8px 32px rgba(0,0,0,0.08)",
},
fontSize: {
  display: ["40px", { lineHeight: "1.1", fontWeight: "800", letterSpacing: "-0.02em" }],
  title: ["28px", { lineHeight: "1.2", fontWeight: "700" }],
  h2: ["20px", { lineHeight: "1.3", fontWeight: "600" }],
  body: ["16px", { lineHeight: "1.5" }],
  label: ["13px", { lineHeight: "1.3", fontWeight: "500" }],
  caption: ["12px", { lineHeight: "1.4" }],
  tiny: ["11px", { lineHeight: "1.3", fontWeight: "500", letterSpacing: "0.08em" }],
},
```

---

## 13. "这一版做对了"的 Checklist

拿到任意新屏幕，对照下面 8 条：

- [ ] 只出现一个强调色元素（橘色只给一个 CTA）
- [ ] 背景明暗模式选对了（配置=黑，体验=浅+水彩）
- [ ] 所有长条控件都是 pill（没有 4–8px 小圆角异物）
- [ ] 聊天气泡带尾巴
- [ ] 所有可点区域 ≥ 44px
- [ ] 文字在水彩上可读（暗部对齐文字）
- [ ] 动效不超过 300ms，不带弹跳炫技
- [ ] 中英混排时英文标题走大写 + letter-spacing
