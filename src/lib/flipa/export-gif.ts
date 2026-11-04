'use client'

import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { Frame, ProjectMeta } from './types'

import { renderFrame } from './render'

export interface ExportOpts {
  scale: number
  fps: number
  onProgress?: (p: number) => void
}

function even(n: number) {
  return Math.max(2, Math.round(n / 2) * 2)
}

export async function exportGif(
  meta: ProjectMeta,
  frames: Frame[],
  opts: ExportOpts
): Promise<Blob> {
  const w = even(meta.w * opts.scale)
  const h = even(meta.h * opts.scale)
  const delay = Math.max(20, Math.round(1000 / opts.fps))
  const gif = GIFEncoder()
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  for (let i = 0; i < frames.length; i++) {
    renderFrame(ctx, meta, frames, i, { scale: opts.scale, bg: meta.bg })
    const { data } = ctx.getImageData(0, 0, w, h)
    const palette = quantize(data, 256)
    const index = applyPalette(data, palette)
    gif.writeFrame(index, w, h, { palette, delay })
    opts.onProgress?.((i + 1) / frames.length)
    // yield to keep UI responsive
    if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0))
  }
  gif.finish()
  return new Blob([gif.bytesView() as unknown as BlobPart], { type: 'image/gif' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
