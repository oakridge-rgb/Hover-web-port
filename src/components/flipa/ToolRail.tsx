'use client'

import { useState } from 'react'
import {
  Paintbrush,
  Eraser,
  Lasso,
  PaintBucket,
  Type,
  MoreHorizontal,
  Pipette,
  Scan,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useEditor } from '@/lib/flipa/store'
import type { ToolId } from '@/lib/flipa/types'

const SWATCHES = [
  '#1c1c1e', '#ffffff', '#7a7d85', '#c4c6cc',
  '#e0342c', '#f26a1f', '#f7b500', '#ffe14d',
  '#7ac74f', '#2e9e4f', '#28c8b7', '#2f9bff',
  '#1f5fd6', '#6b4fe8', '#b04fe8', '#ef5da8',
  '#8b5a2b', '#f2c6a0', '#0a2f5c', '#87ceeb',
]

function ToolOptions() {
  const tool = useEditor((s) => s.tool)
  const brushSize = useEditor((s) => s.brushSize)
  const brushOpacity = useEditor((s) => s.brushOpacity)
  const eraserSize = useEditor((s) => s.eraserSize)
  const bucketTolerance = useEditor((s) => s.bucketTolerance)
  const fontSize = useEditor((s) => s.fontSize)
  const setBrushSize = useEditor((s) => s.setBrushSize)
  const setBrushOpacity = useEditor((s) => s.setBrushOpacity)
  const setEraserSize = useEditor((s) => s.setEraserSize)
  const setBucketTolerance = useEditor((s) => s.setBucketTolerance)
  const setFontSize = useEditor((s) => s.setFontSize)
  const color = useEditor((s) => s.color)

  if (tool === 'brush' || tool === 'eraser') {
    return (
      <div className="w-56 space-y-4">
        <div>
          <div className="flex justify-between text-xs font-bold text-white/70 mb-1">
            <span>SIZE</span>
            <span>{tool === 'brush' ? brushSize : eraserSize}px</span>
          </div>
          <Slider
            value={[tool === 'brush' ? brushSize : eraserSize]}
            min={1}
            max={tool === 'brush' ? 64 : 128}
            step={1}
            onValueChange={([v]) => (tool === 'brush' ? setBrushSize(v) : setEraserSize(v))}
          />
        </div>
        {tool === 'brush' && (
          <div>
            <div className="flex justify-between text-xs font-bold text-white/70 mb-1">
              <span>OPACITY</span>
              <span>{Math.round(brushOpacity * 100)}%</span>
            </div>
            <Slider
              value={[brushOpacity * 100]}
              min={5}
              max={100}
              step={5}
              onValueChange={([v]) => setBrushOpacity(v / 100)}
            />
          </div>
        )}
        <div className="flex justify-center py-1">
          <div
            className="rounded-full"
            style={{
              width: Math.min(44, (tool === 'brush' ? brushSize : eraserSize) * 1.2),
              height: Math.min(44, (tool === 'brush' ? brushSize : eraserSize) * 1.2),
              background: tool === 'brush' ? color : 'transparent',
              border: tool === 'eraser' ? '2px dashed rgba(255,255,255,.5)' : 'none',
            }}
          />
        </div>
      </div>
    )
  }
  if (tool === 'bucket') {
    return (
      <div className="w-56 space-y-2">
        <div className="flex justify-between text-xs font-bold text-white/70">
          <span>TOLERANCE</span>
          <span>{bucketTolerance}</span>
        </div>
        <Slider
          value={[bucketTolerance]}
          min={0}
          max={128}
          step={1}
          onValueChange={([v]) => setBucketTolerance(v)}
        />
      </div>
    )
  }
  if (tool === 'text') {
    return (
      <div className="w-56 space-y-2">
        <div className="flex justify-between text-xs font-bold text-white/70">
          <span>FONT SIZE</span>
          <span>{fontSize}px</span>
        </div>
        <Slider value={[fontSize]} min={16} max={220} step={2} onValueChange={([v]) => setFontSize(v)} />
      </div>
    )
  }
  return <div className="text-xs text-white/60 w-40">No options for this tool.</div>
}

