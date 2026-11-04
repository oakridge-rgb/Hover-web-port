// Pixel registry: layerId -> offscreen canvas. Kept outside React state.
const registry = new Map<string, HTMLCanvasElement>()

export function getLayerCanvas(layerId: string, w: number, h: number): HTMLCanvasElement {
  let c = registry.get(layerId)
  if (!c) {
    c = document.createElement('canvas')
    c.width = w
    c.height = h
    registry.set(layerId, c)
  }
  return c
}

export function hasLayerCanvas(layerId: string): boolean {
  return registry.has(layerId)
}

export function deleteLayerCanvas(layerId: string) {
  registry.delete(layerId)
}

export function cloneLayerCanvas(layerId: string, newId: string, w: number, h: number) {
  const src = registry.get(layerId)
  const dst = getLayerCanvas(newId, w, h)
  const ctx = dst.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  if (src) ctx.drawImage(src, 0, 0)
}

/** Scratch canvases reused for compositing work. NOT auto-cleared: callers clear explicitly. */
const scratch = new Map<string, HTMLCanvasElement>()
export function getScratch(key: string, w: number, h: number): HTMLCanvasElement {
  let c = scratch.get(key)
  if (!c) {
    c = document.createElement('canvas')
    scratch.set(key, c)
  }
  if (c.width !== w || c.height !== h) {
    c.width = w
    c.height = h
  }
  return c
}

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

export function clampBBox(b: BBox, w: number, h: number): BBox | null {
  const x = Math.max(0, Math.floor(b.x))
  const y = Math.max(0, Math.floor(b.y))
  const x2 = Math.min(w, Math.ceil(b.x + b.w))
  const y2 = Math.min(h, Math.ceil(b.y + b.h))
  if (x2 <= x || y2 <= y) return null
  return { x, y, w: x2 - x, h: y2 - y }
}

export function cropPatch(canvas: HTMLCanvasElement, bbox: BBox) {
  const ctx = canvas.getContext('2d')!
  const b = clampBBox(bbox, canvas.width, canvas.height)
  if (!b) return null
  return { x: b.x, y: b.y, before: ctx.getImageData(b.x, b.y, b.w, b.h) }
}

export function growBBox(a: BBox | null, b: BBox): BBox {
  if (!a) return { ...b }
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  }
}
