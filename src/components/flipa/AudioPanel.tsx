'use client'

import { useRef, useState } from 'react'
import { Upload, Play, Pause, Trash2, Music } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { useEditor } from '@/lib/flipa/store'

export default function AudioPanel() {
  const open = useEditor((s) => s.audioOpen)
  const setDialog = useEditor((s) => s.setDialog)
  const audio = useEditor((s) => s.audio)
  const setAudio = useEditor((s) => s.setAudio)
  const meta = useEditor((s) => s.meta)

  const [previewing, setPreviewing] = useState(false)
  const [duration, setDuration] = useState(0)
  const previewRef = useRef<HTMLAudioElement | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    previewRef.current?.pause()
    previewRef.current = null
    setPreviewing(false)
    setDuration(0)
    if (audio) URL.revokeObjectURL(audio.url)
    const url = URL.createObjectURL(f)
    setAudio({ name: f.name, url, offset: 0, volume: 1 })
    e.target.value = ''
  }

  function togglePreview() {
    if (!audio) return
    if (!previewRef.current) {
      const el = new Audio(audio.url)
      el.volume = audio.volume
      previewRef.current = el
      el.onended = () => setPreviewing(false)
      el.onloadedmetadata = () => setDuration(el.duration)
    }
    const el = previewRef.current
    if (previewing) {
      el.pause()
      setPreviewing(false)
    } else {
      el.currentTime = audio.offset
      el.play().then(() => setPreviewing(true)).catch(() => setPreviewing(false))
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => setDialog('audio', o)}>
      <SheetContent side="bottom" className="bg-[#232427] border-white/10 text-white rounded-t-2xl px-4 pb-8">
        <SheetHeader className="p-0 pb-3">
          <SheetTitle className="text-white font-extrabold tracking-wide flex items-center gap-2">
            <Music className="w-5 h-5 text-[#2f9bff]" /> AUDIO
          </SheetTitle>
        </SheetHeader>

        {!audio ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm text-white/60">Add a music or voice track that plays with your animation.</p>
            <input ref={fileRef} type="file" accept="audio/*" hidden onChange={onFile} />
            <Button
              onClick={() => fileRef.current?.click()}
              className="bg-[#2f9bff] hover:bg-[#1f8bef] text-white font-bold h-11 px-6 rounded-xl"
            >
              <Upload className="w-5 h-5 mr-2" /> Choose audio file
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pb-2 max-w-2xl mx-auto w-full">
            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
              <button
                aria-label={previewing ? 'Pause preview' : 'Play preview'}
                onClick={togglePreview}
                className="w-11 h-11 rounded-full bg-[#2f9bff] text-white flex items-center justify-center shrink-0 active:scale-95"
              >
                {previewing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{audio.name}</div>
                <div className="text-xs text-white/50">
                  {duration ? `${duration.toFixed(1)}s` : 'audio track'} · plays in GIF? no · MP4: yes
                </div>
              </div>
              <button
                aria-label="Remove audio"
                onClick={() => {
                  previewRef.current?.pause()
                  previewRef.current = null
                  URL.revokeObjectURL(audio.url)
                  setAudio(null)
                }}
                className="w-10 h-10 rounded-lg flex items-center justify-center text-red-400 hover:bg-white/10"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-white/70">
                <span>START OFFSET</span>
                <span>{audio.offset.toFixed(1)}s into the track</span>
              </div>
              <Slider
                value={[audio.offset]}
                min={0}
                max={Math.max(1, Math.min(duration || 30, 120))}
                step={0.1}
                onValueChange={([v]) => {
                  setAudio({ ...audio, offset: v })
                  if (previewRef.current) previewRef.current.currentTime = v
                }}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-white/70">
                <span>VOLUME</span>
                <span>{Math.round(audio.volume * 100)}%</span>
              </div>
              <Slider
                value={[audio.volume * 100]}
                min={0}
                max={100}
                step={5}
                onValueChange={([v]) => {
                  setAudio({ ...audio, volume: v / 100 })
                  if (previewRef.current) previewRef.current.volume = v / 100
                }}
              />
            </div>
            {meta && (
              <p className="text-[11px] text-white/40">
                During playback the track starts at frame 1 + offset. MP4 export includes it; GIF export cannot.
              </p>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
