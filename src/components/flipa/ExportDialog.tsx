'use client'

import { useMemo, useState } from 'react'
import { Film, Image as ImageIcon, Loader2, Download } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useEditor } from '@/lib/flipa/store'
import { exportGif, downloadBlob } from '@/lib/flipa/export-gif'
import { exportMp4 } from '@/lib/flipa/export-mp4'

const SCALES = [
  { label: '25%', v: 0.25 },
  { label: '50%', v: 0.5 },
  { label: '100%', v: 1 },
]
const FPS_OPTIONS = [8, 12, 15, 24, 30]

export default function ExportDialog() {
  const open = useEditor((s) => s.exportOpen)
  const setDialog = useEditor((s) => s.setDialog)
  const meta = useEditor((s) => s.meta)
  const frames = useEditor((s) => s.frames)
  const audio = useEditor((s) => s.audio)

  const [scale, setScale] = useState(0.5)
  const [fps, setFps] = useState<number | null>(null)
  const [withAudio, setWithAudio] = useState(true)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const effectiveFps = fps ?? meta?.fps ?? 24
  const dims = useMemo(() => {
    if (!meta) return { w: 0, h: 0 }
    const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
    return { w: even(meta.w * scale), h: even(meta.h * scale) }
  }, [meta, scale])
  const durationSec = frames.length / effectiveFps

  if (!meta) return null

  async function run(kind: 'gif' | 'mp4') {
    setBusy(true)
    setErr(null)
    setNote(null)
    setProgress(0)
    try {
      if (kind === 'gif') {
        const blob = await exportGif(meta!, frames, {
          scale,
          fps: effectiveFps,
          onProgress: setProgress,
        })
        downloadBlob(blob, `${meta!.name || 'animation'}.gif`)
      } else {
        const res = await exportMp4(meta!, frames, audio, {
          scale,
          fps: effectiveFps,
          includeAudio: withAudio && !!audio,
          onProgress: setProgress,
        })
        downloadBlob(res.blob, `${meta!.name || 'animation'}.${res.ext}`)
        if (res.note) setNote(res.note)
      }
    } catch (e) {
      console.error(e)
      setErr(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
      setProgress(0)
    }
  }

  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={cn(
        'h-10 px-4 rounded-xl text-sm font-bold transition active:scale-95',
        active ? 'bg-[#2f9bff] text-white' : 'bg-white/10 text-white/80 hover:bg-white/15'
      )}
    >
      {children}
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setDialog('export', o)}>
      <DialogContent className="bg-[#232427] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-extrabold tracking-wide flex items-center gap-2">
            <Download className="w-5 h-5 text-[#2f9bff]" /> EXPORT ANIMATION
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="mp4">
          <TabsList className="bg-white/10 w-full">
            <TabsTrigger value="mp4" className="flex-1 gap-1.5 data-[state=active]:bg-[#2f9bff] data-[state=active]:text-white">
              <Film className="w-4 h-4" /> MP4 video
            </TabsTrigger>
            <TabsTrigger value="gif" className="flex-1 gap-1.5 data-[state=active]:bg-[#2f9bff] data-[state=active]:text-white">
              <ImageIcon className="w-4 h-4" /> GIF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mp4" className="space-y-4 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/60 w-16">QUALITY</span>
              {SCALES.map((s) => (
                <Chip key={s.v} active={scale === s.v} onClick={() => setScale(s.v)}>
                  {s.label}
                </Chip>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/60 w-16">FPS</span>
              {FPS_OPTIONS.map((f) => (
                <Chip key={f} active={effectiveFps === f} onClick={() => setFps(f)}>
                  {f}
                </Chip>
              ))}
            </div>
            <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
              <div>
                <div className="text-sm font-bold">Include audio</div>
                <div className="text-[11px] text-white/50">{audio ? audio.name : 'No audio track added'}</div>
              </div>
              <Switch checked={withAudio && !!audio} disabled={!audio} onCheckedChange={setWithAudio} />
            </div>
            <p className="text-[11px] text-white/40">
              {frames.length} frames · {durationSec.toFixed(1)}s · {dims.w}×{dims.h} MP4 (H.264)
            </p>
            <ExportButton kind="mp4" busy={busy} progress={progress} onClick={() => run('mp4')} />
          </TabsContent>

          <TabsContent value="gif" className="space-y-4 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/60 w-16">QUALITY</span>
              {SCALES.map((s) => (
                <Chip key={s.v} active={scale === s.v} onClick={() => setScale(s.v)}>
                  {s.label}
                </Chip>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white/60 w-16">FPS</span>
              {FPS_OPTIONS.map((f) => (
                <Chip key={f} active={effectiveFps === f} onClick={() => setFps(f)}>
                  {f}
                </Chip>
              ))}
            </div>
            <p className="text-[11px] text-white/40">
              {frames.length} frames · {durationSec.toFixed(1)}s · {dims.w}×{dims.h} · loops forever · GIFs have no audio
            </p>
            <ExportButton kind="gif" busy={busy} progress={progress} onClick={() => run('gif')} />
          </TabsContent>
        </Tabs>

        {busy && <Progress value={progress * 100} className="h-2" />}
        {note && <p className="text-xs text-amber-400">{note}</p>}
        {err && <p className="text-xs text-red-400">Export failed: {err}</p>}
      </DialogContent>
    </Dialog>
  )
}

function ExportButton({
  kind,
  busy,
  progress,
  onClick,
}: {
  kind: 'gif' | 'mp4'
  busy: boolean
  progress: number
  onClick: () => void
}) {
  return (
    <button
      disabled={busy}
      onClick={onClick}
      className="w-full h-12 rounded-xl bg-[#2f9bff] hover:bg-[#1f8bef] text-white font-extrabold tracking-wide flex items-center justify-center gap-2 disabled:opacity-70 active:scale-[.99] transition"
    >
      {busy ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" /> Rendering… {Math.round(progress * 100)}%
        </>
      ) : (
        <>
          <Download className="w-5 h-5" /> Export {kind.toUpperCase()}
        </>
      )}
    </button>
  )
}
