import type { Intensity } from "@attrax/shared";

// ─────────────────────────────────────────────────────────────────────────────
// Hardware team to fill these two constants once the ESP32-S3 firmware ships.
// If either still contains "TODO-", the app runs in offline mode (no-op writes)
// so the demo works without hardware.
const SERVICE_UUID = "TODO-hardware-pending";
const CHAR_UUID = "TODO-hardware-pending";
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

function uuidsPending(): boolean {
  return SERVICE_UUID.startsWith("TODO-") || CHAR_UUID.startsWith("TODO-");
}

export function supportsWebBluetooth(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

/**
 * Open the browser's native BT chooser and connect to the toy.
 * Falls back to offline mode (no-op writes) if:
 *   - hardware UUIDs are still TODO
 *   - navigator.bluetooth is unavailable (iOS Safari)
 *   - the user dismisses the chooser
 *   - connection fails
 */
export async function connect(): Promise<BtStatus> {
  if (uuidsPending() || !supportsWebBluetooth()) {
    setStatus("offline");
    return "offline";
  }

  setStatus("connecting");
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
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
    // User dismissed chooser, or pairing failed. Fall back to offline mode.
    setStatus("offline");
    return "offline";
  }
}

/** Skip the BT chooser entirely — S side, or explicit offline demo mode. */
export function goOffline(): void {
  setStatus("offline");
}

export async function writeIntensity(level: Intensity): Promise<void> {
  if (!state.characteristic) return;
  try {
    const buf = new Uint8Array([level]);
    await state.characteristic.writeValueWithoutResponse(buf);
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
  state.characteristic = null;
  state.device = null;
  setStatus("idle");
}

export function getStatus(): BtStatus {
  return state.status;
}
