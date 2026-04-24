import SimplePeer from "simple-peer";
import type { ClientMsg, ServerMsg } from "@attrax/shared";

interface CallState {
  peer: SimplePeer.Instance | null;
  localStream: MediaStream | null;
}

const state: CallState = { peer: null, localStream: null };

export interface StartCallOpts {
  /** S side initiates; M side answers. */
  asInitiator: boolean;
  /** Relay signal through our existing WS channel. */
  sendSignal: (msg: ClientMsg) => void;
  /** Fires when the remote peer's audio stream arrives (attach to <audio>). */
  onRemoteStream: (s: MediaStream) => void;
  /** Fires on peer close / error / hangup. UI should reset call state here. */
  onEnd: () => void;
  /** Fires when our local audio stream is ready (for STT tee). */
  onLocalStream?: (s: MediaStream) => void;
}

/**
 * Start a WebRTC audio call. Returns the local MediaStream so the caller can
 * tee it into STT or visualize mic level. Throws if mic permission is denied
 * or a call is already in progress.
 */
export async function startCall(opts: StartCallOpts): Promise<MediaStream> {
  if (state.peer) throw new Error("call already in progress");

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  state.localStream = stream;
  opts.onLocalStream?.(stream);

  const peer = new SimplePeer({
    initiator: opts.asInitiator,
    stream,
    trickle: true,
    config: {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    },
  });
  state.peer = peer;

  peer.on("signal", (data: unknown) => {
    const d = data as {
      type?: "offer" | "answer" | string;
      sdp?: string;
      candidate?: RTCIceCandidateInit;
    };
    if (d.type === "offer" && d.sdp) {
      opts.sendSignal({ type: "rtc_offer", sdp: d.sdp });
    } else if (d.type === "answer" && d.sdp) {
      opts.sendSignal({ type: "rtc_answer", sdp: d.sdp });
    } else if (d.candidate) {
      const c = d.candidate;
      opts.sendSignal({
        type: "rtc_ice",
        candidate: {
          candidate: c.candidate,
          sdpMid: c.sdpMid ?? null,
          sdpMLineIndex: c.sdpMLineIndex ?? null,
          usernameFragment: c.usernameFragment ?? null,
        },
      });
    }
    // Other internal signal types (renegotiate, etc.) are intentionally dropped.
  });

  peer.on("stream", (remote: MediaStream) => {
    opts.onRemoteStream(remote);
  });

  const finish = () => {
    cleanup();
    opts.onEnd();
  };
  peer.on("close", finish);
  peer.on("error", finish);

  return stream;
}

/**
 * Feed a server-relayed signaling message into the active peer. Call from
 * the WS onMessage handler for peer_rtc_offer / peer_rtc_answer / peer_rtc_ice
 * / peer_rtc_hangup.
 */
export function feedRemoteSignal(msg: ServerMsg): void {
  if (msg.type === "peer_rtc_hangup") {
    hangup(/* notifyPeer */ false);
    return;
  }
  if (!state.peer) return;
  try {
    if (msg.type === "peer_rtc_offer") {
      state.peer.signal({ type: "offer", sdp: msg.sdp } as never);
    } else if (msg.type === "peer_rtc_answer") {
      state.peer.signal({ type: "answer", sdp: msg.sdp } as never);
    } else if (msg.type === "peer_rtc_ice") {
      state.peer.signal({ candidate: msg.candidate } as never);
    }
  } catch {
    // ignore — peer may have closed just before this frame arrived
  }
}

/**
 * End the call locally. When notifyPeer is true (the default, user-initiated
 * hangup) we also send rtc_hangup so the other side tears down its peer.
 */
export function hangup(notifyPeer = true, sendSignal?: (m: ClientMsg) => void): void {
  if (notifyPeer && sendSignal) {
    try {
      sendSignal({ type: "rtc_hangup" });
    } catch {
      // ignore
    }
  }
  cleanup();
}

function cleanup(): void {
  if (state.peer) {
    try {
      state.peer.destroy();
    } catch {
      // ignore
    }
    state.peer = null;
  }
  if (state.localStream) {
    state.localStream.getTracks().forEach((t) => t.stop());
    state.localStream = null;
  }
}

export function setMuted(muted: boolean): void {
  if (!state.localStream) return;
  state.localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
}

export function isInCall(): boolean {
  return state.peer !== null;
}

export function getLocalStream(): MediaStream | null {
  return state.localStream;
}