export default function ToolRail() {
  const tool = useEditor((s) => s.tool)
  const setTool = useEditor((s) => s.setTool)
  const color = useEditor((s) => s.color)
  const setColor = useEditor((s) => s.setColor)
  const clearActiveLayer = useEditor((s) => s.clearActiveLayer)
  const [optsOpen, setOptsOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)

  const tools: { id: ToolId; icon: typeof Paintbrush; label: string }[] = [
    { id: 'brush', icon: Paintbrush, label: 'Brush' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
    { id: 'lasso', icon: Lasso, label: 'Lasso' },
    { id: 'bucket', icon: PaintBucket, label: 'Fill' },
    { id: 'text', icon: Type, label: 'Text' },
  ]

  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3">
      <div className="flex flex-col items-center gap-1 bg-[#26272b]/95 backdrop-blur rounded-2xl shadow-2xl p-1.5 border border-white/5">
        <div className="grid grid-cols-2 gap-[3px] p-1.5 text-white/40" aria-hidden>
          {[...Array(6)].map((_, i) => (
            <span key={i} className="w-[3px] h-[3px] rounded-full bg-current" />
          ))}
        </div>
        {tools.map(({ id, icon: Icon, label }) => (
          <Popover
            key={id}
            open={optsOpen && tool === id}
            onOpenChange={(o) => {
              setOptsOpen(o)
              if (o) setTool(id)
            }}
          >
            <PopoverTrigger asChild>
              <button
                aria-label={label}
                title={label}
                onClick={() => {
                  if (tool === id) setOptsOpen((v) => !v)
                  else {
                    setTool(id)
                    setOptsOpen(false)
                  }
                }}
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center transition active:scale-95',
                  tool === id ? 'bg-[#2f9bff] text-white shadow-lg' : 'text-[#d6d7da] hover:bg-white/10'
                )}
              >
                <Icon className="w-6 h-6" strokeWidth={2.1} />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" sideOffset={10} className="w-auto bg-[#2a2b30] border-white/10 text-white">
              <ToolOptions />
            </PopoverContent>
          </Popover>
        ))}

        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild>
            <button
              aria-label="More tools"
              className="w-12 h-12 rounded-xl flex items-center justify-center text-[#d6d7da] hover:bg-white/10 active:scale-95 transition"
            >
              <MoreHorizontal className="w-6 h-6" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" sideOffset={10} className="w-44 bg-[#2a2b30] border-white/10 text-white p-1.5">
            <button
              className="w-full h-11 px-3 rounded-lg flex items-center gap-3 hover:bg-white/10 text-sm font-semibold"
              onClick={() => {
                setTool('eyedropper')
                setMoreOpen(false)
              }}
            >
              <Pipette className="w-5 h-5" /> Eyedropper
            </button>
            <button
              className="w-full h-11 px-3 rounded-lg flex items-center gap-3 hover:bg-white/10 text-sm font-semibold text-red-400"
              onClick={() => {
                clearActiveLayer()
                setMoreOpen(false)
              }}
            >
              <Scan className="w-5 h-5" /> Clear layer
            </button>
          </PopoverContent>
        </Popover>
      </div>

      <Popover open={colorOpen} onOpenChange={setColorOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label="Color palette"
            className="w-12 h-12 rounded-full border-4 border-[#26272b] shadow-2xl active:scale-95 transition"
            style={{ backgroundColor: color }}
          />
        </PopoverTrigger>
        <PopoverContent side="right" sideOffset={10} className="w-64 bg-[#2a2b30] border-white/10 text-white">
          <div className="grid grid-cols-5 gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className={cn(
                  'w-9 h-9 rounded-full border-2 transition active:scale-90',
                  color.toLowerCase() === c ? 'border-[#2f9bff] scale-110' : 'border-white/15'
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-9 h-9 rounded cursor-pointer bg-transparent"
              aria-label="Custom color"
            />
            <span className="text-xs font-mono text-white/60">{color.toUpperCase()}</span>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
