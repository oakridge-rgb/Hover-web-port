'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import TopBar from './TopBar'
import ToolRail from './ToolRail'
import BottomBar from './BottomBar'
import Stage from './Stage'
import LayersPanel from './LayersPanel'
import AudioPanel from './AudioPanel'
import ExportDialog from './ExportDialog'
import WelcomeDialog from './WelcomeDialog'
import { useEditor } from '@/lib/flipa/store'

export default function EditorApp() {
  // render client-side only: canvas editor + Radix ids shouldn't SSR
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const meta = useEditor((s) => s.meta)
  const playing = useEditor((s) => s.playing)
  const uiHidden = useEditor((s) => s.uiHidden)
  const welcomeOpen = useEditor((s) => s.welcomeOpen)
  const setDialog = useEditor((s) => s.setDialog)
  const setUiHidden = useEditor((s) => s.setUiHidden)
  const audio = useEditor((s) => s.audio)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // keep welcome open when no project is loaded
  useEffect(() => {
    if (!meta && !welcomeOpen) setDialog('welcome', true)
  }, [meta, welcomeOpen, setDialog])

  // playback loop
  useEffect(() => {
    if (!playing || !meta) return
    const st = useEditor.getState()
    let raf = 0
    const fps = meta.fps
    const frameMs = 1000 / fps
    let acc = 0
    let last = performance.now()
    let idx = st.activeFrameIdx

    // start audio from the current position
    const a = useEditor.getState().audio
    if (a && audioRef.current) {
      audioRef.current.currentTime = Math.min(a.offset, 1e9)
      audioRef.current.volume = a.volume
      audioRef.current.play().catch(() => {})
    }

    const tick = (now: number) => {
      acc += now - last
      last = now
      const s = useEditor.getState()
      const total = s.frames.length
      let advanced = false
      while (acc >= frameMs) {
        acc -= frameMs
        idx++
        advanced = true
        if (idx >= total) {
          if (s.loop) idx = 0
          else {
            useEditor.setState({ activeFrameIdx: total - 1, playing: false })
            audioRef.current?.pause()
            return
          }
        }
      }
      if (advanced) useEditor.setState({ activeFrameIdx: idx })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      audioRef.current?.pause()
    }
  }, [playing, meta])

  // resync audio offset when it changes
  useEffect(() => {
    if (audioRef.current && audio) audioRef.current.volume = audio.volume
  }, [audio])

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const s = useEditor.getState()
      if (!s.meta) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
      } else if (mod && e.key.toLowerCase() === 'c') {
        s.copyFrame()
      } else if (mod && e.key.toLowerCase() === 'v') {
        s.pasteFrame()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        s.selectFrame(s.activeFrameIdx + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        s.selectFrame(s.activeFrameIdx - 1)
      } else if (e.key === ' ') {
        e.preventDefault()
        s.setPlaying(!s.playing)
      } else if (!mod) {
        const map: Record<string, typeof s.tool> = {
          b: 'brush',
          e: 'eraser',
          l: 'lasso',
          g: 'bucket',
          t: 'text',
          i: 'eyedropper',
        }
        const tool = map[e.key.toLowerCase()]
        if (tool) s.setTool(tool)
        if (e.key === '[') s.setBrushSize(Math.max(1, s.brushSize - 2))
        if (e.key === ']') s.setBrushSize(Math.min(64, s.brushSize + 2))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // autosave (debounced)
  const dirtyTick = useEditor((s) => s.dirtyTick)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!dirtyTick || !meta) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const save = (window as unknown as { __flipaSave?: () => Promise<void> }).__flipaSave
        if (save) await save()
      } catch (e) {
        console.warn('autosave failed', e)
      }
    }, 2500)
  }, [dirtyTick, meta])

  if (!mounted) {
    return <div className="h-dvh w-full bg-[#17181a]" />
  }

  return (
    <div className="h-dvh w-full flex flex-col bg-[#17181a] text-white overflow-hidden select-none">
      {!uiHidden && <TopBar />}
      <main className="flex-1 flex min-h-0 relative">
        <Stage />
        {!uiHidden && <ToolRail />}
        {uiHidden && (
          <button
            aria-label="Show interface"
            onClick={() => setUiHidden(false)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 h-16 w-7 rounded-l-xl bg-[#26272b]/95 border border-r-0 border-white/10 flex items-center justify-center text-white/80 shadow-2xl active:scale-95"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
        )}
      </main>
      {!uiHidden && <BottomBar />}
      <LayersPanel />
      <AudioPanel />
      <ExportDialog />
      <WelcomeDialog />
      {/* audio element used for synchronized playback */}
      {audio && <audio ref={audioRef} src={audio.url} preload="auto" className="hidden" />}
    </div>
  )
}
