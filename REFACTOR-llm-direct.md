# 意图 Pipeline 重构方案：LLM 直出档位

> 版本 v1 · 未执行 · 测试数据基于 2026-04-24 OpenRouter Grok-4-Fast

## 一句话

**删掉 17 行关键词表和 17 类 intent_code 中间层，由 LLM 直接产出 `{intensity, reason}`。pipeline 从三层简化成两层：`safe-word → LLM`。**

---

## 1. 背景

### 1.1 当前实现（PRD v1.2）

```
S 消息
  │
  ├─ Layer 0: safe-word 精确匹配   （规则, <1ms, 安全红线）
  ├─ Layer 1: 关键词子串查表       （规则, 17 行 keyword table, <10ms）
  └─ Layer 2: Gemini 分类          （LLM, ~1s, 从 17 个 intent_code 里选一个）
```

关键词表位置：`backend/src/intent/table.ts`，17 行，每行带 `intent_code + intensity + description + keywords[]`。Layer 1 命中就不走 Layer 2。

产出：`{intent_code: "S_XXX", intensity: 0|1|2|3}`，前者查后者，intent 只是 intensity 的"分类标签"。

### 1.2 已知问题

**维护负担**：
- 关键词表需要人工覆盖所有变体（语气词、同义、paraphrase）
- 歧义词（"给你"、"规矩"、"现在"）必须定期清洗，PRD v1.2 已经删过一批但仍有漏网
- 新增"分类类型"（比如某种新的高强度命令）要同步改表 + 改 IntentCode 类型 + 改 Gemini prompt

**LLM 被迫做窄任务**：
- 现在 LLM 的职责是"给定文本，在 17 个代码里挑一个"
- 实际产品只需要"这句话该让硬件多强"，从 0 到 3 的四档
- 把分类题硬拆成"先贴标签再查表"比直接问"几档"多绕一层

**歧义词反噬**：
- 关键词表给 LLM 当参考时，"规矩"这种词会把 LLM 从"理解语境"拉回"字面匹配"
- 测试数据见 §3

---

## 2. 重构目标

### 2.1 要得到什么

- **更少代码**：删 ~250 行表 + 测试
- **更高档位准度**：93% → 97%（测试见 §3）
- **更自然的可观测性**：LLM 同时产出 `reason` 字段（自然语言，"命令跪下"/"许可高潮"/"闲聊天气"），替代 `intent_code` 代码

### 2.2 明确不做

- 不动 `safe-word.ts`（安全红线必须规则，不经 LLM）
- 不动 `rooms.ts` 的房间匹配/seq_id/重连逻辑
- 不动前端 UI 布局/交互
- 不动 WS 协议整体形状（只改一个字段名）

---

## 3. 测试数据

用 30 条覆盖 17 类 + 歧义 + off-topic 的 case 做了三组对比（完整脚本见 `backend/src/intent/openrouter-test.ts`）：

| 方案 | 档位正确 | intent_code 正确 | 平均延迟 |
|---|---|---|---|
| A. LLM + 17 类代码，不给关键词 | 28/30 (93.3%) | 25/30 (83.3%) | 1091ms |
| B. LLM + 17 类代码，给关键词表作参考 | 27/30 (90.0%) | 27/30 (90.0%) | 651ms |
| **C. LLM 直接出 intensity，无代码无表** | **29/30 (96.7%)** | — | 922ms |

C 方案唯一 miss 是 #20「你身体是不是已经开始骚动了」 — Grok 判 1 档，我们标注 2 档，属于边界争议句。

B 方案的唯一新增失败：#30「规矩我都记得清清楚楚」 — 被关键词表里的"规矩"带偏到 S_WARNING。这条在 A/C 方案下都是对的，**证明关键词表是 LLM 的干扰源之一**。

---

## 4. 新架构

### 4.1 Pipeline

```
S 消息
  │
  ├─ Layer 0: safe-word 精确匹配   （规则, <1ms, 安全红线） ← 不变
  └─ Layer 1: LLM 直出              （~900ms, {intensity, reason}）
```

### 4.2 LLM 职责

**唯一输入**：当前消息文本（可选：最近 N 条历史消息做上下文，v1 先不加）

**唯一输出**：
```json
{"intensity": 0 | 1 | 2 | 3, "reason": "≤12 字中文摘要"}
```

