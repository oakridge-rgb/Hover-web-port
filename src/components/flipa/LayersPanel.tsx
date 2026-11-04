'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Plus, CopyPlus, Trash2, ArrowUp, ArrowDown, ChevronUp, ChevronDown } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useEditor } from '@/lib/flipa/store'
import { getLayerCanvas } from '@/lib/flipa/canvases'

function LayerThumb({ layerId, w, h }: { layerId: string; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const dirtyTick = useEditor((s) => s.dirtyTick)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    if (getLayerCanvas(layerId, w, h).width > 0) {
      ctx.drawImage(getLayerCanvas(layerId, w, h), 0, 0, c.width, c.height)
    }
  }, [layerId, w, h, dirtyTick])
  return <canvas ref={ref} width={56} height={56} className="rounded-lg bg-white shrink-0" />
}

export default function LayersPanel() {
  const open = useEditor((s) => s.layersOpen)
  const setDialog = useEditor((s) => s.setDialog)
  const meta = useEditor((s) => s.meta)
  const frames = useEditor((s) => s.frames)
  const activeFrameIdx = useEditor((s) => s.activeFrameIdx)
  const activeLayerId = useEditor((s) => s.activeLayerId)
  const addLayer = useEditor((s) => s.addLayer)
  const duplicateLayer = useEditor((s) => s.duplicateLayer)
  const deleteLayer = useEditor((s) => s.deleteLayer)
  const toggleLayerVisible = useEditor((s) => s.toggleLayerVisible)
  const setLayerOpacity = useEditor((s) => s.setLayerOpacity)
  const renameLayer = useEditor((s) => s.renameLayer)
  const moveLayer = useEditor((s) => s.moveLayer)
  const selectLayer = useEditor((s) => s.selectLayer)

  const [renaming, setRenaming] = useState<string | null>(null)
  const [name, setName] = useState('')

  if (!meta) return null
  const frame = frames[activeFrameIdx]
  const layersTopFirst = [...frame.layers].reverse()

  return (
    <Sheet open={open} onOpenChange={(o) => setDialog('layers', o)}>
      <SheetContent side="right" className="bg-[#232427] border-white/10 text-white w-[320px] sm:w-[360px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2 flex-row items-center justify-between">
          <SheetTitle className="text-white font-extrabold tracking-wide">LAYERS</SheetTitle>
          <button
            aria-label="Add layer"
            onClick={addLayer}
            className="w-10 h-10 rounded-xl bg-[#2f9bff] text-white flex items-center justify-center active:scale-95 transition"
          >
            <Plus className="w-5 h-5" strokeWidth={2.4} />
          </button>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-1.5">
          {layersTopFirst.map((l) => {
            const active = l.id === activeLayerId
            const idx = frame.layers.findIndex((x) => x.id === l.id)
            return (
              <div
                key={l.id}
                className={cn(
                  'rounded-xl border transition bg-[#2a2b30]',
                  active ? 'border-[#2f9bff]' : 'border-white/10'
                )}
              >
                <div
                  className="flex items-center gap-3 p-2 cursor-pointer"
                  onClick={() => selectLayer(l.id)}
                >
                  <LayerThumb layerId={l.id} w={meta.w} h={meta.h} />
                  <div className="flex-1 min-w-0">
                    {renaming === l.id ? (
                      <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            renameLayer(l.id, name.trim() || l.name)
                            setRenaming(null)
                          }
                          if (e.key === 'Escape') setRenaming(null)
                        }}
                        className="w-full bg-white/10 rounded px-2 py-1 text-sm outline-none border border-[#2f9bff]"
                      />
                    ) : (
                      <div
                        className="font-bold text-sm truncate"
                        onDoubleClick={() => {
                          setRenaming(l.id)
                          setName(l.name)
                        }}
                        title="Double-click to rename"
                      >
                        {l.name}
                      </div>
                    )}
                    {active && (
                      <div className="mt-1.5 pr-1">
                        <Slider
                          value={[l.opacity * 100]}
                          min={5}
                          max={100}
                          step={5}
                          onValueChange={([v]) => setLayerOpacity(l.id, v / 100)}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    aria-label={l.visible ? 'Hide layer' : 'Show layer'}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleLayerVisible(l.id)
                    }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/10"
                  >
                    {l.visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5 text-white/40" />}
                  </button>
                </div>
                {active && (
                  <div className="flex items-center justify-end gap-1 px-2 pb-2">
                    <button
                      aria-label="Move layer down"
                      disabled={idx === 0}
                      onClick={() => moveLayer(l.id, -1)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/10 disabled:text-white/25"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                    <button
                      aria-label="Move layer up"
                      disabled={idx === frame.layers.length - 1}
                      onClick={() => moveLayer(l.id, 1)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/10 disabled:text-white/25"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <button
                      aria-label="Duplicate layer"
                      disabled={frame.layers.length >= 8}
                      onClick={() => duplicateLayer(l.id)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/10 disabled:text-white/25"
                    >
                      <CopyPlus className="w-5 h-5" />
                    </button>
                    <button
                      aria-label="Delete layer"
                      disabled={frame.layers.length <= 1}
                      onClick={() => deleteLayer(l.id)}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-red-400 hover:bg-white/10 disabled:text-white/25"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          <p className="text-[11px] text-white/40 px-1 pt-2 flex items-center gap-1.5">
            <ArrowUp className="w-3 h-3" /> Top layer draws in front. Double-click a name to rename (max 8 layers).
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
