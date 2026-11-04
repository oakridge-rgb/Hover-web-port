'use client'

import { useEffect, useState } from 'react'
import { Gem, Plus, Trash2, FolderOpen, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEditor } from '@/lib/flipa/store'
import { listProjects, loadProject, deleteProject, type ProjectIndexEntry } from '@/lib/flipa/persist'
import type { SerializedProject } from '@/lib/flipa/types'
import type { ProjectMeta } from '@/lib/flipa/types'

const FORMATS = [
  { label: '16:9 HD', w: 1920, h: 1080 },
  { label: '9:16 Vertical', w: 1080, h: 1920 },
  { label: 'Square', w: 1080, h: 1080 },
  { label: 'Classic 4:3', w: 1024, h: 768 },
]

export default function WelcomeDialog() {
  const open = useEditor((s) => s.welcomeOpen)
  const meta = useEditor((s) => s.meta)
  const newProject = useEditor((s) => s.newProject)
  const loadProjectStore = useEditor((s) => s.loadProject)

  const [name, setName] = useState('My animation')
  const [fmt, setFmt] = useState(FORMATS[0])
  const [fps, setFps] = useState(24)
  const [projects, setProjects] = useState<ProjectIndexEntry[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const refresh = () => listProjects().then(setProjects).catch(() => setProjects([]))
  useEffect(() => {
    if (open) refresh()
  }, [open])

  async function openProject(id: string) {
    setLoadingId(id)
    try {
      const data = await loadProject(id)
      if (!data) return
      const pixels: Record<string, HTMLCanvasElement> = {}
      await Promise.all(
        data.frames.map(
          (f) =>
            new Promise<void>((resolve) => {
              let pending = 0
              const done = () => {
                pending--
                if (pending <= 0) resolve()
              }
              for (const [layerId, src] of Object.entries(f.pixels)) {
                pending++
                const img = new Image()
                img.onload = () => {
                  const c = document.createElement('canvas')
                  c.width = data.meta.w
                  c.height = data.meta.h
                  c.getContext('2d')!.drawImage(img, 0, 0)
                  pixels[layerId] = c
                  done()
                }
                img.onerror = done
                img.src = src
              }
              if (pending <= 0) resolve()
            })
        )
      )
      loadProjectStore(data.meta as ProjectMeta, data.frames.map((f) => ({ id: f.id, layers: f.layers })), pixels)
    } finally {
      setLoadingId(null)
    }
  }

  async function removeProject(id: string) {
    await deleteProject(id)
    refresh()
  }

  async function serializeCurrent(): Promise<SerializedProject | null> {
    const st = useEditor.getState()
    if (!st.meta) return null
    const { getLayerCanvas } = await import('@/lib/flipa/canvases')
    const frames = st.frames.map((f) => {
      const pixels: Record<string, string> = {}
      for (const l of f.layers) {
        pixels[l.id] = getLayerCanvas(l.id, st.meta!.w, st.meta!.h).toDataURL('image/webp', 0.85)
      }
      return { id: f.id, layers: f.layers, pixels }
    })
    return { version: 1, meta: st.meta, frames }
  }

  // expose autosave to EditorApp
  useEffect(() => {
    ;(window as unknown as { __flipaSave?: () => Promise<void> }).__flipaSave = async () => {
      const data = await serializeCurrent()
      if (data) await import('@/lib/flipa/persist').then((m) => m.saveProject(data))
    }
  }, [])

  return (
    <Dialog open={open}>
      <DialogContent
        className="bg-[#1d1e21] border-white/10 text-white sm:max-w-lg max-h-[90dvh] overflow-y-auto"
        onInteractOutside={(e) => !meta && e.preventDefault()}
        onEscapeKeyDown={(e) => !meta && e.preventDefault()}
        showCloseButton={!!meta}
      >
        <DialogHeader className="items-center text-center pt-2">
          <div className="flex items-center gap-2">
            <Gem className="w-7 h-7 text-[#2f9bff]" fill="#2f9bff" />
            <DialogTitle className="text-2xl font-black tracking-tight">FlipaDraw</DialogTitle>
          </div>
          <p className="text-sm text-white/50 -mt-1">Frame-by-frame animation · export GIF &amp; MP4</p>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-[11px] font-bold tracking-widest text-white/50">NEW PROJECT</div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="bg-white/10 border-white/15 h-11"
          />
          <div className="grid grid-cols-2 gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f.label}
                onClick={() => setFmt(f)}
                className={cn(
                  'h-10 rounded-xl text-xs font-bold transition active:scale-95',
                  fmt.label === f.label ? 'bg-[#2f9bff] text-white' : 'bg-white/10 text-white/80 hover:bg-white/15'
                )}
              >
                {f.label}
                <span className="block text-[9px] font-semibold opacity-70">
                  {f.w}×{f.h}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold tracking-widest text-white/50 mr-1">FPS</span>
            {[12, 24, 30].map((f) => (
              <button
                key={f}
                onClick={() => setFps(f)}
                className={cn(
                  'h-9 flex-1 rounded-xl text-xs font-bold transition active:scale-95',
                  fps === f ? 'bg-[#2f9bff] text-white' : 'bg-white/10 text-white/80 hover:bg-white/15'
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => newProject(name.trim() || 'My animation', fmt.w, fmt.h, fps)}
            className="w-full h-12 rounded-xl bg-[#2f9bff] hover:bg-[#1f8bef] text-white font-extrabold tracking-wide flex items-center justify-center gap-2 active:scale-[.99] transition"
          >
            <Plus className="w-5 h-5" strokeWidth={2.6} /> Create project
          </button>
        </div>

        {projects.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold tracking-widest text-white/50 pt-1">SAVED PROJECTS</div>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5 transition hover:bg-white/10',
                    meta?.id === p.id && 'ring-1 ring-[#2f9bff]'
                  )}
                >
                  <button className="flex-1 min-w-0 text-left" onClick={() => openProject(p.id)}>
                    <div className="font-bold text-sm truncate">{p.name}</div>
                    <div className="text-[11px] text-white/40">
                      {p.frames} frames · {p.w}×{p.h} · {new Date(p.updatedAt).toLocaleString()}
                    </div>
                  </button>
                  {loadingId === p.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-[#2f9bff]" />
                  ) : (
                    <button
                      aria-label={`Open ${p.name}`}
                      onClick={() => openProject(p.id)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-[#2f9bff] hover:bg-white/10"
                    >
                      <FolderOpen className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    aria-label={`Delete ${p.name}`}
                    onClick={() => removeProject(p.id)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-red-400 hover:bg-white/10"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