**System Prompt 核心**（完整版已验证，见 `openrouter-test.ts:buildSystemPrompt`）：
```
你是远程震动玩具的控制大脑。读 S 的消息，判断当前该让硬件多强。

0 = STOP（安全词或明示停止）
1 = 轻 / 温柔 / 前戏 / 事后 / 边缘否定 / 模糊闲聊
2 = 中 / 命令 / 挑逗 / 警告 / 轻惩
3 = 强 / 高潮许可/强制 / 严惩 / 大奖

规则：
- 看整体意图，不要咬字面
- "我给你倒杯水" 判 1（日常），不是 3
- 不确定时默认 1
```

### 4.3 Fallback（网络/API 故障时）

LLM 调用 timeout 或 HTTP 错误时：返回 `{intensity: 1, reason: null}` 硬编码兜底。

---

## 5. 文件级变更清单

### 5.1 删除

| 文件 | 行数 | 原因 |
|---|---|---|
| `backend/src/intent/table.ts` | ~120 | 17 行关键词表 |
| `backend/src/intent/keywords.ts` | ~30 | substring matching |
| `backend/src/intent/keywords.test.ts` | ~50 | keyword tie-break 测试 |
| `backend/src/intent/gemini.ts` | ~110 | 被 llm.ts 顶替 |

### 5.2 新建

**`backend/src/intent/llm.ts`** — 从 `openrouter-test.ts` 提炼成正式模块：

```ts
export interface LlmResult {
  intensity: Intensity;
  reason: string | null;
  source: "llm" | "fallback" | "timeout" | "parse_error" | "no_key";
}

export async function classify(text: string): Promise<LlmResult>;
```

- 环境变量：`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`（默认 `x-ai/grok-4-fast`）
- Timeout: 1500ms（与原 Gemini 层对齐）
- 无 key 时返回 `{intensity: 1, reason: null, source: "no_key"}`
- JSON parse 失败/HTTP 错误：同样走 fallback

### 5.3 修改

**`backend/src/intent/pipeline.ts`**：

```ts
// 从
if (isSafeWordMatch(text, safeWord)) return { safeWordTriggered: true };
const kw = matchKeywords(text);
if (kw) return { intent_code: kw.code, intensity: kw.intensity };
const g = await classifyWithGemini(text);
return { intent_code: g.intent_code, intensity: g.intensity };

// 变成
if (isSafeWordMatch(text, safeWord)) return { safeWordTriggered: true };
const r = await classifyWithLlm(text);
return { intensity: r.intensity, reason: r.reason };
```

**`shared/src/protocol.ts`**：

```ts
// 删除
export type IntentCode = "SYS_SAFE_WORD" | "S_WARM_UP" | ... /* 17 */;

// ChatMessage 改字段
export type ServerMsg =
  | { type: "chat"; from: Role; text: string;
      intensity: Intensity;
-     intent_code: IntentCode;
+     reason: string | null;
      seq_id: number; timestamp: number }
  | ...;
```

**`backend/src/rooms.ts`**：广播 `out` 对象里 `intent_code: result.intent_code` → `reason: result.reason`。

**`frontend/src/store.ts`**：`ChatMessage` 接口 `intent_code` → `reason`。

**`frontend/src/components/ChatBubble.tsx`**：当前只显示 `→ X 档`，不依赖 `intent_code`。改字段后**UI 可以不变**；可选在 S 气泡下面加一行极小灰字显示 reason（debug 可读，不影响主视觉）。

**`backend/src/intent/repl.ts`**：接口微调（原来打印 `intent_code`，改成打印 `reason`）。

### 5.4 保留不动

- `backend/src/safe-word.ts` + `safe-word.test.ts`（14 个测试）
- `backend/src/intent/openrouter-test.ts`（作为实验工具留着）
- 所有前端组件结构、路由、store 其它字段

---

## 6. 代码量对比

| 模块 | 重构前 | 重构后 | Δ |
|---|---|---|---|
| `intent/` 目录 | ~340 行 | ~80 行 | −260 |
| `shared/protocol.ts` | 含 17 个字面量联合类型 | 无 | −17 |
| 测试 | keywords.test.ts 9 个 | 0 | −9 |
| **合计** | **~390 行 + 9 个测试** | **~80 行** | **−310 行** |

