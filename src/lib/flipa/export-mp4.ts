'use client'

import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import type { AudioTrack, Frame, ProjectMeta } from './types'
import { renderFrame } from './render'
import { downloadBlob } from './export-gif'

export interface Mp4ExportOpts {
  scale: number
  fps: number
  includeAudio: boolean
  onProgress?: (p: number) => void
}

export interface Mp4ExportResult {
  blob: Blob
  ext: 'mp4' | 'webm'
  note?: string
}

function even(n: number) {
  return Math.max(2, Math.round(n / 2) * 2)
}

const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))

async function decodeAudio(url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url)
    const buf = await res.arrayBuffer()
    const off = new OfflineAudioContext(2, 1, 48000)
    return await off.decodeAudioData(buf)
  } catch {
    return null
  }
}

async function encodeWithWebCodecs(
  meta: ProjectMeta,
  frames: Frame[],
  audio: AudioTrack | null,
  opts: Mp4ExportOpts
): Promise<Mp4ExportResult> {
  const w = even(meta.w * opts.scale)
  const h = even(meta.h * opts.scale)
  const fps = opts.fps
  const durationUs = (frames.length / fps) * 1e6

  // pick an H.264 encoder config the browser supports
  const candidates = ['avc1.640028', 'avc1.4D0028', 'avc1.42E028']
  let videoConfig: VideoEncoderConfig | null = null
  for (const codec of candidates) {
    const cfg: VideoEncoderConfig = { codec, width: w, height: h, bitrate: 8_000_000, framerate: fps }
    const support = await VideoEncoder.isConfigSupported(cfg)
    if (support.supported) {
      videoConfig = cfg
      break
    }
  }
  if (!videoConfig) throw new Error('no webcodecs video')

  // audio prep
  let audioBuffer: AudioBuffer | null = null
  let audioSupported = false
  if (audio && opts.includeAudio) {
    const decoded = await decodeAudio(audio.url)
    if (decoded) {
      const startSample = Math.max(0, Math.floor(audio.offset * decoded.sampleRate))
      const wantSamples = Math.floor((frames.length / fps) * decoded.sampleRate)
      const endSample = Math.min(decoded.length, startSample + wantSamples)
      if (endSample > startSample) {
        // resample to 48kHz stereo via OfflineAudioContext
        const len = endSample - startSample
        const trimmedStart = startSample / decoded.sampleRate
        const off = new OfflineAudioContext(2, Math.ceil(len * (48000 / decoded.sampleRate)), 48000)
        const srcNode = off.createBufferSource()
        srcNode.buffer = decoded
        srcNode.start(0, trimmedStart, len / decoded.sampleRate)
        srcNode.connect(off.destination)
        const rendered = await off.startRendering()
        const cfgA: AudioEncoderConfig = {
          codec: 'mp4a.40.2',
          sampleRate: 48000,
          numberOfChannels: 2,
          bitrate: 128_000,
        }
        const support = await AudioEncoder.isConfigSupported(cfgA)
        audioSupported = !!support.supported
        if (audioSupported) audioBuffer = rendered
      }
    }
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: w, height: h, frameRate: fps },
    audio: audioBuffer ? { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 } : undefined,
    fastStart: 'in-memory',
  })

  // ---- video ----
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  let encodeErr: unknown = null
  const videoEncoder = new VideoEncoder({
    output: (chunk, m) => muxer.addVideoChunk(chunk, m),
    error: (e) => (encodeErr = e),
  })
  videoEncoder.configure(videoConfig)

  const frameDurUs = 1e6 / fps
  for (let i = 0; i < frames.length; i++) {
    if (encodeErr) throw encodeErr
    renderFrame(ctx, meta, frames, i, { scale: opts.scale, bg: meta.bg })
    const vf = new VideoFrame(canvas, {
      timestamp: Math.round(i * frameDurUs),
      duration: Math.round(frameDurUs),
    })
    videoEncoder.encode(vf, { keyFrame: i % (fps * 2) === 0 })
    vf.close()
    if (videoEncoder.encodeQueueSize > 8) await sleep(0)
    opts.onProgress?.((i + 1) / frames.length * (audioBuffer ? 0.8 : 1))
  }
  await videoEncoder.flush()
  videoEncoder.close()

  // ---- audio ----
  if (audioBuffer) {
    const audioEncoder = new AudioEncoder({
      output: (chunk, m) => muxer.addAudioChunk(chunk, m),
      error: (e) => (encodeErr = e),
    })
    audioEncoder.configure({
      codec: 'mp4a.40.2',
      sampleRate: 48000,
      numberOfChannels: 2,
      bitrate: 128_000,
    })
    const chunkFrames = 1024
    const total = audioBuffer.length
    const l = audioBuffer.getChannelData(0)
    const r = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : l
    for (let off0 = 0; off0 < total; off0 += chunkFrames) {
      if (encodeErr) throw encodeErr
      const n = Math.min(chunkFrames, total - off0)
      const data = new Float32Array(n * 2)
      data.set(l.subarray(off0, off0 + n), 0)
      data.set(r.subarray(off0, off0 + n), n)
      const ad = new AudioData({
        format: 'f32-planar',
        sampleRate: 48000,
        numberOfFrames: n,
        numberOfChannels: 2,
        timestamp: Math.round((off0 / 48000) * 1e6),
        data,
      })
      audioEncoder.encode(ad)
      ad.close()
      if (audioEncoder.encodeQueueSize > 16) await sleep(0)
      if (off0 % (chunkFrames * 64) === 0) opts.onProgress?.(0.8 + (off0 / total) * 0.2)
    }
    await audioEncoder.flush()
    audioEncoder.close()
  }

  muxer.finalize()
  const { buffer } = muxer.target as ArrayBufferTarget
  return { blob: new Blob([buffer], { type: 'video/mp4' }), ext: 'mp4' }
}

