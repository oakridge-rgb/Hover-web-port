"use client";

/**
 * CloudPlayer — orchestrates a Stratus cloud-gaming session.
 *
 * Lifecycle (mirrors the portal client):
 *   1. POST /stratus/session { game_key }            → uuid / queued state
 *   2. poll GET /stratus/session/{uuid} (2s)         → until finished_queue
 *   3. POST /stratus/session/{uuid}/start            → max_seconds, signaling_ws, ice_servers
 *   4. WS wss://<host>/stratus/signal/<id>           → wait "game_ready"
 *   5. RTCPeerConnection (recv A/V + "JYSDK" datachannel) → rtc_offer
 *   6. rtc_answer / rtc_candidate exchange           → streaming
 *
 * Signaling messages: game_ready, rtc_answer{sdp}, rtc_candidate{candidate},
 * ping (echo), time_left{time_left}, game_cap{message}, game_ended{message}.
 */
import {
  buildSignalingUrl,
  makeSessionApi,
  type SessionStart,
} from "@/lib/stratus";
import { attachCloudInput, type InputBinding } from "@/lib/cloud-input";

export type CloudPhase = "idle" | "requesting" | "queued" | "starting" | "connecting" | "streaming" | "reconnecting" | "ended" | "error";

export type CloudPlayerCallbacks = {
  onPhase: (phase: CloudPhase, detail: string, busy: boolean) => void;
  onStreamReady: (stream: MediaStream) => void;
  onConnected: () => void;
  onEnded: (title: string, detail: string) => void;
  onTimeLeft: (secondsLeft: number) => void;
};

const RECONNECT_DELAY_MS = 2000;
const RECONNECT_MAX_TRIES = 2;

export class CloudPlayer {
  private cb: CloudPlayerCallbacks;
  private api = makeSessionApi();

  private session: {
    uuid: string;
    gameKey: string;
    signalingWs?: string;
    iceServers?: RTCIceServer[];
    deadlineAt?: number;
    reconnecting?: boolean;
    reconnectTries?: number;
  } | null = null;

  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private timers: ReturnType<typeof setTimeout | typeof setInterval>[] = [];
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private micStream: MediaStream | null = null;
  private micPromise: Promise<MediaStream | null> | null = null;
  private input: InputBinding | null = null;
  private jitterTarget = 0;
  private jitterResetTimer: ReturnType<typeof setTimeout> | null = null;
  private ended = false;
  private starting = false;

  video: HTMLVideoElement | null = null;

  constructor(cb: CloudPlayerCallbacks) {
    this.cb = cb;
  }

  private timer(t: ReturnType<typeof setTimeout | typeof setInterval>) {
    this.timers.push(t);
    return t;
  }

  private sigSend(msg: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else if (msg.type === "rtc_candidate") {
      this.pendingCandidates.push(msg.candidate as RTCIceCandidateInit);
    }
  }

