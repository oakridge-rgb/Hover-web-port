'use client'

import { create } from 'zustand'
import type { AudioTrack, Frame, HistEntry, Layer, Patch, ProjectMeta, ToolId } from './types'
import { cloneLayerCanvas, deleteLayerCanvas, getLayerCanvas } from './canvases'
import { makeThumb } from './render'

function uid(n = 10): string {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)]
  return s
}

export interface EditorState {
  meta: ProjectMeta | null
  frames: Frame[]
  activeFrameIdx: number
  activeLayerId: string | null
  tool: ToolId
  color: string
  brushSize: number
  brushOpacity: number
  eraserSize: number
  bucketTolerance: number
  fontSize: number
  onion: 'off' | 'prev' | 'next' | 'both'
  loop: boolean
  playing: boolean
  uiHidden: boolean
  audio: AudioTrack | null
  history: HistEntry[]
  histIdx: number
  clipboard: { index: number; pixels: HTMLCanvasElement }[] | null
  welcomeOpen: boolean
  exportOpen: boolean
  layersOpen: boolean
  audioOpen: boolean
  dirtyTick: number // bumped whenever pixels change (Stage re-render + autosave)

  newProject: (name: string, w: number, h: number, fps: number) => void
  closeToWelcome: () => void
  loadProject: (meta: ProjectMeta, frames: Frame[], pixels: Record<string, HTMLCanvasElement>) => void

  setTool: (t: ToolId) => void
  setColor: (c: string) => void
  setBrushSize: (n: number) => void
  setBrushOpacity: (n: number) => void
  setEraserSize: (n: number) => void
  setBucketTolerance: (n: number) => void
  setFontSize: (n: number) => void
  setOnion: (o: EditorState['onion']) => void
  setLoop: (b: boolean) => void
  setUiHidden: (b: boolean) => void
  setPlaying: (b: boolean) => void
  setDialog: (d: 'welcome' | 'export' | 'layers' | 'audio', open: boolean) => void
  setAudio: (a: AudioTrack | null) => void
  updateMeta: (patch: Partial<ProjectMeta>) => void

  selectFrame: (idx: number) => void
  addFrame: (after?: number, copyContent?: boolean) => void
  duplicateFrame: (idx: number) => void
  deleteFrame: (idx: number) => void

  selectLayer: (id: string) => void
  addLayer: () => void
  duplicateLayer: (id: string) => void
  deleteLayer: (id: string) => void
  toggleLayerVisible: (id: string) => void
  setLayerOpacity: (id: string, opacity: number) => void
  renameLayer: (id: string, name: string) => void
  moveLayer: (id: string, dir: -1 | 1) => void

  getActiveLayer: () => Layer | null
  getActiveLayerCanvas: () => HTMLCanvasElement | null
  commitPatches: (patches: Patch[], thumbs: number[]) => void
  refreshThumb: (idx: number) => void
  undo: () => void
  redo: () => void
  copyFrame: () => void
  pasteFrame: () => void
  clearActiveLayer: () => void
}

const MAX_HISTORY = 60
const MAX_HISTORY_BYTES = 220_000_000

function emptyFrame(): Frame {
  return { id: uid(), layers: [{ id: uid(), name: 'Layer 1', visible: true, opacity: 1 }] }
}

function histBytes(e: HistEntry): number {
  return e.patches.reduce((n, p) => n + p.before.data.length + p.after.data.length, 0)
}