async function encodeWithMediaRecorder(
  meta: ProjectMeta,
  frames: Frame[],
  audio: AudioTrack | null,
  opts: Mp4ExportOpts
): Promise<Mp4ExportResult> {
  const w = even(meta.w * opts.scale)
  const h = even(meta.h * opts.scale)
  const fps = opts.fps
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  renderFrame(ctx, meta, frames, 0, { scale: opts.scale, bg: meta.bg })

  const stream = canvas.captureStream(0)
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack

  let audioCtx: AudioContext | null = null
  if (audio && opts.includeAudio) {
    try {
      const res = await fetch(audio.url)
      const buf = await res.arrayBuffer()
      audioCtx = new AudioContext()
      await audioCtx.resume()
      const decoded = await audioCtx.decodeAudioData(buf)
      const dest = audioCtx.createMediaStreamDestination()
      const src = audioCtx.createBufferSource()
      src.buffer = decoded
      src.connect(dest)
      const startS = Math.max(0, audio.offset)
      if (startS < decoded.duration) {
        for (const t of dest.stream.getAudioTracks()) stream.addTrack(t)
        // start audio aligned with recording; stop at animation end
        src.start(0, startS, frames.length / fps)
        src.stop(frames.length / fps)
        ;(src as unknown as { __stream?: MediaStream }).__stream = dest.stream
      }
    } catch {
      audioCtx?.close()
      audioCtx = null
    }
  }

  const mimeCandidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ]
  const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 8_000_000 })
  const chunks: BlobPart[] = []
  rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)

  const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()))
  rec.start(120)

  const total = frames.length
  const frameMs = 1000 / fps
  const t0 = performance.now()
  for (let i = 0; i < total; i++) {
    renderFrame(ctx, meta, frames, i, { scale: opts.scale, bg: meta.bg })
    track.requestFrame()
    opts.onProgress?.(i / total)
    const target = t0 + (i + 1) * frameMs
    const wait = target - performance.now()
    await sleep(Math.max(0, wait))
  }
  await sleep(200)
  rec.stop()
  await done
  audioCtx?.close()

  const type = rec.mimeType || mime || 'video/webm'
  const ext: 'mp4' | 'webm' = type.includes('mp4') ? 'mp4' : 'webm'
  return {
    blob: new Blob(chunks, { type }),
    ext,
    note: ext === 'webm' ? 'This browser cannot record MP4 — exported WebM instead (plays everywhere, convert if needed).' : undefined,
  }
}

export async function exportMp4(
  meta: ProjectMeta,
  frames: Frame[],
  audio: AudioTrack | null,
  opts: Mp4ExportOpts
): Promise<Mp4ExportResult> {
  const canWebCodecs =
    typeof window !== 'undefined' &&
    typeof VideoEncoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined'
  try {
    if (canWebCodecs) {
      return await encodeWithWebCodecs(meta, frames, audio, opts)
    }
  } catch {
    // fall through to MediaRecorder
  }
  return encodeWithMediaRecorder(meta, frames, audio, opts)
}

export { downloadBlob }