  private flushCandidates() {
    if (!this.pendingCandidates.length) return;
    const list = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const c of list) this.sigSend({ type: "rtc_candidate", candidate: c });
  }

  private setPhase = (phase: CloudPhase, detail: string, busy: boolean) =>
    this.cb.onPhase(phase, detail, busy);

  // ---------------- public API ----------------

  get sessionUuid() {
    return this.session?.uuid ?? null;
  }

  get isBusy() {
    return this.starting;
  }

  async start(gameKey: string) {
    if (this.starting) return;
    this.teardownInternal(false);
    this.starting = true;
    this.ended = false;

    // mic is optional (upload chat audio if granted)
    this.micPromise = navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((s) => (this.micStream = s))
      .catch(() => null);

    try {
      const created = await this.api.createSession(gameKey);
      if (created.error || !created.uuid) throw new Error(created.error || "session rejected");
      this.session = { uuid: created.uuid, gameKey };

      if (created.state === "queued") {
        this.setPhase("queued", `position #${created.queue_pos ?? "?"}`, false);
        for (;;) {
          if (!this.session || this.session.uuid !== created.uuid) return;
          await new Promise<void>((r) => this.timer(setTimeout(r, 2000)));
          if (!this.session || this.session.uuid !== created.uuid) return;
          const poll = await this.api.pollSession(created.uuid);
          if (poll.error) throw new Error(poll.error);
          if (poll.state === "finished_queue") break;
          this.setPhase("queued", `position #${poll.queue_pos ?? "?"}`, false);
        }
      }

      this.setPhase("starting", "booting instance", true);
      const started = await this.api.startSession(created.uuid);
      if (started.error || !started.signaling_ws) throw new Error(started.error || "instance failed to start");
      this.session.deadlineAt = Date.now() + 1000 * (started.max_seconds || 0);
      this.session.signalingWs = started.signaling_ws;
      this.session.iceServers = started.ice_servers;
      this.cb.onTimeLeft(started.max_seconds || 0);

      await this.connectSignaling(started.signaling_ws, started.ice_servers);

      const ticker = this.timer(
        setInterval(() => {
          if (!this.session?.deadlineAt) return;
          const left = Math.max(0, Math.round((this.session.deadlineAt - Date.now()) / 1000));
          this.cb.onTimeLeft(left);
        }, 500)
      );
      this.timers.push(ticker);
    } catch (e) {
      if (this.session) this.api.quitSession(this.session.uuid);
      const msg = (e as Error)?.message || "unknown error";
      this.setPhase("error", msg, false);
      this.starting = false;
    }
  }

  bindUi(video: HTMLVideoElement, relockHint: HTMLElement, overlay: HTMLElement) {
    this.video = video;
    if (this.dc && this.dc.readyState === "open") {
      this.input = attachCloudInput({
        video,
        relockHint,
        overlay,
        isActive: () => !this.ended && this.dc?.readyState === "open",
        send: (d) => this.dc?.send(d),
      });
    }
  }

  fullscreen(el: HTMLElement) {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }

  /** Quit + full teardown (close button / ended screen). */
  quit() {
    if (this.session) this.api.quitSession(this.session.uuid);
    this.teardownInternal(true);
  }

  // ---------------- internals ----------------

  private connectSignaling(signalingWs: string, iceServers?: RTCIceServer[], quiet = false): Promise<void> {
    return new Promise((resolve, reject) => {
      // signaling must ride the same mirror the session was created on
      const url = buildSignalingUrl(signalingWs, this.api.getHost());
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        if (!quiet) this.setPhase("starting", "signal connected, waiting for instance", true);
        this.flushCandidates();
      };
      ws.onerror = () => {
        if (this.ws === ws && !quiet) reject(new Error("signaling failed"));
      };
      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null;
        if (this.session && this.pc) this.attemptReconnect();
        else if (!quiet && !this.ended) reject(new Error("signaling closed"));
      };
      ws.onmessage = async (ev) => {
        if (this.ws !== ws) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data as string);
        } catch {
          return;
        }
        switch (msg.type) {
          case "game_ready":
            if (!this.pc) {
              this.setPhase("connecting", "negotiating webrtc", true);
              try {
                await this.createPeer(iceServers);
                resolve();
              } catch (e) {
                reject(e as Error);
              }
            } else {
              resolve();
            }
            break;
          case "rtc_answer": {
            try {
              const sdp = msg.sdp as string | RTCSessionDescriptionInit;
              const init: RTCSessionDescriptionInit = typeof sdp === "string" ? { type: "answer", sdp } : sdp;
              await this.pc?.setRemoteDescription(new RTCSessionDescription(init));
            } catch {
              /* malformed answer — keep waiting */
            }
            break;
          }
          case "rtc_candidate": {
            try {
              const c = msg.candidate as RTCIceCandidateInit | string;
              const init: RTCIceCandidateInit = typeof c === "string" ? { candidate: c } : c;
              await this.pc?.addIceCandidate(new RTCIceCandidate(init));
            } catch {
              /* ignore */
            }
            break;
          }
          case "ping":
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
            break;
          case "time_left":
            if (typeof msg.time_left === "number" && this.session) {
              this.session.deadlineAt = Date.now() + 1000 * msg.time_left;
            }
            break;
          case "game_cap":
            this.endScreen("time is up", String(msg.message || ""));
            break;
          case "game_ended":
            this.endScreen("session ended", String(msg.message || ""));
            break;
        }
      };
    });
  }

  private attemptReconnect() {
    const sess = this.session;
    if (!sess || sess.reconnecting || this.ended) return;
    sess.reconnecting = true;
    sess.reconnectTries = 0;
    let settled = false;
    this.cb.onPhase("reconnecting", "signal lost, retrying…", true);

    const tryOnce = () => {
      if (!this.session || this.session !== sess || settled) return;
      sess.reconnectTries = (sess.reconnectTries || 0) + 1;
      this.connectSignaling(sess.signalingWs!, sess.iceServers, true)
        .then(() => {
          if (!settled && this.session === sess) {
            settled = true;
            sess.reconnecting = false;
            if (this.pc?.connectionState === "connected") this.cb.onPhase("streaming", "", false);
            else this.cb.onPhase("connecting", "reconnected, restoring stream…", true);
          }
        })
        .catch(() => {});
      this.timer(
        setTimeout(() => {
          if (!settled && this.session === sess) {
            if ((sess.reconnectTries || 0) >= RECONNECT_MAX_TRIES) {
              settled = true;
              this.endScreen("session ended", "lost connection to the game server");
              return;
            }
            try { this.ws?.close(); } catch { /* already closed */ }
            this.ws = null;
            tryOnce();
          }
        }, RECONNECT_DELAY_MS)
      );
    };
    tryOnce();
  }

  private async createPeer(iceServers?: RTCIceServer[]) {
    const video = this.video;
    const pc = new RTCPeerConnection({
      iceServers: iceServers || [],
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      iceCandidatePoolSize: 4,
    });
    this.pc = pc;

    pc.addTransceiver("audio", { direction: "recvonly" });
    const videoTx = pc.addTransceiver("video", { direction: "recvonly" });

    // prefer hardware-friendly codecs: H264 first; AV1 only if the decoder is efficient
    try {
      const caps = RTCRtpReceiver.getCapabilities?.("video");
      if (caps?.codecs?.length && videoTx.setCodecPreferences) {
        const h264 = caps.codecs.filter((c) => /h264/i.test(c.mimeType));
        const av1 = caps.codecs.filter((c) => /av1/i.test(c.mimeType));
        const rest = caps.codecs.filter((c) => !/h264|av1/i.test(c.mimeType));
        let av1Ok = false;
        try {
          if (av1.length && navigator.mediaCapabilities?.decodingInfo) {
            const probe = await navigator.mediaCapabilities.decodingInfo({
              type: "webrtc",
              video: { contentType: "video/AV1", width: 1920, height: 1080, bitrate: 4_000_000, framerate: 30 },
            });
            av1Ok = !!(probe.powerEfficient && probe.smooth);
          }
        } catch { /* keep order */ }
        videoTx.setCodecPreferences(av1Ok ? [...av1, ...h264, ...rest] : [...h264, ...av1, ...rest]);
      }
    } catch { /* default codec order */ }

    // input channel — the game stream consumes these packets
    const dc = pc.createDataChannel("JYSDK", {
      id: 1,
      ordered: false,
      maxRetransmits: 0,
      // `priority` is spec'd but missing from TS DOM types
      ...(({ priority: "high" }) as RTCDataChannelInit),
    });
    this.dc = dc;
    dc.onclose = () => {
      if (this.dc === dc && this.session && !this.ended) this.endScreen("session ended", "lost the input channel");
    };
    dc.onerror = () => {
      if (this.dc === dc && this.session && !this.ended) this.endScreen("session ended", "input channel error");
    };
    if (this.video && dc.readyState === "open" && !this.input) {
      this.input = attachCloudInput({
        video: this.video,
        send: (d) => dc.send(d),
        isActive: () => !this.ended && this.dc?.readyState === "open",
        relockHint: document.getElementById("cloudRelockHint") || this.video,
        overlay: document.getElementById("cloudOverlay") || this.video,
      });
    }

    // adaptive jitter buffer: bump latency on stalls, relax after 15s of smooth playback
    const bumpJitter = () => {
      if (this.jitterResetTimer) clearTimeout(this.jitterResetTimer);
      this.jitterTarget = Math.min(200, this.jitterTarget + 40);
      this.applyJitter();
      this.jitterResetTimer = this.timer(
        setTimeout(() => {
          this.jitterTarget = Math.max(0, this.jitterTarget - 40);
          this.applyJitter();
        }, 15000)
      );
    };
    video?.addEventListener("waiting", bumpJitter);
    video?.addEventListener("stalled", bumpJitter);

    pc.ontrack = (ev) => {
      if (!video) return;
      if (!video.srcObject) video.srcObject = new MediaStream();
      (video.srcObject as MediaStream).addTrack(ev.track);
      this.cb.onStreamReady(video.srcObject as MediaStream);
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate) this.sigSend({ type: "rtc_candidate", candidate: ev.candidate.toJSON() });
    };

    let discTimer: ReturnType<typeof setTimeout> | null = null;
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      const st = pc.connectionState;
      if (st === "connected") {
        if (discTimer) clearTimeout(discTimer);
        if (video) video.muted = false;
        video?.play().catch(() => {});
        this.setPhase("streaming", "", false);
        this.starting = false;
        this.cb.onConnected();
      } else if (st === "disconnected") {
        if (!discTimer) {
          discTimer = this.timer(
            setTimeout(() => {
              if (this.pc === pc && pc.connectionState === "disconnected") this.endScreen("session ended", "lost connection to the stream");
            }, 6000)
          );
        }
      } else if (st === "failed" || st === "closed") {
        if (discTimer) clearTimeout(discTimer);
        this.endScreen("session ended", "lost connection to the stream");
      }
    };

    // optional mic uplink
    try {
      const mic = this.micPromise && (await this.micPromise);
      const track = mic?.getAudioTracks()[0];
      if (track) pc.addTrack(track);
    } catch { /* mic optional */ }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.sigSend({ type: "rtc_offer", sdp: offer.sdp });
  }

  private applyJitter() {
    const video = this.video;
    if (!video?.srcObject) return;
    for (const track of (video.srcObject as MediaStream).getTracks()) {
      const receiver = this.pc?.getReceivers().find((r) => r.track === track);
      if (!receiver) continue;
      try {
        if ("jitterBufferTarget" in receiver) (receiver as unknown as { jitterBufferTarget: number }).jitterBufferTarget = this.jitterTarget;
      } catch { /* not supported */ }
      try {
        if ("playoutDelayHint" in receiver) (receiver as unknown as { playoutDelayHint: number }).playoutDelayHint = this.jitterTarget / 1000;
      } catch { /* not supported */ }
    }
  }

  private endScreen(title: string, detail: string) {
    if (this.ended) return;
    this.ended = true;
    if (this.session) this.api.quitSession(this.session.uuid);
    this.teardownInternal(true);
    this.cb.onEnded(title, detail);
  }

  private teardownInternal(clearVideo: boolean) {
    this.starting = false;
    this.input = detachSafe(this.input);
    for (const t of this.timers) {
      clearInterval(t as ReturnType<typeof setInterval>);
      clearTimeout(t as ReturnType<typeof setTimeout>);
    }
    this.timers = [];
    if (this.jitterResetTimer) clearTimeout(this.jitterResetTimer);
    this.jitterResetTimer = null;
    try { this.dc?.close(); } catch { /* ignore */ }
    try { this.pc?.close(); } catch { /* ignore */ }
    try { this.ws?.close(); } catch { /* ignore */ }
    this.dc = null;
    this.pc = null;
    this.ws = null;
    this.session = null;
    this.pendingCandidates = [];
    document.exitPointerLock?.();
    if (clearVideo && this.video) this.video.srcObject = null;
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    this.micPromise = null;
    this.ended = false;
  }
}

// tiny helper so teardown works even when detach is missing
function detachSafe(input: InputBinding | null): InputBinding | null {
  try { input?.detach(); } catch { /* ignore */ }
  return null;
}
