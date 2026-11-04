'use client'

import { useRef, useState } from 'react'
import { Plus, CopyPlus, Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditor } from '@/lib/flipa/store'

interface MenuState {
  idx: number
  x: number
  y: number
}

export default function Timeline({ compact = false }: { compact?: boolean }) {
  const frames = useEditor((s) => s.frames)
  const activeFrameIdx = useEditor((s) => s.activeFrameIdx)
  const selectFrame = useEditor((s) => s.selectFrame)
  const addFrame = useEditor((s) => s.addFrame)
  const duplicateFrame = useEditor((s) => s.duplicateFrame)
  const deleteFrame = useEditor((s) => s.deleteFrame)
  const copyFrame = useEditor((s) => s.copyFrame)

  const [menu, setMenu] = useState<MenuState | null>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)

  const openMenu = (idx: number, e: React.PointerEvent | React.MouseEvent) => {
    setMenu({
      idx,
      x: Math.min(e.clientX, window.innerWidth - 190),
      y: Math.min(e.clientY, window.innerHeight - 170),
    })
  }

  const onCardDown = (idx: number, e: React.PointerEvent) => {
    longPressed.current = false
    pressTimer.current = setTimeout(() => {
      longPressed.current = true
      openMenu(idx, e)
    }, 480)
  }
  const onCardUp = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }
  const onCardClick = (idx: number) => {
    if (longPressed.current) return
    selectFrame(idx)
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1 w-full h-full">
      {frames.map((f, i) => (
        <div
          key={f.id}
          role="button"
          tabIndex={0}
          aria-label={`Frame ${i + 1}`}
          onPointerDown={(e) => onCardDown(i, e)}
          onPointerUp={onCardUp}
          onPointerLeave={onCardUp}
          onContextMenu={(e) => {
            e.preventDefault()
            openMenu(i, e)
          }}
          onClick={() => onCardClick(i)}
          onKeyDown={(e) => e.key === 'Enter' && selectFrame(i)}
          className={cn(
            'relative shrink-0 rounded-xl overflow-hidden bg-white cursor-pointer transition',
            compact ? 'w-[52px] h-[38px]' : 'w-[72px] h-[52px]',
            i === activeFrameIdx ? 'ring-[3px] ring-[#2f9bff] ring-offset-0' : 'ring-1 ring-black/20 opacity-95'
          )}
        >
          {f.thumb ? (
            <img src={f.thumb} alt={`Frame ${i + 1}`} className="w-full h-full object-cover pointer-events-none" draggable={false} />
          ) : (
            <div className="w-full h-full" />
          )}
          <span
            className={cn(
              'absolute top-0.5 right-1 text-[10px] font-extrabold',
              i === activeFrameIdx ? 'bg-[#2f9bff] text-white px-1.5 py-[1px] rounded-md' : 'text-[#3c3d42]'
            )}
          >
            {i + 1}
          </span>
        </div>
      ))}
      <button
        aria-label="Add frame"
        onClick={() => addFrame()}
        className={cn(
          'shrink-0 rounded-xl border-2 border-dashed border-[#55575e] text-[#9a9ca3] flex items-center justify-center hover:border-[#2f9bff] hover:text-[#2f9bff] active:scale-95 transition',
          compact ? 'w-[46px] h-[38px]' : 'w-[64px] h-[52px]'
        )}
      >
        <Plus className="w-6 h-6" strokeWidth={2.4} />
      </button>

      {menu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onPointerDown={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu(null)
            }}
          />
          <div
            className="fixed z-50 w-44 bg-[#2a2b30] border border-white/10 rounded-xl shadow-2xl p-1 text-white"
            style={{ left: menu.x, top: menu.y }}
          >
            <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-white/50">FRAME {menu.idx + 1}</div>
            <button
              className="w-full h-10 px-3 rounded-lg flex items-center gap-3 hover:bg-white/10 text-sm font-semibold"
              onClick={() => {
                duplicateFrame(menu.idx)
                setMenu(null)
              }}
            >
              <CopyPlus className="w-4 h-4" /> Duplicate
            </button>
            <button
              className="w-full h-10 px-3 rounded-lg flex items-center gap-3 hover:bg-white/10 text-sm font-semibold"
              onClick={() => {
                selectFrame(menu.idx)
                copyFrame()
                setMenu(null)
              }}
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
            <button
              disabled={frames.length <= 1}
              className="w-full h-10 px-3 rounded-lg flex items-center gap-3 hover:bg-white/10 text-sm font-semibold text-red-400 disabled:text-[#585a60] disabled:hover:bg-transparent"
              onClick={() => {
                deleteFrame(menu.idx)
                setMenu(null)
              }}
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
