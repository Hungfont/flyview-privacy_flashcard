// API server: vocabulary + learning progress stored in SQLite (data/flashcard.db).
// Scheduling uses FSRS (ts-fsrs), the spaced-repetition model used by modern Anki.
import express from 'express'
import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = join(ROOT, 'data')
const DB_PATH = join(DATA_DIR, 'flashcard.db')
const VOCAB_PATH = join(ROOT, 'vocabulary.txt')
const PORT = Number(process.env.PORT ?? 3001)

mkdirSync(DATA_DIR, { recursive: true })
const db = new DatabaseSync(DB_PATH)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY, word TEXT NOT NULL, ipa TEXT, pos TEXT, meaning TEXT, example TEXT,
    level TEXT, topic TEXT, tags TEXT, day INTEGER, priority INTEGER, definition TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_words_plan ON words(day, priority);
  CREATE TABLE IF NOT EXISTS cards (
    word_id INTEGER PRIMARY KEY REFERENCES words(id),
    due TEXT NOT NULL, stability REAL, difficulty REAL, elapsed_days INTEGER, scheduled_days INTEGER,
    reps INTEGER, lapses INTEGER, learning_steps INTEGER, state INTEGER, last_review TEXT,
    introduced_day TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
  CREATE TABLE IF NOT EXISTS review_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, word_id INTEGER REFERENCES words(id), rating INTEGER,
    mode TEXT, state_before INTEGER, reviewed_at TEXT, day TEXT, duration_ms INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_log_day ON review_log(day);
  CREATE TABLE IF NOT EXISTS notes (
    word_id INTEGER PRIMARY KEY REFERENCES words(id), sentence TEXT, mnemonic TEXT, updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`)

// ---------- import / sync vocabulary.txt ----------
// Databases created before the definition / Chinese columns existed get them added in place.
const wordCols = (db.prepare('PRAGMA table_info(words)').all() as { name: string }[]).map((c) => c.name)
for (const col of ['definition', 'zh', 'pinyin']) {
  if (!wordCols.includes(col)) db.exec(`ALTER TABLE words ADD COLUMN ${col} TEXT`)
}
// Notes gained a Chinese sentence next to the English one.
const noteCols = (db.prepare('PRAGMA table_info(notes)').all() as { name: string }[]).map((c) => c.name)
if (!noteCols.includes('sentence_zh')) db.exec('ALTER TABLE notes ADD COLUMN sentence_zh TEXT')

function readVocab() {
  const rows: string[][] = []
  for (const line of readFileSync(VOCAB_PATH, 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue
    const f = line.split(' | ').map((s) => s.trim())
    if (f.length < 11 || f.length > 14) continue
    rows.push(f)
  }
  return rows
}

if (existsSync(VOCAB_PATH)) {
  // Upsert on every start so edits to vocabulary.txt show up without losing learning progress
  // (progress lives in cards / review_log / notes, keyed by word id).
  const upsert = db.prepare(
    `INSERT INTO words (id, word, ipa, pos, meaning, example, level, topic, tags, day, priority, definition, zh, pinyin)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET word = excluded.word, ipa = excluded.ipa, pos = excluded.pos, meaning = excluded.meaning,
       example = excluded.example, level = excluded.level, topic = excluded.topic, tags = excluded.tags, day = excluded.day,
       priority = excluded.priority, definition = excluded.definition, zh = excluded.zh, pinyin = excluded.pinyin`,
  )
  const rows = readVocab()
  db.exec('BEGIN')
  for (const f of rows) {
    upsert.run(Number(f[0]), f[1], f[2], f[3], f[4], f[5], f[6], f[7], f[8], Number(f[9]), Number(f[10]), f[11] ?? '', f[12] ?? '', f[13] ?? '')
  }
  db.exec('COMMIT')
  console.log(`Synced ${rows.length} words from vocabulary.txt`)
}

// ---------- settings ----------
const DEFAULTS: Record<string, string> = {
  new_per_day: '50', // ★★★ words/day in the 30-day plan
  new_max_priority: '1', // which priorities enter active learning
  retention: '0.9', // FSRS desired retention
  daily_goal_cards: '20', // "tiny habit": a day counts as done after this many cards
  start_day: '',
}
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const s = { ...DEFAULTS }
  for (const r of rows) s[r.key] = r.value
  if (!s.start_day) {
    s.start_day = localDay()
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('start_day', s.start_day)
  }
  return s
}

function localDay(d = new Date()) {
  return d.toLocaleDateString('sv-SE') // YYYY-MM-DD in local time
}
function addDays(day: string, n: number) {
  const d = new Date(day + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return localDay(d)
}
function planDay(s: Record<string, string>) {
  const diff = Math.floor((new Date(localDay() + 'T00:00:00').getTime() - new Date(s.start_day + 'T00:00:00').getTime()) / 86400000)
  return Math.min(30, Math.max(1, diff + 1))
}
function scheduler(s: Record<string, string>) {
  return fsrs(generatorParameters({ enable_fuzz: true, request_retention: Number(s.retention) }))
}

// ---------- card helpers ----------
type CardRow = {
  word_id: number; due: string; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number
  reps: number; lapses: number; learning_steps: number; state: number; last_review: string | null
}
function toCard(r: CardRow | undefined, now: Date): Card {
  if (!r) return createEmptyCard(now)
  return {
    due: new Date(r.due), stability: r.stability, difficulty: r.difficulty, elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days, reps: r.reps, lapses: r.lapses, learning_steps: r.learning_steps,
    state: r.state as State, last_review: r.last_review ? new Date(r.last_review) : undefined,
  }
}
const GRADES: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]
function previews(card: Card, now: Date, s: Record<string, string>) {
  const rec = scheduler(s).repeat(card, now)
  return Object.fromEntries(GRADES.map((g) => [g, rec[g].card.due.getTime() - now.getTime()]))
}

const WORD_COLS = 'w.id, w.word, w.ipa, w.pos, w.meaning, w.example, w.level, w.topic, w.tags, w.day, w.priority, w.definition, w.zh, w.pinyin'
const getCard = db.prepare('SELECT * FROM cards WHERE word_id = ?')
const getNote = db.prepare('SELECT sentence, sentence_zh, mnemonic FROM notes WHERE word_id = ?')

type WordRow = { id: number; topic: string; level: string; meaning: string; word: string }
// Distractors from the same topic and level make multiple-choice questions meaningful.
const distractorStmt = db.prepare(
  'SELECT word, meaning FROM words WHERE topic = ? AND id != ? ORDER BY ABS(id - ?) LIMIT 40',
)
function withExtras(rows: WordRow[], now: Date, s: Record<string, string>) {
  return rows.map((w) => {
    const pool = distractorStmt.all(w.topic, w.id, w.id) as { word: string; meaning: string }[]
    const distractors = pool.sort(() => Math.random() - 0.5).slice(0, 3)
    const cardRow = getCard.get(w.id) as CardRow | undefined
    return {
      ...w,
      card: cardRow ?? null,
      note: getNote.get(w.id) ?? null,
      distractors,
      previews: previews(toCard(cardRow, now), now, s),
    }
  })
}

function todayStats(s: Record<string, string>) {
  const today = localDay()
  const nowIso = new Date().toISOString()
  const due = (db.prepare('SELECT COUNT(*) n FROM cards WHERE due <= ?').get(nowIso) as { n: number }).n
  const learnedToday = (db.prepare('SELECT COUNT(*) n FROM cards WHERE introduced_day = ?').get(today) as { n: number }).n
  const reviewedToday = (db.prepare('SELECT COUNT(*) n FROM review_log WHERE day = ?').get(today) as { n: number }).n
  const day = planDay(s)
  const newAvailable = (db.prepare(
    'SELECT COUNT(*) n FROM words w LEFT JOIN cards c ON c.word_id = w.id WHERE c.word_id IS NULL AND w.day <= ? AND w.priority <= ?',
  ).get(day, Number(s.new_max_priority)) as { n: number }).n
  // Protect slow learners from review overload: halve new words when the backlog is large.
  let limit = Number(s.new_per_day)
  const throttled = due > 150
  if (throttled) limit = Math.max(10, Math.floor(limit / 2))
  const newLeft = Math.max(0, Math.min(newAvailable, limit - learnedToday))
  return { today, planDay: day, due, learnedToday, reviewedToday, newLeft, newLimit: limit, throttled }
}

// ---------- habit: forgiving streak ("never miss twice") ----------
function habit(s: Record<string, string>) {
  const rows = db.prepare('SELECT day, COUNT(*) n FROM review_log GROUP BY day').all() as { day: string; n: number }[]
  const counts = new Map(rows.map((r) => [r.day, r.n]))
  const goal = Number(s.daily_goal_cards)
  const done = (d: string) => (counts.get(d) ?? 0) >= goal
  let streak = 0
  let missesInRow = 0
  let d = localDay()
  if (!done(d)) d = addDays(d, -1) // today isn't over yet
  for (let i = 0; i < 400; i++, d = addDays(d, -1)) {
    if (done(d)) { streak++; missesInRow = 0 } else if (++missesInRow >= 2 || !counts.size) break
  }
  const heat: { day: string; n: number }[] = []
  for (let i = 111; i >= 0; i--) {
    const day = addDays(localDay(), -i)
    heat.push({ day, n: counts.get(day) ?? 0 })
  }
  return { streak, goal, doneToday: done(localDay()), heat }
}

// ---------- API ----------
const app = express()
app.use(express.json())

app.get('/api/meta', (_req, res) => {
  const topics = db.prepare('SELECT topic, COUNT(*) n FROM words GROUP BY topic ORDER BY topic').all()
  const total = (db.prepare('SELECT COUNT(*) n FROM words').get() as { n: number }).n
  res.json({ topics, total, levels: ['B1', 'B2', 'C1', 'C2'] })
})

app.get('/api/today', (_req, res) => {
  const s = getSettings()
  res.json({ ...todayStats(s), habit: habit(s), settings: s })
})

// mode=new: next batch of unseen words from the 30-day plan; mode=review: cards that are due.
app.get('/api/session', (req, res) => {
  const s = getSettings()
  const now = new Date()
  const size = Math.min(100, Number(req.query.size ?? 10))
  let rows: WordRow[]
  if (req.query.mode === 'new') {
    const t = todayStats(s)
    rows = db.prepare(
      `SELECT ${WORD_COLS} FROM words w LEFT JOIN cards c ON c.word_id = w.id
       WHERE c.word_id IS NULL AND w.day <= ? AND w.priority <= ? ORDER BY w.day, w.priority, w.id LIMIT ?`,
    ).all(t.planDay, Number(s.new_max_priority), Math.min(size, t.newLeft)) as WordRow[]
  } else if (req.query.mode === 'leech') {
    rows = db.prepare(
      `SELECT ${WORD_COLS} FROM words w JOIN cards c ON c.word_id = w.id WHERE c.lapses >= 3 ORDER BY c.lapses DESC LIMIT ?`,
    ).all(size) as WordRow[]
  } else {
    rows = db.prepare(
      `SELECT ${WORD_COLS} FROM words w JOIN cards c ON c.word_id = w.id WHERE c.due <= ? ORDER BY c.due LIMIT ?`,
    ).all(now.toISOString(), size) as WordRow[]
    rows.sort(() => Math.random() - 0.5) // interleave topics during review
  }
  res.json(withExtras(rows, now, s))
})

app.post('/api/review', (req, res) => {
  const { word_id, rating, mode, duration_ms } = req.body as { word_id: number; rating: Grade; mode: string; duration_ms?: number }
  if (!GRADES.includes(rating)) return res.status(400).json({ error: 'invalid rating' })
  const s = getSettings()
  const now = new Date()
  const row = getCard.get(word_id) as (CardRow & { introduced_day: string | null }) | undefined
  const before = toCard(row, now)
  const { card } = scheduler(s).next(before, now, rating)
  db.prepare(
    `INSERT OR REPLACE INTO cards (word_id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses,
       learning_steps, state, last_review, introduced_day) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(word_id, card.due.toISOString(), card.stability, card.difficulty, card.elapsed_days, card.scheduled_days,
    card.reps, card.lapses, card.learning_steps, card.state, now.toISOString(), row?.introduced_day ?? localDay(now))
  db.prepare(
    'INSERT INTO review_log (word_id, rating, mode, state_before, reviewed_at, day, duration_ms) VALUES (?,?,?,?,?,?,?)',
  ).run(word_id, rating, mode ?? 'flip', before.state, now.toISOString(), localDay(now), duration_ms ?? null)
  res.json({ card: getCard.get(word_id), previews: previews(card, now, s) })
})