---

## 7. 权衡与风险

### 7.1 ✅ 好处

- 代码量 ↓78%
- 档位准度 93% → 97%
- 维护负担 ↓（不再手工对着 PRD Appendix A 清歧义词）
- LLM 的判断更符合产品语义（不再强分类到 17 个人工桶）
- `reason` 字段自然语言，对运营/调试比 `intent_code` 友好

### 7.2 ⚠️ 成本

**1. 每条消息都要过 LLM（~900ms）**

原 pipeline 关键词命中的消息是 <10ms，重构后全量走 LLM。
- 典型 S 消息实测 500-1300ms（Grok-4-Fast on OpenRouter）
- 对聊天场景用户感受接近"对方打字 + 发送 + 网络"的自然节奏，可接受
- 现场 WiFi 抖动时 P99 可能 3-4s，用户会觉得"按键不响应"

**2. 网络/API 故障时 fallback 是死默认值**

- 原方案：Gemini 挂了 → 还有关键词表兜底，仍能覆盖大多数高强度命令
- 新方案：OpenRouter 挂了 → 全部退回 intensity=1（软兜底）
- 对 demo 影响：现场网络坏了体验降级

**3. 成本（非零但可忽略）**

Grok-4-Fast on OpenRouter 定价约 $0.05/M input tokens。每条消息 ~200 tokens prompt + ~30 tokens output，单条约 $0.00001。demo 一场几百条消息，不到一美分。

### 7.3 双保险（可选中间方案）

若 §7.2 的第 2 点不可接受，可保留关键词表但**降级为 fallback** 而非 primary：

```
safe-word → LLM(primary)
              │
              └─ on timeout/error → keyword table fallback
                                     └─ 仍无命中 → intensity=1
```

这样正常链路走 LLM（精度高），LLM 挂了自动退回关键词表（精度低但离线可用），比死默认值兜底强。

代价：关键词表不删，维护负担还在，代码只减少 ~150 行而不是 ~260 行。

**建议**：先做纯 LLM 方案（最彻底），演示前一天拉一轮网络稳定性实测。如果 P99 能控制在 2s 内、API 可用性 99%+，就不需要双保险。否则回退到双保险方案。

---

## 8. 执行步骤

每一步结束时 `npm test -w @attrax/backend` 和 `npx tsc --noEmit` 都能通过。

1. **M1** — 新建 `backend/src/intent/llm.ts`（从 openrouter-test.ts 剥离 classify 函数），**不接入 pipeline**。独立可 `tsx` 运行验证。
2. **M2** — 在 `pipeline.ts` 加一条 feature flag 或 env switch（例如 `USE_LLM_DIRECT=1`），走新路径时调 `llm.classify`，不走时仍走老路径。可并行验证。
3. **M3** — 更新 `shared/src/protocol.ts`：`intent_code` → `reason`。同步 `rooms.ts` 广播、`frontend/store.ts` 接口、`ChatBubble.tsx` 字段。此时编译应通过，两条路径共存（老路径把 intent_code 转成 reason 显示）。
4. **M4** — 全量切换 `USE_LLM_DIRECT=1`，跑一轮两 tab 回归（PRD §9.1 checklist）。
5. **M5** — 删 `table.ts`、`keywords.ts`、`keywords.test.ts`、`gemini.ts`。移除 feature flag。
6. **M6** — 更新 `PRD.md`：Appendix A 关键词表从"权威定义"降级为"样例语料"，说明实际 intent 由 LLM 动态判断。

每步都可独立提交 + 回滚。

---

## 9. 回滚

若 demo 前发现 LLM 稳定性不达标：
- `git revert M4..M6`（恢复老 pipeline），保留 M1-M3（llm.ts 作为可选后端）
- 或直接 `git revert` 整条 refactor 分支

老关键词表完整保留在 git 历史里，任何时候能找回。

---

## 10. 不在本方案内

- 会话历史作为 LLM 上下文（v2 可做，收益待测）
- 多模型投票 / self-consistency（v2，成本翻倍不一定值）
- 本地小模型 on-device（硬件不支持）
- Layer 0 的 safe-word 也改成 LLM 判断（**拒绝** — 安全/延迟/可靠性三个理由，见 §4.1）
