import { randomUUID } from 'node:crypto'

export const nowIso = () => new Date().toISOString()

export const makeId = () => randomUUID()

export const ensureArray = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
