export type Grade = 1 | 2 | 3 | 4

export type CardState = {
  due: string
  stability: number
  reps: number
  lapses: number
  state: number // 0 new, 1 learning, 2 review, 3 relearning
}

export type Word = {
  id: number
  word: string
  ipa: string
  pos: string
  meaning: string
  example: string
  level: string
  topic: string
  tags: string
  day: number
  priority: number
  definition: string // English description, shown on the front so learners can guess the meaning
  zh: string // Simplified Chinese equivalent, learned together with the English word
  pinyin: string
}

export type SessionWord = Word & {
  card: CardState | null
  note: { sentence: string; sentence_zh: string | null; mnemonic: string | null } | null
  distractors: { word: string; meaning: string }[]
  previews: Record<Grade, number>
}

export type Settings = Record<'new_per_day' | 'new_max_priority' | 'retention' | 'daily_goal_cards' | 'start_day', string>

export type Habit = { streak: number; goal: number; doneToday: boolean; heat: { day: string; n: number }[] }

export type Today = {
  today: string
  planDay: number
  due: number
  learnedToday: number
  reviewedToday: number
  newLeft: number
  newLimit: number
  throttled: boolean
  habit: Habit
  settings: Settings
}

export type Progress = { level?: string; topic?: string; total: number; started: number; mastered: number | null }

export type Stats = {
  started: number
  mastered: number
  learning: number
  reviews: number
  recall30: number | null
  recallSample: number
  byLevel: Progress[]
  byTopic: Progress[]
  minutes: { day: string; min: number; n: number }[]
  leeches: (Word & { lapses: number })[]
  habit: Habit
}

export type BrowseItem = Word & { state: number | null; stability: number | null; lapses: number | null; due: string | null }

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' }, ...init })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

export const api = {
  meta: () => req<{ topics: { topic: string; n: number }[]; total: number; levels: string[] }>('/api/meta'),
  today: () => req<Today>('/api/today'),
  session: (mode: 'new' | 'review' | 'leech', size = 10) => req<SessionWord[]>(`/api/session?mode=${mode}&size=${size}`),
  review: (word_id: number, rating: Grade, mode: string, duration_ms: number) =>
    req<{ card: CardState }>('/api/review', { method: 'POST', body: JSON.stringify({ word_id, rating, mode, duration_ms }) }),
  addWord: (id: number) => req<{ ok: boolean }>(`/api/words/${id}/add`, { method: 'POST' }),
  words: (params: Record<string, string>) =>
    req<{ total: number; items: BrowseItem[] }>('/api/words?' + new URLSearchParams(params)),
  saveNote: (id: number, sentence: string, sentence_zh: string) =>
    req<{ ok: boolean }>(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify({ sentence, sentence_zh }) }),
  stats: () => req<Stats>('/api/stats'),
  saveSettings: (s: Partial<Settings>) => req<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(s) }),
  reset: () => req<{ ok: boolean }>('/api/reset', { method: 'POST' }),
}

export function formatInterval(ms: number) {
  const min = ms / 60000
  if (min < 60) return `${Math.max(1, Math.round(min))} phút`
  const h = min / 60
  if (h < 24) return `${Math.round(h)} giờ`
  const d = h / 24
  if (d < 30) return `${Math.round(d)} ngày`
  if (d < 365) return `${Math.round(d / 30)} tháng`
  return `${(d / 365).toFixed(1)} năm`
}

export function shortTopic(topic: string) {
  return topic.replace(/\s*\(.*\)$/, '')
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
