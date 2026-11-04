'use client'

import { get, set, del } from 'idb-keyval'
import type { SerializedProject } from './types'

export interface ProjectIndexEntry {
  id: string
  name: string
  updatedAt: number
  frames: number
  w: number
  h: number
  fps: number
}

const INDEX_KEY = 'flipadraw:projects'
const projKey = (id: string) => `flipadraw:project:${id}`

export async function listProjects(): Promise<ProjectIndexEntry[]> {
  const idx = (await get<ProjectIndexEntry[]>(INDEX_KEY)) ?? []
  return idx.sort((a, b) => b.updatedAt - a.updatedAt)
}

async function upsertIndex(entry: ProjectIndexEntry) {
  const idx = (await listProjects()).filter((p) => p.id !== entry.id)
  idx.push(entry)
  await set(INDEX_KEY, idx)
}

export async function saveProject(data: SerializedProject): Promise<ProjectIndexEntry> {
  const entry: ProjectIndexEntry = {
    id: data.meta.id,
    name: data.meta.name,
    updatedAt: Date.now(),
    frames: data.frames.length,
    w: data.meta.w,
    h: data.meta.h,
    fps: data.meta.fps,
  }
  await set(projKey(data.meta.id), data)
  await upsertIndex(entry)
  return entry
}

export async function loadProject(id: string): Promise<SerializedProject | null> {
  return (await get<SerializedProject>(projKey(id))) ?? null
}

export async function deleteProject(id: string) {
  await del(projKey(id))
  const idx = (await listProjects()).filter((p) => p.id !== id)
  await set(INDEX_KEY, idx)
}
