export type ToolId = 'brush' | 'eraser' | 'lasso' | 'bucket' | 'text' | 'eyedropper'

export interface Layer {
  id: string
  name: string
  visible: boolean
  opacity: number // 0..1
}

export interface Frame {
  id: string
  layers: Layer[]
  thumb?: string
}

export interface ProjectMeta {
  id: string
  name: string
  w: number
  h: number
  fps: number
  bg: string
}

export interface Patch {
  layerId: string
  x: number
  y: number
  before: ImageData
  after: ImageData
}

export interface HistEntry {
  patches: Patch[]
}

export interface AudioTrack {
  name: string
  url: string
  offset: number // seconds into the animation where audio starts
  volume: number // 0..1
}

export interface SerializedProject {
  version: 1
  meta: ProjectMeta
  frames: { id: string; layers: Layer[]; pixels: Record<string, string> }[]
}
