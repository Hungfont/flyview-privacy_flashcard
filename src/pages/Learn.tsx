import { useEffect, useMemo, useRef, useState } from 'react'
import { api, shortTopic, shuffle, type SessionWord } from '../api'
import { speak } from '../speech'
import { Example, hasCloze, NoteEditor, WordBack, WordFront } from '../components/WordParts'
import { Pronounce } from '../components/Pronounce'

type QuizType = 'meaning' | 'listen' | 'cloze' | 'chinese'
type Question = { w: SessionWord; type: QuizType; options: { label: string; correct: boolean }[] }

function makeQuestion(w: SessionWord, i: number): Question {
  const kinds: QuizType[] = ['meaning', 'listen']
  if (hasCloze(w)) kinds.push('cloze')
  if (w.zh) kinds.push('chinese')
  const type = kinds[i % kinds.length]
  const opts =
    type === 'meaning'
      ? [{ label: w.meaning, correct: true }, ...w.distractors.map((d) => ({ label: d.meaning, correct: false }))]
      : [{ label: w.word, correct: true }, ...w.distractors.map((d) => ({ label: d.word, correct: false }))]
  return { w, type, options: shuffle(opts) }
}

// New words: 1) meet each word (try to guess before flipping) 2) mixed quiz on the whole batch.
export default function Learn({ onExit }: { onExit: () => void }) {
  const [batch, setBatch] = useState<SessionWord[] | null>(null)
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'done'>('intro')
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [queue, setQueue] = useState<Question[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [firstTry, setFirstTry] = useState<Record<number, boolean>>({})
  const startedAt = useRef(0)

  const load = async () => {
    const words = await api.session('new', 10)
    setBatch(words)
    setPhase(words.length ? 'intro' : 'done')
    setIdx(0)
    setFlipped(false)
    setFirstTry({})
    startedAt.current = Date.now()
  }
  useEffect(() => { void load() }, [])

  const current = batch?.[idx]
  useEffect(() => {
    if (phase === 'intro' && current) speak(current.word)
  }, [phase, current])

  const q = queue[0]
  useEffect(() => {
    if (phase === 'quiz' && q?.type === 'listen') speak(q.w.word)
  }, [phase, q])

  const startQuiz = () => {
    setQueue(shuffle(batch!).map(makeQuestion))
    setPhase('quiz')
    setPicked(null)
    startedAt.current = Date.now()
  }

  const answer = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    const correct = q.options[i].correct
    if (!(q.w.id in firstTry)) {
      setFirstTry((f) => ({ ...f, [q.w.id]: correct }))
      // First attempt decides the FSRS grade: Good if recalled, Again if not.
      void api.review(q.w.id, correct ? 3 : 1, `learn-${q.type}`, Date.now() - startedAt.current)
    }
    if (correct) speak(q.w.word)
  }

  const nextQuestion = () => {
    const wasCorrect = q.options[picked!].correct
    const rest = queue.slice(1)
    // Wrong answers come back at the end of the batch (with a different question type).
    const nextQueue = wasCorrect ? rest : [...rest, makeQuestion(q.w, Math.floor(Math.random() * 4) + 1)]
    setQueue(nextQueue)
    setPicked(null)
    startedAt.current = Date.now()
    if (!nextQueue.length) setPhase('done')
  }

  const score = useMemo(() => Object.values(firstTry).filter(Boolean).length, [firstTry])

  if (!batch) return <div className="panel">Đang tải…</div>

  if (phase === 'done') {
    return (
      <div className="panel center">
        {batch.length ? (
          <>
            <h2>Hoàn thành nhóm {batch.length} từ 🎉</h2>
            <p className="big">Đúng ngay lần đầu: {score}/{batch.length}</p>
            <p className="muted">
              Các từ này sẽ quay lại trong phần <b>Ôn tập</b> đúng lúc bạn sắp quên. Từ trả lời sai sẽ xuất hiện lại sau vài phút.
            </p>
            <div className="row">
              <button className="btn" onClick={load}>Học tiếp 10 từ</button>
              <button className="btn ghost" onClick={onExit}>Về trang chủ</button>
            </div>
          </>
        ) : (
          <>
            <h2>Hôm nay đã đủ từ mới ✅</h2>
            <p className="muted">
              Bạn đã đạt giới hạn từ mới của ngày. Học quá nhiều từ một lúc làm phần ôn tập ngày mai bị dồn và khiến dễ nản.
              Hãy ôn lại, đọc lướt các từ ★★/★ hoặc nghỉ ngơi. Giấc ngủ cũng giúp não củng cố từ vừa học.
            </p>
            <button className="btn" onClick={onExit}>Về trang chủ</button>
          </>
        )}
      </div>
    )
  }

  if (phase === 'intro' && current) {
    return (
      <div className="study">
        <div className="progress-line">
          <span>Làm quen • {shortTopic(current.topic)}</span>
          <span>{idx + 1}/{batch.length}</span>
        </div>
        <div className="bar"><div style={{ width: `${((idx + 1) / batch.length) * 100}%` }} /></div>
        <div className="card">
          <WordFront w={current} />
          {!flipped ? (
            <>
              <p className="hint">Đọc to từ này và đọc mô tả tiếng Anh. Thử đoán nghĩa trước khi lật thẻ.</p>
              <button className="btn wide" onClick={() => setFlipped(true)} autoFocus>Lật thẻ</button>
            </>
          ) : (
            <>
              <WordBack w={current} />
              <Pronounce key={`p${current.id}`} w={current} />
              <NoteEditor key={current.id} w={current} />
              <button
                className="btn wide"
                autoFocus
                onClick={() => (idx + 1 < batch.length ? (setIdx(idx + 1), setFlipped(false)) : startQuiz())}
              >
                {idx + 1 < batch.length ? 'Từ tiếp theo →' : 'Kiểm tra nhanh →'}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'quiz' && q) {
    const prompt =
      q.type === 'meaning' ? (
        <>
          <p className="q-label">Nghĩa của từ này là gì?</p>
          <h2 className="headword">{q.w.word}</h2>
          <span className="ipa">{q.w.ipa}</span>
        </>
      ) : q.type === 'chinese' ? (
        <>
          <p className="q-label">Từ tiếng Anh nào tương ứng với từ tiếng Trung này?</p>
          <h2 className="headword" lang="zh-CN">{q.w.zh}</h2>
          <span className="pinyin">{q.w.pinyin}</span>
        </>
      ) : q.type === 'listen' ? (
        <>
          <p className="q-label">Nghe và chọn từ đúng</p>
          <button className="btn listen" onClick={() => speak(q.w.word)}>🔊 Nghe lại</button>
        </>
      ) : (
        <>
          <p className="q-label">Chọn từ phù hợp để điền vào chỗ trống</p>
          <Example word={q.w.word} text={q.w.example} blank={picked === null} />
          <p className="muted small">({q.w.meaning})</p>
        </>
      )
    return (
      <div className="study">
        <div className="progress-line">
          <span>Kiểm tra nhanh</span>
          <span>còn {queue.length} câu</span>
        </div>
        <div className="card">
          {prompt}
          <div className="options">
            {q.options.map((o, i) => (
              <button
                key={i}
                className={`option ${picked !== null && o.correct ? 'right' : ''} ${picked === i && !o.correct ? 'wrong' : ''}`}
                onClick={() => answer(i)}
                disabled={picked !== null}
              >
                {o.label}
              </button>
            ))}
          </div>
          {picked !== null && (
            <div className={`feedback ${q.options[picked].correct ? 'ok' : 'soft'}`}>
              {q.options[picked].correct ? (
                <p>Chính xác! 👏</p>
              ) : (
                <p>Chưa đúng, không sao cả. Sai rồi sửa lại là cách học hiệu quả nhất. Từ này sẽ quay lại ở cuối nhóm.</p>
              )}
              <WordBack w={q.w} />
              <button className="btn wide" onClick={nextQuestion} autoFocus>Tiếp tục →</button>
            </div>
          )}
        </div>
      </div>
    )
  }
  return null
}