export const useEditor = create<EditorState>((set, get) => ({
  meta: null,
  frames: [],
  activeFrameIdx: 0,
  activeLayerId: null,
  tool: 'brush',
  color: '#1c1c1e',
  brushSize: 8,
  brushOpacity: 1,
  eraserSize: 24,
  bucketTolerance: 32,
  fontSize: 64,
  onion: 'off',
  loop: true,
  playing: false,
  uiHidden: false,
  audio: null,
  history: [],
  histIdx: 0,
  clipboard: null,
  welcomeOpen: true,
  exportOpen: false,
  layersOpen: false,
  audioOpen: false,
  dirtyTick: 0,

  newProject: (name, w, h, fps) => {
    const f = emptyFrame()
    set({
      meta: { id: uid(8), name: name || 'My project', w, h, fps, bg: '#ffffff' },
      frames: [f],
      activeFrameIdx: 0,
      activeLayerId: f.layers[0].id,
      history: [],
      histIdx: 0,
      clipboard: null,
      playing: false,
      uiHidden: false,
      welcomeOpen: false,
      dirtyTick: Date.now(),
    })
  },

  closeToWelcome: () => {
    set({ welcomeOpen: true, playing: false })
  },

  loadProject: (meta, frames, pixels) => {
    // wipe old canvases
    for (const f of get().frames) for (const l of f.layers) deleteLayerCanvas(l.id)
    for (const [id, c] of Object.entries(pixels)) {
      const dst = getLayerCanvas(id, meta.w, meta.h)
      dst.getContext('2d')!.drawImage(c, 0, 0)
    }
    // regenerate timeline thumbnails
    const withThumbs = frames.map((f, i) => ({ ...f, thumb: makeThumb(meta, frames, i) }))
    const activeFrame = withThumbs[0]
    set({
      meta,
      frames: withThumbs,
      activeFrameIdx: 0,
      activeLayerId: activeFrame?.layers[0]?.id ?? null,
      history: [],
      histIdx: 0,
      clipboard: null,
      playing: false,
      welcomeOpen: false,
      dirtyTick: Date.now(),
    })
  },

  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setBrushOpacity: (brushOpacity) => set({ brushOpacity }),
  setEraserSize: (eraserSize) => set({ eraserSize }),
  setBucketTolerance: (bucketTolerance) => set({ bucketTolerance }),
  setFontSize: (fontSize) => set({ fontSize }),
  setOnion: (onion) => set({ onion }),
  setLoop: (loop) => set({ loop }),
  setUiHidden: (uiHidden) => set({ uiHidden }),
  setPlaying: (playing) => set({ playing }),
  setDialog: (d, open) =>
    set(d === 'welcome'
      ? { welcomeOpen: open }
      : d === 'export'
        ? { exportOpen: open }
        : d === 'layers'
          ? { layersOpen: open }
          : { audioOpen: open }),
  setAudio: (audio) => set({ audio }),
  updateMeta: (patch) => set((s) => ({ meta: s.meta ? { ...s.meta, ...patch } : s.meta, dirtyTick: Date.now() })),

  selectFrame: (idx) =>
    set((s) => {
      const i = Math.max(0, Math.min(s.frames.length - 1, idx))
      const f = s.frames[i]
      return {
        activeFrameIdx: i,
        activeLayerId: f.layers.some((l) => l.id === s.activeLayerId) ? s.activeLayerId : f.layers[0]?.id ?? null,
      }
    }),

  addFrame: (after, copyContent) =>
    set((s) => {
      if (!s.meta) return {}
      const src = s.frames[s.activeFrameIdx]
      const f: Frame = copyContent && src
        ? {
            id: uid(),
            layers: src.layers.map((l) => ({ ...l, id: uid() })),
          }
        : emptyFrame()
      if (copyContent && src) {
        src.layers.forEach((l, i) => cloneLayerCanvas(l.id, f.layers[i].id, s.meta!.w, s.meta!.h))
      }
      const frames = [...s.frames]
      const at = (after ?? s.activeFrameIdx) + 1
      frames.splice(at, 0, f)
      return { frames, activeFrameIdx: at, activeLayerId: f.layers[0].id, dirtyTick: Date.now() }
    }),

  duplicateFrame: (idx) => {
    const s = get()
    s.addFrame(idx, true)
  },

  deleteFrame: (idx) =>
    set((s) => {
      if (s.frames.length <= 1) return {}
      const f = s.frames[idx]
      for (const l of f.layers) deleteLayerCanvas(l.id)
      const frames = s.frames.filter((_, i) => i !== idx)
      const activeFrameIdx = Math.min(s.activeFrameIdx, frames.length - 1)
      return {
        frames,
        activeFrameIdx,
        activeLayerId: frames[activeFrameIdx].layers[0]?.id ?? null,
        dirtyTick: Date.now(),
      }
    }),

  selectLayer: (activeLayerId) => set({ activeLayerId }),

  addLayer: () =>
    set((s) => {
      if (!s.meta) return {}
      const f = s.frames[s.activeFrameIdx]
      if (!f) return {}
      const l: Layer = { id: uid(), name: `Layer ${f.layers.length + 1}`, visible: true, opacity: 1 }
      const frames = [...s.frames]
      frames[s.activeFrameIdx] = { ...f, layers: [l, ...f.layers] }
      return { frames, activeLayerId: l.id, dirtyTick: Date.now() }
    }),

  duplicateLayer: (id) =>
    set((s) => {
      if (!s.meta) return {}
      const f = s.frames[s.activeFrameIdx]
      const idx = f.layers.findIndex((l) => l.id === id)
      if (idx < 0 || f.layers.length >= 8) return {}
      const src = f.layers[idx]
      const l: Layer = { ...src, id: uid(), name: `${src.name} copy` }
      cloneLayerCanvas(id, l.id, s.meta.w, s.meta.h)
      const frames = [...s.frames]
      frames[s.activeFrameIdx] = { ...f, layers: [...f.layers.slice(0, idx), l, ...f.layers.slice(idx)] }
      return { frames, activeLayerId: l.id, dirtyTick: Date.now() }
    }),

  deleteLayer: (id) =>
    set((s) => {
      const f = s.frames[s.activeFrameIdx]
      if (!f || f.layers.length <= 1) return {}
      deleteLayerCanvas(id)
      const layers = f.layers.filter((l) => l.id !== id)
      const frames = [...s.frames]
      frames[s.activeFrameIdx] = { ...f, layers }
      return {
        frames,
        activeLayerId: s.activeLayerId === id ? layers[0].id : s.activeLayerId,
        dirtyTick: Date.now(),
      }
    }),

  toggleLayerVisible: (id) =>
    set((s) => {
      const f = s.frames[s.activeFrameIdx]
      const frames = [...s.frames]
      frames[s.activeFrameIdx] = { ...f, layers: f.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)) }
      return { frames, dirtyTick: Date.now() }
    }),

  setLayerOpacity: (id, opacity) =>
    set((s) => {
      const f = s.frames[s.activeFrameIdx]
      const frames = [...s.frames]
      frames[s.activeFrameIdx] = { ...f, layers: f.layers.map((l) => (l.id === id ? { ...l, opacity } : l)) }
      return { frames, dirtyTick: Date.now() }
    }),

  renameLayer: (id, name) =>
    set((s) => {
      const f = s.frames[s.activeFrameIdx]
      const frames = [...s.frames]
      frames[s.activeFrameIdx] = { ...f, layers: f.layers.map((l) => (l.id === id ? { ...l, name } : l)) }
      return { frames }
    }),

  moveLayer: (id, dir) =>
    set((s) => {
      const f = s.frames[s.activeFrameIdx]
      const idx = f.layers.findIndex((l) => l.id === id)
      const to = idx + dir
      if (idx < 0 || to < 0 || to >= f.layers.length) return {}
      const layers = [...f.layers]
      const [it] = layers.splice(idx, 1)
      layers.splice(to, 0, it)
      const frames = [...s.frames]
      frames[s.activeFrameIdx] = { ...f, layers }
      return { frames, dirtyTick: Date.now() }
    }),

  getActiveLayer: () => {
    const s = get()
    const f = s.frames[s.activeFrameIdx]
    return f?.layers.find((l) => l.id === s.activeLayerId) ?? f?.layers[0] ?? null
  },

  getActiveLayerCanvas: () => {
    const s = get()
    const l = s.getActiveLayer()
    if (!l || !s.meta) return null
    return getLayerCanvas(l.id, s.meta.w, s.meta.h)
  },

  commitPatches: (patches, thumbs) => {
    if (patches.length === 0) return
    set((s) => {
      let history = s.history.slice(0, s.histIdx)
      history = [...history, { patches }]
      // cap by count and rough bytes
      while (history.length > MAX_HISTORY) history.shift()
      let bytes = history.reduce((n, e) => n + histBytes(e), 0)
      while (bytes > MAX_HISTORY_BYTES && history.length > 1) {
        bytes -= histBytes(history[0])
        history.shift()
      }
      const frames = [...s.frames]
      for (const idx of thumbs) {
        if (frames[idx]) frames[idx] = { ...frames[idx], thumb: makeThumb(s.meta!, frames, idx) }
      }
      return { history, histIdx: history.length, frames, dirtyTick: Date.now() }
    })
  },

  refreshThumb: (idx) =>
    set((s) => {
      if (!s.meta || !s.frames[idx]) return {}
      const frames = [...s.frames]
      frames[idx] = { ...frames[idx], thumb: makeThumb(s.meta, frames, idx) }
      return { frames }
    }),

  undo: () =>
    set((s) => {
      if (s.histIdx <= 0) return {}
      const e = s.history[s.histIdx - 1]
      const frames = [...s.frames]
      const thumbs = new Set<number>()
      for (const p of e.patches) {
        const exists = s.frames.some((f) => f.layers.some((x) => x.id === p.layerId))
        if (!exists || !s.meta) continue
        const layerCanvas = getLayerCanvas(p.layerId, s.meta.w, s.meta.h)
        const ctx = layerCanvas.getContext('2d')!
        ctx.clearRect(p.x, p.y, p.before.width, p.before.height)
        ctx.putImageData(p.before, p.x, p.y)
        s.frames.forEach((f, i) => {
          if (f.layers.some((l) => l.id === p.layerId)) thumbs.add(i)
        })
      }
      for (const idx of thumbs) {
        if (frames[idx]) frames[idx] = { ...frames[idx], thumb: makeThumb(s.meta!, frames, idx) }
      }
      return { histIdx: s.histIdx - 1, frames, dirtyTick: Date.now() }
    }),

  redo: () =>
    set((s) => {
      if (s.histIdx >= s.history.length) return {}
      const e = s.history[s.histIdx]
      const frames = [...s.frames]
      const thumbs = new Set<number>()
      for (const p of e.patches) {
        if (!s.meta) continue
        const layerCanvas = getLayerCanvas(p.layerId, s.meta.w, s.meta.h)
        const ctx = layerCanvas.getContext('2d')!
        ctx.clearRect(p.x, p.y, p.after.width, p.after.height)
        ctx.putImageData(p.after, p.x, p.y)
        s.frames.forEach((f, i) => {
          if (f.layers.some((l) => l.id === p.layerId)) thumbs.add(i)
        })
      }
      for (const idx of thumbs) {
        if (frames[idx]) frames[idx] = { ...frames[idx], thumb: makeThumb(s.meta!, frames, idx) }
      }
      return { histIdx: s.histIdx + 1, frames, dirtyTick: Date.now() }
    }),

  copyFrame: () =>
    set((s) => {
      if (!s.meta) return {}
      const f = s.frames[s.activeFrameIdx]
      const pixels = f.layers.map((l, index) => {
        const c = document.createElement('canvas')
        c.width = s.meta!.w
        c.height = s.meta!.h
        c.getContext('2d')!.drawImage(getLayerCanvas(l.id, s.meta!.w, s.meta!.h), 0, 0)
        return { index, pixels: c }
      })
      return { clipboard: pixels }
    }),

  pasteFrame: () => {
    const s = get()
    if (!s.clipboard || !s.meta) return
    const f = s.frames[s.activeFrameIdx]
    const patches: Patch[] = []
    const w = s.meta.w
    const h = s.meta.h
    for (const { index, pixels } of s.clipboard) {
      const target = f.layers[index]
      if (!target) continue
      const layerCanvas = getLayerCanvas(target.id, w, h)
      const ctx = layerCanvas.getContext('2d')!
      const before = ctx.getImageData(0, 0, w, h)
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(pixels, 0, 0)
      patches.push({ layerId: target.id, x: 0, y: 0, before, after: ctx.getImageData(0, 0, w, h) })
    }
    if (patches.length) s.commitPatches(patches, [s.activeFrameIdx])
  },

  clearActiveLayer: () => {
    const s = get()
    const l = s.getActiveLayer()
    if (!l || !s.meta) return
    const layerCanvas = getLayerCanvas(l.id, s.meta.w, s.meta.h)
    const ctx = layerCanvas.getContext('2d')!
    const before = ctx.getImageData(0, 0, s.meta.w, s.meta.h)
    ctx.clearRect(0, 0, s.meta.w, s.meta.h)
    s.commitPatches(
      [{ layerId: l.id, x: 0, y: 0, before, after: ctx.getImageData(0, 0, s.meta.w, s.meta.h) }],
      [s.activeFrameIdx]
    )
  },
}))

// dev/testing aid: expose store for browser-console debugging
if (typeof window !== 'undefined') {
  ;(window as unknown as { __editor: typeof useEditor }).__editor = useEditor
}
