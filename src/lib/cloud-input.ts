"use client";

/**
 * JYSDK input channel — binary protocol over the WebRTC datachannel
 * (channel name "JYSDK", id 1, unordered/lossy, high priority).
 *
 * Mouse packet (12 bytes, little-endian DataView):
 *   [0]=1 magic   [1]=11 length   [2]=2 type(mouse)   [3]=8
 *   [4..5] u16 x (0..10000 inside letterboxed video content rect)
 *   [6..7] u16 y (0..10000)
 *   [8]  i8 dx (movementX, clamped ±127)
 *   [9]  i8 dy (movementY)
 *   [10] u8 buttons bitmask (1=left 2=right 4=middle — MouseEvent.buttons)
 *   [11] i8 wheel (-1 | 0 | 1)
 *
 * Keyboard packet (variable, ≤24 bytes):
 *   [0]=1 magic   [1]=length(set last)   [2]=1 type(keyboard)   [3]=1
 *   [4..5] u16 keyCode
 *   [6]    u8 down(1)/up(0)
 *   [7..]  held keys: (u16 keyCode, u8 1)* … terminated by 255
 */

export type InputBinding = { detach: () => void };

type BindOpts = {
  video: HTMLVideoElement;
  send: (data: ArrayBuffer) => void;
  isActive: () => boolean;
  relockHint: HTMLElement;
  overlay: HTMLElement;
};

export function attachCloudInput(opts: BindOpts): InputBinding {
  const { video, send, isActive, relockHint, overlay } = opts;

  // virtual cursor state (needed because pointer lock hides the real cursor)
  let vx = 0, vy = 0, lockedX = 0, lockedY = 0;
  const heldKeys = new Set<number>();
  let contentRect: { left: number; top: number; width: number; height: number } | null = null;

  const contentBox = () => {
    if (!contentRect) {
      const r = video.getBoundingClientRect();
      const vw = video.videoWidth || 16;
      const vh = video.videoHeight || 9;
      const scale = Math.min(r.width / vw, r.height / vh);
      const w = vw * scale;
      const h = vh * scale;
      contentRect = { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
    }
    return contentRect;
  };
  const invalidateRect = () => { contentRect = null; };
  window.addEventListener("resize", invalidateRect);

  const rawSend = (data: ArrayBuffer) => {
    try { send(data); } catch { /* channel closing */ }
  };

  const clamp127 = (v: number) => Math.max(-127, Math.min(127, Math.round(v)));

  const mousePacket = (dx = 0, dy = 0, wheel = 0) => {
    const box = contentBox();
    const nx = Math.floor(((vx - box.left) / box.width) * 10000);
    const ny = Math.floor(((vy - box.top) / box.height) * 10000);
    const buf = new ArrayBuffer(12);
    const dv = new DataView(buf);
    dv.setUint8(0, 1);
    dv.setUint8(1, 11);
    dv.setUint8(2, 2);
    dv.setUint8(3, 8);
    dv.setUint16(4, Math.max(0, Math.min(10000, nx)));
    dv.setUint16(6, Math.max(0, Math.min(10000, ny)));
    dv.setInt8(8, clamp127(dx));
    dv.setInt8(9, clamp127(dy));
    dv.setInt8(10, lastButtons);
    dv.setInt8(11, wheel);
    rawSend(buf);
  };

  let lastButtons = 0;

  const keyPacket = (keyCode: number, down: boolean) => {
    if (down) heldKeys.add(keyCode);
    else heldKeys.delete(keyCode);
    const buf = new ArrayBuffer(24);
    const dv = new DataView(buf);
    dv.setUint8(0, 1);
    dv.setUint8(2, 1);
    dv.setUint8(3, 1);
    dv.setUint16(4, keyCode);
    dv.setUint8(6, down ? 1 : 0);
    let o = 7;
    for (const k of heldKeys) {
      if (k !== keyCode && k > 0 && k < 255 && o < 21) {
        dv.setUint16(o, k);
        o += 2;
        dv.setUint8(o, 1);
        o += 1;
      }
    }
    dv.setUint8(o++, 255);
    dv.setUint8(1, o - 1);
    rawSend(buf.slice(0, o));
  };

  // ---------- mouse ----------
  const onMouseMove = (e: MouseEvent) => {
    if (!isActive()) return;
    const dx = e.movementX || 0;
    const dy = e.movementY || 0;
    if (document.pointerLockElement === video) {
      const box = contentBox();
      lockedX = Math.max(0, Math.min(box.width, lockedX + dx));
      lockedY = Math.max(0, Math.min(box.height, lockedY + dy));
      vx = box.left + lockedX;
      vy = box.top + lockedY;
    } else {
      vx = e.clientX;
      vy = e.clientY;
    }
    mousePacket(dx, dy, 0);
  };
  const onMouseButton = (e: MouseEvent) => {
    if (!isActive()) return;
    lastButtons = e.buttons;
    mousePacket(0, 0, 0);
  };
  const onContextMenu = (e: MouseEvent) => {
    if (isActive()) e.preventDefault();
  };
  const onWheel = (e: WheelEvent) => {
    if (!isActive()) return;
    e.preventDefault();
    mousePacket(0, 0, e.deltaY > 0 ? -1 : 1);
  };

  // ---------- pointer lock / relock ----------
  let hadLock = false;
  const relock = () => {
    relockHint.classList.remove("visible");
    if (!video.requestPointerLock) return;
    if (document.pointerLockElement === video) return;
    invalidateRect();
    const box = contentBox();
    lockedX = box.width / 2;
    lockedY = box.height / 2;
    vx = box.left + lockedX;
    vy = box.top + lockedY;
    video.requestPointerLock?.();
  };
  const videoClick = () => { if (isActive()) relock(); };
  const onPointerLockChange = () => {
    if (!isActive()) return;
    if (document.pointerLockElement === video) {
      hadLock = true;
      relockHint.classList.remove("visible");
    } else if (hadLock) {
      const overlayHidden = !overlay.classList.contains("hidden");
      relockHint.classList.toggle("visible", !overlayHidden);
    }
  };

  // ---------- keyboard (capture phase so the page never eats keys) ----------
  const keyHandler = (down: boolean) => (e: KeyboardEvent) => {
    if (!isActive()) return;
    e.preventDefault();
    e.stopPropagation();
    if (down && e.repeat) return;
    keyPacket(e.keyCode, down);
  };
  const onKeyDown = keyHandler(true);
  const onKeyUp = keyHandler(false);

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mousedown", onMouseButton);
  document.addEventListener("mouseup", onMouseButton);
  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("wheel", onWheel, { passive: false });
  video.addEventListener("click", videoClick);
  relockHint.addEventListener("click", videoClick);
  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("keydown", onKeyDown, { capture: true });
  document.addEventListener("keyup", onKeyUp, { capture: true });

  return {
    detach: () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseButton);
      document.removeEventListener("mouseup", onMouseButton);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("wheel", onWheel);
      video.removeEventListener("click", videoClick);
      relockHint.removeEventListener("click", videoClick);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("keydown", onKeyDown, { capture: true });
      document.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("resize", invalidateRect);
      document.exitPointerLock?.();
    },
  };
}
