'use client'

import {
  Music,
  Undo2,
  Redo2,
  Copy,
  ClipboardCopy,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Layers,
} from 'lucide-react'
import { useEditor } from '@/lib/flipa/store'
import Timeline from './Timeline'

function FuncBtn({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: typeof Music
  label: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      aria-label={label || undefined}
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 w-10 h-10 sm:w-12 sm:h-12 rounded-xl transition active:scale-95 shrink-0 text-[#e8e8ea] hover:bg-white/10 disabled:text-[#585a60] disabled:hover:bg-transparent"
    >
      <Icon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.1} />
      {label ? <span className="text-[7px] sm:text-[8px] font-bold tracking-widest">{label}</span> : null}
    </button>
  )
}

export default function BottomBar() {
  const playing = useEditor((s) => s.playing)
  const histIdx = useEditor((s) => s.histIdx)
  const historyLen = useEditor((s) => s.history.length)
  const clipboard = useEditor((s) => s.clipboard)
  const activeFrameIdx = useEditor((s) => s.activeFrameIdx)
  const layerCount = useEditor((s) => s.frames[s.activeFrameIdx]?.layers.length ?? 0)

  const selectFrame = useEditor((s) => s.selectFrame)
  const setPlaying = useEditor((s) => s.setPlaying)
  const setDialog = useEditor((s) => s.setDialog)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const copyFrame = useEditor((s) => s.copyFrame)
  const pasteFrame = useEditor((s) => s.pasteFrame)

  const leftCluster = (
    <>
      <FuncBtn icon={Music} label="AUDIO" onClick={() => setDialog('audio', true)} />
      <FuncBtn icon={Undo2} label="UNDO" disabled={histIdx <= 0} onClick={undo} />
      <FuncBtn icon={Redo2} label="REDO" disabled={histIdx >= historyLen} onClick={redo} />
      <FuncBtn icon={Copy} label="COPY" onClick={copyFrame} />
      <FuncBtn icon={ClipboardCopy} label="PASTE" disabled={!clipboard} onClick={pasteFrame} />
    </>
  )

  const playbackCluster = (
    <>
      <FuncBtn icon={SkipBack} label="" disabled={playing} onClick={() => selectFrame(activeFrameIdx - 1)} />
      <FuncBtn icon={playing ? Pause : Play} label="" onClick={() => setPlaying(!playing)} />
      <FuncBtn icon={SkipForward} label="" disabled={playing} onClick={() => selectFrame(activeFrameIdx + 1)} />
      <button
        aria-label="Layers"
        onClick={() => setDialog('layers', true)}
        className="relative flex flex-col items-center justify-center gap-0.5 w-10 h-10 sm:w-12 sm:h-12 rounded-xl text-[#e8e8ea] hover:bg-white/10 active:scale-95 transition shrink-0"
      >
        <span className="relative">
          <Layers className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.1} />
          <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-0.5 rounded-full bg-[#2f9bff] text-white text-[9px] font-extrabold flex items-center justify-center">
            {layerCount}
          </span>
        </span>
        <span className="text-[7px] sm:text-[8px] font-bold tracking-widest">LAYER</span>
      </button>
    </>
  )

  return (
    <footer className="shrink-0 bg-[#232427] border-t border-black/40 z-40">
      {/* mobile: two rows */}
      <div className="flex sm:hidden items-center justify-between px-1.5 pt-1.5 pb-0.5">
        <div className="flex items-center gap-0.5">{leftCluster}</div>
        <div className="flex items-center gap-0.5">{playbackCluster}</div>
      </div>
      <div className="sm:hidden h-12 px-1 pb-1.5 flex items-center">
        <Timeline compact />
      </div>
      {/* desktop: single row */}
      <div className="hidden sm:flex items-stretch gap-1 px-1.5 py-1.5">
        <div className="flex items-center gap-0.5 shrink-0">{leftCluster}</div>
        <div className="flex-1 min-w-0 flex items-center h-14">
          <Timeline />
        </div>
        <div className="flex items-center gap-0.5 shrink-0">{playbackCluster}</div>
      </div>
    </footer>
  )
}