// Add a word to the review deck without a full learning session (e.g. from the dictionary).
app.post('/api/words/:id/add', (req, res) => {
  const id = Number(req.params.id)
  if (getCard.get(id)) return res.json({ ok: true })
  const now = new Date()
  const c = createEmptyCard(now)
  db.prepare(
    `INSERT INTO cards (word_id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, learning_steps, state, last_review, introduced_day)
     VALUES (?,?,?,?,?,?,?,?,?,?,NULL,?)`,
  ).run(id, now.toISOString(), c.stability, c.difficulty, c.elapsed_days, c.scheduled_days, c.reps, c.lapses, c.learning_steps, c.state, localDay(now))
  res.json({ ok: true })
})

app.get('/api/words', (req, res) => {
  const q = req.query as Record<string, string | undefined>
  const where: string[] = []
  const args: (string | number)[] = []
  if (q.q) { where.push('(w.word LIKE ? OR w.meaning LIKE ?)'); args.push(`${q.q}%`, `%${q.q}%`) }
  if (q.level) { where.push('w.level = ?'); args.push(q.level) }
  if (q.topic) { where.push('w.topic = ?'); args.push(q.topic) }
  if (q.day) { where.push('w.day = ?'); args.push(Number(q.day)) }
  if (q.priority) { where.push('w.priority = ?'); args.push(Number(q.priority)) }
  if (q.tag) { where.push('w.tags LIKE ?'); args.push(`%${q.tag}%`) }
  if (q.status === 'new') where.push('c.word_id IS NULL')
  if (q.status === 'learning') where.push('c.word_id IS NOT NULL AND c.stability < 21')
  if (q.status === 'mastered') where.push('c.stability >= 21')
  if (q.status === 'hard') where.push('c.lapses >= 3')
  const sqlWhere = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const page = Math.max(0, Number(q.page ?? 0))
  const total = (db.prepare(`SELECT COUNT(*) n FROM words w LEFT JOIN cards c ON c.word_id = w.id ${sqlWhere}`).get(...args) as { n: number }).n
  const items = db.prepare(
    `SELECT ${WORD_COLS}, c.state, c.stability, c.lapses, c.due FROM words w LEFT JOIN cards c ON c.word_id = w.id
     ${sqlWhere} ORDER BY w.id LIMIT 50 OFFSET ?`,
  ).all(...args, page * 50)
  res.json({ total, items })
})

