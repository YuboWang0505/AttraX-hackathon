# 硬件侧待办 · ESP32 固件安全项

> 面向硬件工程师
> 版本 v1 · 2026-04-24 · 演示前必须闭环

## 背景

Web 侧（React + Web Bluetooth）在**正常关闭路径**下会先发送停止指令 `'3'` 再断开 GATT，硬件一定停：

- 用户说安全词
- 对方断开 30 秒后触发 peer_left
- 用户点"退出"按钮
- 会话空闲超时 30 分钟

但**异常关闭路径**下 web 侧没机会执行任何 JS：

- 用户直接关标签页 / 关浏览器
- 浏览器崩溃 / 系统崩溃
- 手机锁屏后 BT 断连
- 走出有效距离
- WiFi / BT 信号冲突
- 电池耗尽

这些情况下 ESP32 收到的是 BLE 链路层的 disconnect，**没有收到 `'3'`**。硬件是否停**完全取决于固件的 disconnect 回调**。

---

## 需求

### 必做项（阻断演示）

**1. `onDisconnect` 回调里必须把电机 PWM 归零**

伪代码：

```c
void onDisconnect(BLEServer* pServer) {
  setMotorSpeed(0);          // ← 这一行是关键
  pAdvertising->start();     // 重启广播（下面第 2 项）
}
```

原因：上述所有异常断开场景下，这是**唯一**能保证用户关机后硬件也停的位置。缺这一行 = 存在"用户关机但硬件继续震直到电池耗尽"的事故风险。

**2. `onDisconnect` 必须重启 BLE 广播**

现在已经观察到的问题：手机连过一次、断开之后，**原机器重新扫描搜不到硬件**，而**其它机器能搜到**。判断下来是原机器 BLE 栈缓存 + 固件没重新广播导致的粘滞状态。

加上 `pAdvertising->start()` 后，每次断开都回到"正在广播等待连接"的干净状态。

### 建议项（非阻断）

**3. 关掉 bonding / pairing**

当前推测固件启用了 `ESP_LE_AUTH_REQ_SC_BOND` 一类的安全配对选项，导致客户端和设备互存 IRK。这让 Android/Chrome 的 BT 栈产生"粘滞记忆"，需要用户手动去系统里删配对才能重新连。

演示场景不需要 pairing，建议关掉：

```c
// 不要设置这行：
// pSecurity->setAuthenticationMode(ESP_LE_AUTH_REQ_SC_BOND);

// 改成无 bonding：
pSecurity->setAuthenticationMode(ESP_LE_AUTH_NO_BOND);
```

收益：每次连接都是干净的，无 OS 侧粘滞记忆，再也不用"切蓝牙开关 / 删配对记录"这种操作。

**4. 看门狗 / 过流保护**

可选，但对"硬件接到错误指令跑飞"是好的兜底。如果电机额定电流被超过 N 秒，自动归零。

---

## 协议确认

以下是 web 侧对固件的**硬假设**。如果新固件 `esp32_comm.ino` 有任何改动，web 侧代码也要同步：

| 项 | Web 侧假设的值 | 源码位置 |
|---|---|---|
| BLE 广播名 | `"Vibration_Egg"` | `frontend/src/lib/bluetooth.ts:DEVICE_NAME` |
| Service UUID | `4fafc201-1fb5-459e-8fcc-c5c9c331914b` | `frontend/src/lib/bluetooth.ts:SERVICE_UUID` |
| Characteristic UUID | `beb5483e-36e1-4688-b7f5-ea07361b26a8` | `frontend/src/lib/bluetooth.ts:CHAR_UUID` |
| Write 方式 | GATT write with response | 用 `writeValue` |
| 写入值 | 单字节 ASCII | `'0'`/`'1'`/`'2'`/`'3'` |
| **倒映射**（**关键**） | `'0'=高 / '1'=中 / '2'=低 / '3'=停` | `frontend/src/lib/bluetooth.ts:INTENSITY_TO_CMD` |

任何一项和新固件对不上都会导致前端"连得上但写不动"或"写错了档位"。

---

## 验收

### 验收 1：异常断开归零

1. M 端进 Chat，硬件跑 2 档或 3 档（能感知到在震）
2. 直接**关掉浏览器标签页**（不点退出按钮）
3. 观察硬件在 1 秒内停震

若硬件继续震 → 固件 `onDisconnect` 没处理电机，回去加第 1 项。

### 验收 2：重连干净

1. 手机 Chrome 扫到 `Vibration_Egg`，连接成功
2. 关标签页断开
3. 同一台手机 Chrome **立刻再扫一次**，能看到 `Vibration_Egg`

若搜不到 → 固件 `onDisconnect` 没重启 advertising，或启用了 bonding。回去加第 2 项 + 考虑第 3 项。

### 验收 3：协议对齐

1. 写 `'0'` → 最高档震动
2. 写 `'1'` → 中档震动
3. 写 `'2'` → 低档震动
4. 写 `'3'` → 停

任何一档不符合 → 跟前端 `INTENSITY_TO_CMD` 对齐，二选一改。

---

## 当前远程上的固件

硬件同事 `arya` 已经上传 `esp32_comm.ino`（commit `b2a140c`）。Web 侧还没有打开比对。下次硬件同事和 web 侧一起复盘时：

1. 打开 `esp32_comm.ino`，grep `onDisconnect` / `disconnect` 相关回调
2. 检查上面 4 项是否都在
3. 不满足的 → 就地改 → 刷固件 → 过一次 §验收

---

## 不在本文档范围

- 硬件主板 / 电机选型 / PWM 驱动（硬件同事自决）
- 电池续航（硬件同事自决）
- Web 侧代码改动（前端负责）
- 固件 OTA 升级方案（v2）
- 多设备同房间（v2）
