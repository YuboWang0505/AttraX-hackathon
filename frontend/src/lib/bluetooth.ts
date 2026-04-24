import type { Intensity } from "@attrax/shared";

// ─────────────────────────────────────────────────────────────────────────────
// Hardware protocol — taken verbatim from the engineer's test page
// (web蓝牙通信轮动发送测试.html). Keep these in sync with the ESP32 firmware.
const DEVICE_NAME = "Vibration_Egg";
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

// Hardware command mapping: ESP32 expects a single ASCII digit.
// Per the test-page comment "'0', '1', '2', '3' 对应 高/中/低/停", the mapping
// is INVERTED from the app's Intensity (0=off, 3=high).
//   app intensity 0 (off)  → send '3'  (停)
//   app intensity 1 (low)  → send '2'  (低)
//   app intensity 2 (med)  → send '1'  (中)
//   app intensity 3 (high) → send '0'  (高)
const INTENSITY_TO_CMD: Record<Intensity, string> = {
  0: "3",
  1: "2",
  2: "1",
  3: "0",
};
// ─────────────────────────────────────────────────────────────────────────────

export type BtStatus = "idle" | "connecting" | "connected" | "offline" | "error";

type Listener = (status: BtStatus) => void;

interface BtState {
  status: BtStatus;
  device: BluetoothDevice | null;
  characteristic: BluetoothRemoteGATTCharacteristic | null;
}

const state: BtState = {
  status: "idle",
  device: null,
  characteristic: null,
};

const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  fn(state.status);
  return () => listeners.delete(fn);
}

function setStatus(next: BtStatus): void {
  state.status = next;
  for (const l of listeners) l(next);
}

export function isOffline(): boolean {
  return state.status === "offline";
}

export function supportsWebBluetooth(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

/**
 * Open the browser's native BT chooser and connect to the toy.
 *   - supported + paired → status "connected"
 *   - navigator.bluetooth missing (iOS Safari, insecure context) → status "error"
 *   - user dismissed the chooser / pairing failed → status "error"
 *
 * "offline" status is reserved for goOffline() (explicit demo mode).
 * BtGate treats "error" as a recoverable retry state; Chat treats a
 * transition "connected" → not-connected as a mid-session interruption.
 */
export async function connect(): Promise<BtStatus> {
  if (!supportsWebBluetooth()) {
    setStatus("error");
    return "error";
  }

  setStatus("connecting");
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ name: DEVICE_NAME }],
      optionalServices: [SERVICE_UUID],
    });
    state.device = device;
    device.addEventListener("gattserverdisconnected", () => {
      state.characteristic = null;
      state.device = null;
      setStatus("idle");
    });
    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    const characteristic = await service.getCharacteristic(CHAR_UUID);
    state.characteristic = characteristic;
    setStatus("connected");
    return "connected";
  } catch {
    setStatus("error");
    return "error";
  }
}

/** Skip the BT chooser entirely — S side, or explicit offline demo mode. */
export function goOffline(): void {
  setStatus("offline");
}

export async function writeIntensity(level: Intensity): Promise<void> {
  if (!state.characteristic) return;
  try {
    const cmd = INTENSITY_TO_CMD[level];
    const buf = new TextEncoder().encode(cmd);
    await state.characteristic.writeValue(buf);
  } catch {
    // Silent failure — viz remains authoritative in the demo
  }
}

export async function disconnect(): Promise<void> {
  try {
    await writeIntensity(0);
  } catch {
    // ignore
  }
  if (state.device?.gatt?.connected) {
    try {
      state.device.gatt.disconnect();
    } catch {
      // ignore
    }
  }
  // Chrome 104+: drop the device from the browser's permitted-devices list
  // so the next requestDevice() does a fresh scan instead of returning a
  // cached handle that may no longer be advertising visibly.
  const dev = state.device as (BluetoothDevice & { forget?: () => Promise<void> }) | null;
  if (dev && typeof dev.forget === "function") {
    try {
      await dev.forget();
    } catch {
      // ignore
    }
  }
  state.characteristic = null;
  state.device = null;
  setStatus("idle");
}

export function getStatus(): BtStatus {
  return state.status;
}