app.put('/api/notes/:id', (req, res) => {
  const { sentence, sentence_zh } = req.body as { sentence?: string; sentence_zh?: string }
  // Upsert keeps any older mnemonic text the learner wrote before.
  db.prepare(
    `INSERT INTO notes (word_id, sentence, sentence_zh, updated_at) VALUES (?,?,?,?)
     ON CONFLICT(word_id) DO UPDATE SET sentence = excluded.sentence, sentence_zh = excluded.sentence_zh, updated_at = excluded.updated_at`,
  ).run(Number(req.params.id), sentence ?? '', sentence_zh ?? '', new Date().toISOString())
  res.json({ ok: true })
})

app.get('/api/stats', (_req, res) => {
  const s = getSettings()
  const one = (sql: string, ...a: (string | number)[]) => (db.prepare(sql).get(...a) as { n: number }).n
  const since = addDays(localDay(), -30)
  const recall = db.prepare(
    `SELECT COUNT(*) total, SUM(rating > 1) ok FROM review_log WHERE day >= ? AND state_before = ${State.Review}`,
  ).get(since) as { total: number; ok: number | null }
  const byLevel = db.prepare(
    `SELECT w.level, COUNT(*) total, COUNT(c.word_id) started, SUM(c.stability >= 21) mastered
     FROM words w LEFT JOIN cards c ON c.word_id = w.id GROUP BY w.level ORDER BY w.level`,
  ).all()
  const byTopic = db.prepare(
    `SELECT w.topic, COUNT(*) total, COUNT(c.word_id) started, SUM(c.stability >= 21) mastered
     FROM words w LEFT JOIN cards c ON c.word_id = w.id GROUP BY w.topic ORDER BY started DESC, w.topic`,
  ).all()
  const minutes = db.prepare(
    'SELECT day, ROUND(SUM(COALESCE(duration_ms, 0)) / 60000.0, 1) min, COUNT(*) n FROM review_log WHERE day >= ? GROUP BY day ORDER BY day',
  ).all(since)
  const leeches = db.prepare(
    `SELECT ${WORD_COLS}, c.lapses FROM words w JOIN cards c ON c.word_id = w.id WHERE c.lapses >= 3 ORDER BY c.lapses DESC LIMIT 30`,
  ).all()
  res.json({
    started: one('SELECT COUNT(*) n FROM cards'),
    mastered: one('SELECT COUNT(*) n FROM cards WHERE stability >= 21'),
    learning: one('SELECT COUNT(*) n FROM cards WHERE stability < 21'),
    reviews: one('SELECT COUNT(*) n FROM review_log'),
    recall30: recall.total ? (recall.ok ?? 0) / recall.total : null,
    recallSample: recall.total,
    byLevel, byTopic, minutes, leeches,
    habit: habit(s),
  })
})

app.put('/api/settings', (req, res) => {
  const body = req.body as Record<string, string | number>
  const set = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  for (const [k, v] of Object.entries(body)) if (k in DEFAULTS) set.run(k, String(v))
  res.json(getSettings())
})

app.post('/api/reset', (_req, res) => {
  db.exec("DELETE FROM review_log; DELETE FROM cards; DELETE FROM notes; DELETE FROM settings WHERE key = 'start_day';")
  res.json({ ok: true })
})

// In production, also serve the built frontend.
const DIST = join(ROOT, 'dist')
if (existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(DIST, 'index.html')))
}

app.listen(PORT, () => console.log(`API on http://localhost:${PORT} — database: ${DB_PATH}`))
