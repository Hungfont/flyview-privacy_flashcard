import { useCallback, useEffect, useRef, useState } from 'react'
import { api, formatInterval, type Grade, type SessionWord } from '../api'
import { speak } from '../speech'
import { NoteEditor, WordBack, WordFront } from '../components/WordParts'

const GRADES: { g: Grade; label: string; cls: string }[] = [
  { g: 1, label: 'Quên', cls: 'again' },
  { g: 2, label: 'Khó', cls: 'hard' },
  { g: 3, label: 'Nhớ', cls: 'good' },
  { g: 4, label: 'Dễ', cls: 'easy' },
]

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

// Well-known core words are sometimes asked in reverse (Vietnamese → type English): harder recall, deeper memory.
function isTypingCard(w: SessionWord) {
  return !!w.card && w.card.state === 2 && w.card.reps >= 3 && w.priority === 1 && (w.id + w.card.reps) % 3 === 0
}

export default function Review({ mode, onExit }: { mode: 'review' | 'leech'; onExit: () => void }) {
  const [cards, setCards] = useState<SessionWord[] | null>(null)
  const [done, setDone] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [typed, setTyped] = useState('')
  const [suggested, setSuggested] = useState<Grade | null>(null)
  const shownAt = useRef(0)

  const load = useCallback(async () => {
    const list = await api.session(mode, 20)
    setCards(list)
    setRevealed(false)
    setTyped('')
    setSuggested(null)
    shownAt.current = Date.now()
  }, [mode])
  useEffect(() => { void load() }, [load])

  const w = cards?.[0]
  const typing = w ? isTypingCard(w) : false

  const reveal = useCallback(() => {
    if (!w || revealed) return
    if (typing) {
      const d = distance(typed.trim().toLowerCase(), w.word.toLowerCase())
      setSuggested(d === 0 ? 3 : d <= 1 ? 2 : 1)
    }
    setRevealed(true)
    speak(w.word)
  }, [w, revealed, typing, typed])

  const rate = useCallback(
    async (g: Grade) => {
      if (!w || !revealed) return
      await api.review(w.id, g, mode === 'leech' ? 'leech' : typing ? 'type' : 'flip', Date.now() - shownAt.current)
      setDone((n) => n + 1)
      const rest = cards!.slice(1)
      if (rest.length) {
        setCards(rest)
        setRevealed(false)
        setTyped('')
        setSuggested(null)
        shownAt.current = Date.now()
      } else if (mode === 'review') {
        void load()
      } else {
        setCards([])
      }
    },
    [w, revealed, mode, typing, cards, load],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') {
        if (e.key === 'Enter' && !revealed) reveal()
        return
      }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!revealed) reveal() }
      if (revealed && ['1', '2', '3', '4'].includes(e.key)) void rate(Number(e.key) as Grade)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reveal, rate, revealed])

  if (!cards) return <div className="panel">Đang tải…</div>
  if (!w) {
    return (
      <div className="panel center">
        <h2>{done ? `Đã ôn ${done} thẻ 🎉` : 'Không có thẻ nào cần ôn lúc này'}</h2>
        <p className="muted">
          {mode === 'leech'
            ? 'Bạn đã xem lại hết danh sách từ khó.'
            : 'Thẻ sẽ quay lại đúng lúc bạn sắp quên. Ôn đúng lịch giúp tiết kiệm thời gian hơn ôn dồn một lúc.'}
        </p>
        <button className="btn" onClick={onExit}>Về trang chủ</button>
      </div>
    )
  }

  return (
    <div className="study">
      <div className="progress-line">
        <span>{mode === 'leech' ? 'Ôn từ khó' : 'Ôn tập'} • đã ôn {done}</span>
        <span>còn {cards.length}{mode === 'review' && cards.length === 20 ? '+' : ''}</span>
      </div>
      <div className="card">
        {typing ? (
          <div className="front">
            <p className="q-label">Gõ từ tiếng Anh có nghĩa:</p>
            <p className="meaning">{w.meaning}</p>
            <input
              className="type-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={revealed}
              autoFocus
              placeholder="Gõ từ rồi nhấn Enter"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            {revealed && <WordFront w={w} />}
          </div>
        ) : (
          <WordFront w={w} />
        )}

        {!revealed ? (
          <>
            {!typing && <p className="hint">Tự nhớ lại nghĩa trong đầu (hoặc nói ra), rồi mới xem đáp án.</p>}
            <button className="btn wide" onClick={reveal}>Xem đáp án <kbd>Space</kbd></button>
          </>
        ) : (
          <>
            {!typing && <WordBack w={w} />}
            {typing && w.example && <WordBack w={{ ...w, meaning: '' }} />}
            {w.note?.sentence && <p className="own">🇬🇧 Câu của bạn: {w.note.sentence}</p>}
            {w.note?.sentence_zh && <p className="own" lang="zh-CN">🇨🇳 Câu của bạn: {w.note.sentence_zh}</p>}
            {w.note?.mnemonic && <p className="own">💡 Mẹo nhớ: {w.note.mnemonic}</p>}
            {(mode === 'leech' || (w.card?.lapses ?? 0) >= 2) && <NoteEditor key={w.id} w={w} />}
            <p className="hint">Bạn nhớ từ này ở mức nào?</p>
            <div className="grades">
              {GRADES.map(({ g, label, cls }) => (
                <button key={g} className={`grade ${cls} ${suggested === g ? 'suggested' : ''}`} onClick={() => rate(g)}>
                  <b>{label}</b>
                  <small>{formatInterval(w.previews[g])}</small>
                  <kbd>{g}</kbd>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
