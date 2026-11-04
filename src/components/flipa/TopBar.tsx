'use client'

import { useState } from 'react'
import { X, Share, MoreVertical, Scan, Gem, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEditor } from '@/lib/flipa/store'

const BG_SWATCHES = ['#ffffff', '#f5f0e6', '#d9e7f5', '#e7f5d9', '#f5d9e7', '#111111']
const FPS_OPTIONS = [8, 12, 24, 30]

export default function TopBar() {
  const meta = useEditor((s) => s.meta)
  const onion = useEditor((s) => s.onion)
  const loop = useEditor((s) => s.loop)
  const setOnion = useEditor((s) => s.setOnion)
  const setLoop = useEditor((s) => s.setLoop)
  const updateMeta = useEditor((s) => s.updateMeta)
  const setDialog = useEditor((s) => s.setDialog)
  const setUiHidden = useEditor((s) => s.setUiHidden)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [name, setName] = useState(meta?.name ?? '')

  if (!meta) return null

  return (
    <header className="h-14 shrink-0 bg-[#232427] flex items-center justify-between px-2 relative z-40">
      <div className="flex items-center gap-1">
        <button
          aria-label="Close project"
          onClick={() => setDialog('welcome', true)}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition"
        >
          <X className="w-6 h-6" strokeWidth={2.4} />
        </button>
        <div className="w-11 h-11 flex items-center justify-center" aria-label="FlipaDraw">
          <Gem className="w-6 h-6 text-[#2f9bff]" fill="#2f9bff" />
        </div>
      </div>

      <button
        aria-label="Hide interface"
        onClick={() => setUiHidden(true)}
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl hover:bg-white/10 active:scale-95 transition text-[#e8e8ea]"
      >
        <Scan className="w-6 h-6" strokeWidth={2.2} />
        <span className="text-[10px] font-bold tracking-widest">HIDE</span>
      </button>

      <div className="flex items-center gap-1">
        <button
          aria-label="Export animation"
          onClick={() => setDialog('export', true)}
          className="w-11 h-11 rounded-xl flex items-center justify-center text-[#2f9bff] hover:bg-white/10 active:scale-95 transition"
        >
          <Share className="w-6 h-6" strokeWidth={2.2} />
        </button>
        <Popover open={settingsOpen} onOpenChange={(o) => { setSettingsOpen(o); if (o) setName(meta.name) }}>
          <PopoverTrigger asChild>
            <button
              aria-label="Project settings"
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition"
            >
              <MoreVertical className="w-6 h-6" strokeWidth={2.4} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-72 bg-[#2a2b30] border-white/10 text-white">
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-bold tracking-widest text-white/60 mb-1.5">PROJECT NAME</div>
                <div className="flex gap-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-white/10 border-white/15 h-9" />
                  <button
                    className="h-9 px-3 rounded-md bg-[#2f9bff] text-white text-xs font-bold"
                    onClick={() => updateMeta({ name: name.trim() || 'My project' })}
                  >
                    Save
                  </button>
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold tracking-widest text-white/60 mb-1.5">ONION SKIN</div>
                <div className="grid grid-cols-4 gap-1">
                  {(['off', 'prev', 'both', 'next'] as const).map((o) => (
                    <button
                      key={o}
                      onClick={() => setOnion(o)}
                      className={cn(
                        'h-8 rounded-md text-[11px] font-bold capitalize',
                        onion === o ? 'bg-[#2f9bff] text-white' : 'bg-white/10 text-white/80 hover:bg-white/15'
                      )}
                    >
                      {o === 'both' ? 'P+N' : o}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold tracking-widest text-white/60 mb-1.5">FRAMES PER SECOND</div>
                <div className="grid grid-cols-4 gap-1">
                  {FPS_OPTIONS.map((f) => (
                    <button
                      key={f}
                      onClick={() => updateMeta({ fps: f })}
                      className={cn(
                        'h-8 rounded-md text-[11px] font-bold',
                        meta.fps === f ? 'bg-[#2f9bff] text-white' : 'bg-white/10 text-white/80 hover:bg-white/15'
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Loop playback</span>
                <Switch checked={loop} onCheckedChange={setLoop} />
              </div>
              <div>
                <div className="text-[11px] font-bold tracking-widest text-white/60 mb-1.5">CANVAS BACKGROUND</div>
                <div className="flex gap-2">
                  {BG_SWATCHES.map((c) => (
                    <button
                      key={c}
                      aria-label={`Background ${c}`}
                      onClick={() => updateMeta({ bg: c })}
                      className={cn(
                        'w-8 h-8 rounded-full border-2',
                        meta.bg === c ? 'border-[#2f9bff]' : 'border-white/20'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <ChevronDown className="w-4 h-4 text-white/30 ml-1 hidden md:block" />
      </div>
    </header>
  )
}
