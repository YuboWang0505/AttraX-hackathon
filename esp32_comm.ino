/*
 * ============================================================================
 * 跳蛋振动控制器 - BLE Server（Web 控制版）
 * Vibration Egg Controller - BLE Server for Web
 * ============================================================================
 * 
 * 角色：BLE Server（外设）
 * 功能：等待 Web 浏览器连接，接收档位指令 (1/2/3) 并驱动马达
 * 
 * 硬件：ESP32 + 震动马达（GPIO4）
 * 
 * UUID 与 Web 页面保持一致：
 *   Service: 4fafc201-1fb5-459e-8fcc-c5c9c331914b
 *   Characteristic: beb5483e-36e1-4688-b7f5-ea07361b26a8
 * ============================================================================
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ================= 硬件配置 =================
#define MOTOR_PIN         4
#define LED_PIN           2

// ================= BLE配置（务必与 Web 端一致）=================
#define DEVICE_NAME           "Vibration_Egg"
#define SERVICE_UUID          "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID   "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// ================= 振动参数 =================
#define PWM_FREQ          5000
#define PWM_RES           8
#define DUTY_OFF          0
#define DUTY_LOW          150
#define DUTY_MED          200
#define DUTY_HIGH         250

// ================= 全局变量 =================
BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool deviceConnected = false;
uint8_t currentLevel = 3;   // 默认关闭
uint8_t lastLevel = 255;

// ================= 振动控制（完全不变）=================
void setVibration(uint8_t level) {
  uint32_t duty;
  switch (level) {
    case 3: duty = DUTY_OFF;  break;
    case 2: duty = DUTY_LOW;  break;
    case 1: duty = DUTY_MED;  break;
    case 0: duty = DUTY_HIGH; break;
    default: return;
  }
  currentLevel = level;
  ledcWrite(MOTOR_PIN, duty);
  Serial.printf("▶ 振动: LEVEL:%d (%d%%)\n", level, (duty*100)/255);
  digitalWrite(LED_PIN, (level < 3) ? HIGH : LOW);
}

// ================= 原有字符串解析（保留，兼容 LEVEL:x 格式）=================
void parseLevelCommand(String value) {
  if (value.startsWith("LEVEL:")) {
    int level = value.substring(6).toInt();
    if (level >= 0 && level <= 3 && level != lastLevel) {
      lastLevel = level;
      setVibration(level);
    }
  }
}

// ================= BLE 写入回调（已修正类型兼容）=================
class MyCharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    // 修正：使用 Arduino 原生 String 类型，兼容 Core 2.x / 3.x 的 BLE 库差异
    String value = pCharacteristic->getValue();
    if (value.length() == 0) return;

    // 直接读取第一个字节
    uint8_t cmd = value[0];

    // 兼容 Web 端发送的 ASCII 字符 '0'~'3' 或原始字节 0x00~0x03
    if (cmd >= '0' && cmd <= '3') {
      cmd -= '0'; // ASCII 转数字
    }

    Serial.printf("← 收到指令: %d (原始: 0x%02X)\n", cmd, value[0]);
    
    // 匹配档位并执行 (0=高, 1=中, 2=低, 3=停)
    if (cmd >= 0 && cmd <= 3 && cmd != currentLevel) {
      setVibration(cmd);
    }
  }
};

// ================= 连接 / 断开回调 =================
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) override {
    deviceConnected = true;
    Serial.println("[BLE] ✓ 设备已连接");
  }
  void onDisconnect(BLEServer* pServer) override {
    deviceConnected = false;
    lastLevel = 255;  // 允许重连后立即响应
    Serial.println("[BLE] 设备断开，重新广播...");
    // 重新开始广播，等待 Web 端再次连接
    BLEDevice::startAdvertising();
  }
};

// ================= 初始化 =================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n========================================");
  Serial.println(" 跳蛋振动控制器 v2.0 (Web BLE)");
  Serial.println("========================================\n");

  // GPIO 初始化
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // PWM 初始化
  ledcAttach(MOTOR_PIN, PWM_FREQ, PWM_RES);
  ledcWrite(MOTOR_PIN, DUTY_OFF);

  // 开机自检
  Serial.println("[自检] 马达振动 2秒...");
  ledcWrite(MOTOR_PIN, 255);
  delay(2000);
  ledcWrite(MOTOR_PIN, 0);
  Serial.println("[自检] 完成");

  // ---- BLE 初始化 ----
  BLEDevice::init(DEVICE_NAME);
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // 创建服务
  BLEService* pService = pServer->createService(SERVICE_UUID);

  // 创建可写特征值
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_WRITE |
    BLECharacteristic::PROPERTY_WRITE_NR   // 允许无响应写入
  );
  pCharacteristic->setCallbacks(new MyCharacteristicCallbacks());

  // 启动服务
  pService->start();

  // 开始广播
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  BLEDevice::startAdvertising();

  Serial.println("[BLE] 开始广播，等待 Web 页面连接...");
  Serial.printf("[BLE] 设备名：%s\n", DEVICE_NAME);
}

// ================= 主循环 =================
void loop() {
  // 心跳打印
  static unsigned long lastHeart = 0;
  if (millis() - lastHeart > 5000) {
    lastHeart = millis();
    Serial.printf("[状态] %s 档位:%d\n", 
                  deviceConnected ? "已连接" : "等待连接", 
                  currentLevel);
  }
  
  delay(100);
}