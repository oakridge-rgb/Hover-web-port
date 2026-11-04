import type { Frame, ProjectMeta } from './types'
import { getLayerCanvas, getScratch } from './canvases'

export interface RenderOpts {
  scale?: number
  bg?: string
  onion?: 'off' | 'prev' | 'next' | 'both'
  activeFrameIdx?: number
  frames?: Frame[]
}

const ONION_PREV = 'rgba(255, 60, 60, 1)'
const ONION_NEXT = 'rgba(40, 200, 90, 1)'

function tint(src: HTMLCanvasElement, color: string, alpha: number, w: number, h: number): HTMLCanvasElement {
  const t = getScratch('onion', w, h)
  const ctx = t.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(src, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = alpha
  ctx.drawImage(t, 0, 0)
  ctx.globalAlpha = 1
  return t
}

/**
 * Compose a frame (all visible layers) onto a target 2D context.
 * target must be w*scale x h*scale (or natural size with scale=1).
 */
export function renderFrame(
  target: CanvasRenderingContext2D,
  meta: ProjectMeta,
  frames: Frame[],
  frameIdx: number,
  opts: RenderOpts = {}
) {
  const scale = opts.scale ?? 1
  const w = Math.max(1, Math.round(meta.w * scale))
  const h = Math.max(1, Math.round(meta.h * scale))
  const frame = frames[frameIdx]
  if (!frame) {
    target.fillStyle = opts.bg ?? meta.bg
    target.fillRect(0, 0, w, h)
    return
  }

  // onion skins behind artwork
  const onion = opts.onion ?? 'off'
  target.fillStyle = opts.bg ?? meta.bg
  target.fillRect(0, 0, w, h)

  const drawLayers = (idx: number, alphaScale = 1) => {
    const f = frames[idx]
    if (!f) return
    for (const layer of f.layers) {
      if (!layer.visible) continue
      const c = getLayerCanvas(layer.id, meta.w, meta.h)
      target.globalAlpha = layer.opacity * alphaScale
      target.drawImage(c, 0, 0, w, h)
    }
    target.globalAlpha = 1
  }

  const drawOnion = (idx: number, color: string) => {
    const full = getScratch('onion-src', meta.w, meta.h)
    const fctx = full.getContext('2d')!
    fctx.clearRect(0, 0, meta.w, meta.h)
    const f = frames[idx]
    if (!f) return
    for (const layer of f.layers) {
      if (!layer.visible) continue
      fctx.globalAlpha = layer.opacity
      fctx.drawImage(getLayerCanvas(layer.id, meta.w, meta.h), 0, 0)
    }
    fctx.globalAlpha = 1
    target.drawImage(tint(full, color, 0.3, meta.w, meta.h), 0, 0, w, h)
  }

  if (!opts.scale || opts.scale === 1) {
    if (onion === 'prev' || onion === 'both') drawOnion(frameIdx - 1, ONION_PREV)
    if (onion === 'next' || onion === 'both') drawOnion(frameIdx + 1, ONION_NEXT)
  }
  drawLayers(frameIdx)
}

export function makeThumb(meta: ProjectMeta, frames: Frame[], frameIdx: number): string {
  const tw = 160
  const th = Math.max(1, Math.round((meta.h / meta.w) * tw))
  const c = getScratch('thumb', tw, th)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = meta.bg
  ctx.fillRect(0, 0, tw, th)
  const frame = frames[frameIdx]
  if (frame) {
    for (const layer of frame.layers) {
      if (!layer.visible) continue
      ctx.globalAlpha = layer.opacity
      ctx.drawImage(getLayerCanvas(layer.id, meta.w, meta.h), 0, 0, tw, th)
    }
    ctx.globalAlpha = 1
  }
  try {
    return c.toDataURL('image/webp', 0.72)
  } catch {
    return c.toDataURL('image/png')
  }
}
