'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor } from '@/lib/flipa/store'
import { getLayerCanvas, getScratch, cropPatch, growBBox, clampBBox, type BBox } from '@/lib/flipa/canvases'
import { renderFrame } from '@/lib/flipa/render'
import type { Patch } from '@/lib/flipa/types'
import { X, Trash2 } from 'lucide-react'

interface Pt { x: number; y: number; p?: number }

interface Selection {
  img: HTMLCanvasElement
  w: number
  h: number
  cut: Pt // original position of the cut region
  pos: Pt // current dragged position
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(v, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export default function Stage() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  const meta = useEditor((s) => s.meta)
  const frames = useEditor((s) => s.frames)
  const activeFrameIdx = useEditor((s) => s.activeFrameIdx)
  const activeLayerId = useEditor((s) => s.activeLayerId)
  const tool = useEditor((s) => s.tool)
  const color = useEditor((s) => s.color)
  const brushSize = useEditor((s) => s.brushSize)
  const brushOpacity = useEditor((s) => s.brushOpacity)
  const eraserSize = useEditor((s) => s.eraserSize)
  const bucketTolerance = useEditor((s) => s.bucketTolerance)
  const fontSize = useEditor((s) => s.fontSize)
  const playing = useEditor((s) => s.playing)
  const onion = useEditor((s) => s.onion)
  const dirtyTick = useEditor((s) => s.dirtyTick)
  const setTool = useEditor((s) => s.setTool)
  const setColor = useEditor((s) => s.setColor)
  const commitPatches = useEditor((s) => s.commitPatches)

  const [display, setDisplay] = useState({ w: 0, h: 0 })
  const [selection, setSelection] = useState<Selection | null>(null)
  const selRef = useRef<Selection | null>(null)
  const [textBox, setTextBox] = useState<{ x: number; y: number; value: string } | null>(null)

  const stroke = useRef<{
    mode: 'draw' | 'lasso' | 'drag-sel' | null
    points: Pt[]
    bbox: BBox | null
    dragOff: Pt
    eraser: boolean
  }>({ mode: null, points: [], bbox: null, dragOff: { x: 0, y: 0 }, eraser: false })

  const fit = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap || !meta) return
    const pad = 8
    const cw = wrap.clientWidth - pad * 2
    const ch = wrap.clientHeight - pad * 2
    const s = Math.min(cw / meta.w, ch / meta.h)
    setDisplay({ w: Math.max(40, meta.w * s), h: Math.max(40, meta.h * s) })
  }, [meta])

  useEffect(() => {
    fit()
    const ro = new ResizeObserver(fit)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [fit])

  const paint = useCallback(() => {
    const st = useEditor.getState()
    const canvas = canvasRef.current
    if (!canvas || !st.meta) return
    if (canvas.width !== st.meta.w || canvas.height !== st.meta.h) {
      canvas.width = st.meta.w
      canvas.height = st.meta.h
    }
    const ctx = canvas.getContext('2d')!
    renderFrame(ctx, st.meta, st.frames, st.activeFrameIdx, {
      onion: st.playing ? 'off' : st.onion,
    })
    // overlay: selection + in-progress lasso
    const ov = overlayRef.current
    if (ov) {
      if (ov.width !== st.meta.w || ov.height !== st.meta.h) {
        ov.width = st.meta.w
        ov.height = st.meta.h
      }
      const octx = ov.getContext('2d')!
      octx.clearRect(0, 0, ov.width, ov.height)
      const sel = selRef.current
      if (sel) {
        if (sel.img.width > 0) octx.drawImage(sel.img, sel.pos.x, sel.pos.y)
        octx.strokeStyle = '#2f9bff'
        octx.lineWidth = Math.max(1.5, st.meta.w / 500)
        octx.setLineDash([8, 6])
        octx.strokeRect(sel.pos.x, sel.pos.y, sel.w, sel.h)
        octx.setLineDash([])
      }
      if (stroke.current.mode === 'lasso' && stroke.current.points.length > 1) {
        octx.strokeStyle = '#2f9bff'
        octx.lineWidth = Math.max(1.5, st.meta.w / 500)
        octx.beginPath()
        const pts = stroke.current.points
        octx.moveTo(pts[0].x, pts[0].y)
        for (const p of pts.slice(1)) octx.lineTo(p.x, p.y)
        octx.stroke()
      }
    }
  }, [])

  useEffect(() => {
    paint()
  }, [meta, frames, activeFrameIdx, activeLayerId, onion, playing, dirtyTick, paint])

  const toCanvasPt = (e: PointerEvent | React.PointerEvent): Pt => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * meta!.w,
      y: ((e.clientY - rect.top) / rect.height) * meta!.h,
    }
  }

  // ---------------- selection ops ----------------

  function applySelection() {
    const sel = selRef.current
    selRef.current = null
    setSelection(null)
    if (!sel) return
    const st = useEditor.getState()
    const meta = st.meta
    if (!meta) return
    const layer = st.getActiveLayer()
    if (!layer) return
    const layerCanvas = getLayerCanvas(layer.id, meta.w, meta.h)
    const ctx = layerCanvas.getContext('2d')!
    const cutB: BBox = { x: sel.cut.x, y: sel.cut.y, w: sel.w, h: sel.h }
    const stampB: BBox = { x: sel.pos.x, y: sel.pos.y, w: sel.w, h: sel.h }
    const before = cropPatch(layerCanvas, growBBox(cutB, stampB))
    ctx.drawImage(sel.img, sel.pos.x, sel.pos.y)
    const bbox = growBBox(cutB, stampB)
    const after = ctx.getImageData(
      Math.max(0, Math.floor(bbox.x)), Math.max(0, Math.floor(bbox.y)),
      Math.min(meta.w, Math.ceil(bbox.x + bbox.w)) - Math.max(0, Math.floor(bbox.x)),
      Math.min(meta.h, Math.ceil(bbox.y + bbox.h)) - Math.max(0, Math.floor(bbox.y))
    )
    if (before) {
      const patch: Patch = { layerId: layer.id, x: before.x, y: before.y, before: before.before, after }
      st.commitPatches([patch], [st.activeFrameIdx])
    }
  }

  function cancelSelection() {
    const sel = selRef.current
    selRef.current = null
    setSelection(null)
    if (!sel) return
    const st = useEditor.getState()
    const meta = st.meta
    if (!meta) return
    const layer = st.getActiveLayer()
    if (!layer) return
    // restore pixels to their original spot
    const layerCanvas = getLayerCanvas(layer.id, meta.w, meta.h)
    const ctx = layerCanvas.getContext('2d')!
    const bbox: BBox = { x: sel.cut.x, y: sel.cut.y, w: sel.w, h: sel.h }
    const before = cropPatch(layerCanvas, bbox)
    ctx.drawImage(sel.img, sel.cut.x, sel.cut.y)
    if (before) {
      const after = ctx.getImageData(before.x, before.y, before.before.width, before.before.height)
      st.commitPatches(
        [{ layerId: layer.id, x: before.x, y: before.y, before: before.before, after }],
        [st.activeFrameIdx]
      )
    }
  }

  function deleteSelection() {
    const sel = selRef.current
    selRef.current = null
    setSelection(null)
    if (!sel) return
    const st = useEditor.getState()
    const meta = st.meta
    if (!meta) return
    const layer = st.getActiveLayer()
    if (!layer) return
    const layerCanvas = getLayerCanvas(layer.id, meta.w, meta.h)
    const ctx = layerCanvas.getContext('2d')!
    const bbox: BBox = { x: sel.cut.x, y: sel.cut.y, w: sel.w, h: sel.h }
    const before = cropPatch(layerCanvas, bbox)
    ctx.clearRect(sel.cut.x, sel.cut.y, sel.w, sel.h)
    if (before) {
      const after = ctx.getImageData(before.x, before.y, before.before.width, before.before.height)
      st.commitPatches(
        [{ layerId: layer.id, x: before.x, y: before.y, before: before.before, after }],
        [st.activeFrameIdx]
      )
    }
  }

  // ---------------- flood fill ----------------

  function floodFill(pt: Pt) {
    if (!meta) return
    const st = useEditor.getState()
    const layer = st.getActiveLayer()
    if (!layer) return
    const layerCanvas = getLayerCanvas(layer.id, meta.w, meta.h)
    const ctx = layerCanvas.getContext('2d', { willReadFrequently: true })!
    const w = meta.w
    const h = meta.h
    const sx = Math.floor(pt.x)
    const sy = Math.floor(pt.y)
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return
    const before = cropPatch(layerCanvas, { x: 0, y: 0, w, h })
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const si = (sy * w + sx) * 4
    const tr = d[si], tg = d[si + 1], tb = d[si + 2], ta = d[si + 3]
    const [fr, fg, fb] = hexToRgb(color)
    const fa = Math.round(brushOpacity * 255)
    const tol = bucketTolerance * 4
    if (tr === fr && tg === fg && tb === fb && ta === fa) return
    const match = (i: number) =>
      Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) + Math.abs(d[i + 3] - ta) <= tol
    const visited = new Uint8Array(w * h)
    const stack: number[] = [sx, sy]
    let minX = w, minY = h, maxX = 0, maxY = 0
    while (stack.length) {
      const y = stack.pop()!
      const x0 = stack.pop()!
      let x = x0
      while (x >= 0 && !visited[y * w + x] && match((y * w + x) * 4)) x--
      x++
      let spanUp = false
      let spanDown = false
      while (x < w && !visited[y * w + x] && match((y * w + x) * 4)) {
        const idx4 = (y * w + x) * 4
        d[idx4] = fr
        d[idx4 + 1] = fg
        d[idx4 + 2] = fb
        d[idx4 + 3] = fa
        visited[y * w + x] = 1
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        if (y > 0) {
          const up = !visited[(y - 1) * w + x] && match(((y - 1) * w + x) * 4)
          if (up && !spanUp) { stack.push(x, y - 1); spanUp = true } else if (!up) spanUp = false
        }
        if (y < h - 1) {
          const dn = !visited[(y + 1) * w + x] && match(((y + 1) * w + x) * 4)
          if (dn && !spanDown) { stack.push(x, y + 1); spanDown = true } else if (!dn) spanDown = false
        }
        x++
      }
    }
    const bbox = clampBBox({ x: minX - 1, y: minY - 1, w: maxX - minX + 3, h: maxY - minY + 3 }, w, h)
    if (bbox) {
      ctx.putImageData(img, 0, 0)
      const after = ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h)
      if (before) {
        commitPatches(
          [{ layerId: layer.id, x: before.x, y: before.y, before: before.before, after }],
          [useEditor.getState().activeFrameIdx]
        )
      }
    }
  }

  // ---------------- pointer handlers ----------------

  function beginStroke(e: React.PointerEvent) {
    if (!meta) return
    const st = useEditor.getState()
    const layer = st.getActiveLayer()
    if (!layer) return
    const isEraser = tool === 'eraser'
    const size = isEraser ? eraserSize : brushSize
    const sc = getScratch('stroke', meta.w, meta.h)
    const sctx = sc.getContext('2d')!
    sctx.clearRect(0, 0, meta.w, meta.h)
    // snapshot base (bg + onion + other layers) for live preview
    const base = getScratch('base', meta.w, meta.h)
    const bctx = base.getContext('2d')!
    bctx.fillStyle = meta.bg
    bctx.fillRect(0, 0, meta.w, meta.h)
    if (!st.playing && st.onion !== 'off') {
      const frameC = getScratch('onion-view', meta.w, meta.h)
      const fctx = frameC.getContext('2d')!
      fctx.clearRect(0, 0, meta.w, meta.h)
      renderFrame(fctx, meta, st.frames, st.activeFrameIdx, { onion: st.onion })
      bctx.drawImage(frameC, 0, 0)
    }
    for (const l of st.frames[st.activeFrameIdx].layers) {
      if (!l.visible || l.id === layer.id) continue
      bctx.globalAlpha = l.opacity
      bctx.drawImage(getLayerCanvas(l.id, meta.w, meta.h), 0, 0)
    }
    bctx.globalAlpha = 1
    // hide the active layer content from base; it is drawn live
    const p = toCanvasPt(e)
    stroke.current = { mode: 'draw', points: [p], bbox: { x: p.x - size, y: p.y - size, w: size * 2, h: size * 2 }, dragOff: { x: 0, y: 0 }, eraser: isEraser }
    // dot on tap
    sctx.fillStyle = isEraser ? '#000000' : color
    sctx.beginPath()
    sctx.arc(p.x, p.y, Math.max(0.5, size / 2), 0, Math.PI * 2)
    sctx.fill()
    livePreview(p)
  }

  function livePreview(pt?: Pt) {
    if (!meta) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const base = getScratch('base', meta.w, meta.h)
    const st = useEditor.getState()
    const layer = st.getActiveLayer()
    if (!layer) return
    const layerCanvas = getLayerCanvas(layer.id, meta.w, meta.h)
    ctx.clearRect(0, 0, meta.w, meta.h)
    ctx.drawImage(base, 0, 0)
    const sc = getScratch('stroke', meta.w, meta.h)
    const sctx = sc.getContext('2d', { willReadFrequently: true })!
    if (stroke.current.eraser) {
      // preview: active layer minus stroke
      const tmp = getScratch('erase', meta.w, meta.h)
      const tctx = tmp.getContext('2d')!
      tctx.clearRect(0, 0, meta.w, meta.h)
      tctx.drawImage(layerCanvas, 0, 0)
      tctx.globalCompositeOperation = 'destination-out'
      tctx.drawImage(sc, 0, 0)
      tctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(tmp, 0, 0)
    } else {
      ctx.drawImage(layerCanvas, 0, 0)
      ctx.globalAlpha = brushOpacity
      ctx.drawImage(sc, 0, 0)
      ctx.globalAlpha = 1
    }
  }

  function extendStroke(e: React.PointerEvent) {
    if (!meta || stroke.current.mode !== 'draw') return
    const st = useEditor.getState()
    const size = stroke.current.eraser ? st.eraserSize : st.brushSize
    const sc = getScratch('stroke', meta.w, meta.h)
    const sctx = sc.getContext('2d')!
    sctx.strokeStyle = stroke.current.eraser ? '#000000' : st.color
    sctx.lineWidth = size
    sctx.lineCap = 'round'
    sctx.lineJoin = 'round'
    const native = e.nativeEvent as PointerEvent
    const events: (PointerEvent | React.PointerEvent)[] =
      typeof native.getCoalescedEvents === 'function' && native.getCoalescedEvents().length
        ? native.getCoalescedEvents()
        : [native]
    const pts = stroke.current.points
    let last = pts[pts.length - 1]
    for (const ev of events) {
      const p = toCanvasPt(ev as PointerEvent)
      pts.push(p)
      const mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 }
      sctx.beginPath()
      sctx.moveTo(last.x, last.y)
      sctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y)
      sctx.lineTo(p.x, p.y)
      sctx.stroke()
      last = p
      stroke.current.bbox = growBBox(stroke.current.bbox, { x: p.x - size, y: p.y - size, w: size * 2, h: size * 2 })
    }
    stroke.current.bbox = growBBox(stroke.current.bbox, { x: last.x - size, y: last.y - size, w: size * 2, h: size * 2 })
    livePreview()
  }

  function endStroke() {
    if (!meta || stroke.current.mode !== 'draw') return
    const st = useEditor.getState()
    const layer = st.getActiveLayer()
    if (!layer) return
    const layerCanvas = getLayerCanvas(layer.id, meta.w, meta.h)
    const ctx = layerCanvas.getContext('2d')!
    const sc = getScratch('stroke', meta.w, meta.h)
    const bbox = clampBBox(stroke.current.bbox!, meta.w, meta.h)
    if (bbox) {
      const before = cropPatch(layerCanvas, bbox)
      ctx.save()
      if (stroke.current.eraser) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.drawImage(sc, 0, 0)
      } else {
        ctx.globalAlpha = st.brushOpacity
        ctx.drawImage(sc, 0, 0)
      }
      ctx.restore()
      if (before) {
        const after = ctx.getImageData(before.x, before.y, before.before.width, before.before.height)
        commitPatches(
          [{ layerId: layer.id, x: before.x, y: before.y, before: before.before, after }],
          [st.activeFrameIdx]
        )
      }
    }
    stroke.current.mode = null
    paint()
  }

  function buildSelectionFromPath() {
    if (!meta) return
    const st = useEditor.getState()
    const layer = st.getActiveLayer()
    const pts = stroke.current.points
    stroke.current.mode = null
    if (!layer || pts.length < 3) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of pts) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y)
    }
    const bbox = clampBBox({ x: minX - 2, y: minY - 2, w: maxX - minX + 4, h: maxY - minY + 4 }, meta.w, meta.h)
    if (!bbox || bbox.w < 4 || bbox.h < 4) return
    // cut pixels into floating canvas
    const img = document.createElement('canvas')
    img.width = bbox.w
    img.height = bbox.h
    const layerCanvas = getLayerCanvas(layer.id, meta.w, meta.h)
    const lctx = layerCanvas.getContext('2d', { willReadFrequently: true })!
    img.getContext('2d')!.drawImage(layerCanvas, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, bbox.w, bbox.h)
    lctx.clearRect(bbox.x, bbox.y, bbox.w, bbox.h)
    const sel: Selection = {
      img,
      w: bbox.w,
      h: bbox.h,
      cut: { x: bbox.x, y: bbox.y },
      pos: { x: bbox.x, y: bbox.y },
    }
    selRef.current = sel
    setSelection(sel)
    paint()
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!meta || playing) return
    e.preventDefault()
    try {
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // synthetic pointers / already-released pointers cannot be captured
    }
    const p = toCanvasPt(e)

    if (tool === 'eyedropper') {
      const canvas = canvasRef.current!
      const ctx = canvas.getContext('2d')!
      const d = ctx.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data
      if (d[3] > 0) {
        const hex = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')
        setColor(hex)
      }
      return
    }

    if (tool === 'bucket') {
      floodFill(p)
      return
    }

    if (tool === 'text') {
      setTextBox({ x: p.x, y: p.y, value: '' })
      return
    }

    if (tool === 'lasso') {
      const sel = selRef.current
      if (sel && p.x >= sel.pos.x && p.x <= sel.pos.x + sel.w && p.y >= sel.pos.y && p.y <= sel.pos.y + sel.h) {
        stroke.current.mode = 'drag-sel'
        stroke.current.dragOff = { x: p.x - sel.pos.x, y: p.y - sel.pos.y }
        return
      }
      if (sel) applySelection()
      stroke.current.mode = 'lasso'
      stroke.current.points = [p]
      return
    }

    if (selRef.current) applySelection()
    beginStroke(e)
  }

  function onPointerMove(e: React.PointerEvent) {
    const sm = stroke.current
    if (sm.mode === 'draw') extendStroke(e)
    else if (sm.mode === 'lasso') {
      sm.points.push(toCanvasPt(e))
      paint()
    } else if (sm.mode === 'drag-sel' && selRef.current) {
      const p = toCanvasPt(e)
      selRef.current.pos = { x: p.x - sm.dragOff.x, y: p.y - sm.dragOff.y }
      setSelection({ ...selRef.current })
      paint()
    }
  }

  function onPointerUp() {
    const sm = stroke.current
    if (sm.mode === 'draw') endStroke()
    else if (sm.mode === 'lasso') buildSelectionFromPath()
    else if (sm.mode === 'drag-sel') {
      sm.mode = null
      paint()
    }
  }

  // ---------------- text tool ----------------

  function commitText() {
    if (!meta || !textBox || !textBox.value.trim()) {
      setTextBox(null)
      return
    }
    const st = useEditor.getState()
    const layer = st.getActiveLayer()
    if (!layer) return
    const layerCanvas = getLayerCanvas(layer.id, meta.w, meta.h)
    const ctx = layerCanvas.getContext('2d')!
    ctx.save()
    ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`
    ctx.fillStyle = st.color
    ctx.textBaseline = 'middle'
    const m = ctx.measureText(textBox.value)
    const bbox: BBox = { x: textBox.x - 4, y: textBox.y - fontSize, w: m.width + 8, h: fontSize * 1.4 }
    const before = cropPatch(layerCanvas, bbox)
    ctx.fillText(textBox.value, textBox.x, textBox.y)
    ctx.restore()
    if (before) {
      const after = ctx.getImageData(before.x, before.y, before.before.width, before.before.height)
      commitPatches(
        [{ layerId: layer.id, x: before.x, y: before.y, before: before.before, after }],
        [st.activeFrameIdx]
      )
    }
    setTextBox(null)
  }

  // apply/abandon selection when tool / frame / playback changes.
  // Uses a zustand subscription (external system) instead of a render-phase effect.
  const selOps = useRef<{ apply: () => void }>({ apply: () => {} })
  useEffect(() => {
    selOps.current.apply = applySelection
  })
  useEffect(() => {
    const unsub = useEditor.subscribe((s, p) => {
      const frameChanged =
        s.activeFrameIdx !== p.activeFrameIdx || s.playing !== p.playing || s.meta !== p.meta
      const toolChangedAway = s.tool !== p.tool && s.tool !== 'lasso'
      if (frameChanged) {
        selOps.current.apply()
        setTextBox(null)
      } else if (toolChangedAway) {
        selOps.current.apply()
      }
    })
    return () => {
      unsub()
    }
  }, [])

  if (!meta) return null

  const scale = display.w / meta.w
  const tbLeft = textBox ? textBox.x * scale : 0
  const tbTop = textBox ? textBox.y * scale : 0
  const selScreen = selection
    ? { left: selection.pos.x * scale, top: selection.pos.y * scale, w: selection.w * scale, h: selection.h * scale }
    : null

  return (
    <div ref={wrapRef} className="relative flex-1 flex items-center justify-center overflow-hidden bg-[#141416] min-h-0">
      <div className="relative shadow-2xl" style={{ width: display.w, height: display.h }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 touch-none select-none"
          style={{ width: display.w, height: display.h, cursor: tool === 'lasso' ? 'crosshair' : 'crosshair' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 pointer-events-none touch-none"
          style={{ width: display.w, height: display.h }}
        />
        {selScreen && (
          <div className="absolute z-20 flex gap-1.5" style={{ left: selScreen.left, top: selScreen.top - 40 }}>
            <button
              aria-label="Cancel selection"
              className="w-9 h-9 rounded-full bg-[#2a2b30] text-white flex items-center justify-center shadow-lg active:scale-95"
              onClick={cancelSelection}
            >
              <X className="w-4 h-4" />
            </button>
            <button
              aria-label="Delete selection"
              className="w-9 h-9 rounded-full bg-[#2a2b30] text-red-400 flex items-center justify-center shadow-lg active:scale-95"
              onClick={deleteSelection}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
        {textBox && (
          <input
            autoFocus
            value={textBox.value}
            onChange={(e) => setTextBox({ ...textBox, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitText()
              if (e.key === 'Escape') setTextBox(null)
              e.stopPropagation()
            }}
            onBlur={commitText}
            placeholder="Type text…"
            className="absolute z-30 px-1 bg-white/95 border-2 border-[#2f9bff] rounded outline-none text-black"
            style={{
              left: tbLeft,
              top: tbTop - fontSize * scale * 0.6,
              fontSize: Math.max(12, fontSize * scale),
              minWidth: 120,
              width: Math.max(140, 12 * textBox.value.length * Math.max(12, fontSize * scale) * 0.02 + 60),
            }}
          />
        )}
      </div>
    </div>
  )
}
