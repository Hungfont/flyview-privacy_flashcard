import { useEffect, useRef, useState } from 'react'
import type { SessionWord } from '../api'
import { speak } from '../speech'
import {
  canRecognize, canRecord, chineseTips, englishTips, ERRORS, judge, listen, syllables, type Lang, type Result,
} from '../pronounce'

// "Read it aloud" practice: the learner says the word, gets a verdict, and — if it was off — concrete
// fixes (stress, ending sound, hard sounds) plus their own recording to compare with the model voice.
export function Pronounce({ w }: { w: SessionWord }) {
  const [lang, setLang] = useState<Lang>('en')
  const [phase, setPhase] = useState<'idle' | 'listening' | 'done'>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [local, setLocal] = useState<boolean | null>(null)
  const [recording, setRecording] = useState('')
  const stopRef = useRef<() => void>(() => {})
  const urlRef = useRef('')

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  const text = lang === 'zh' ? (w.zh ?? '') : w.word
  const sample = lang === 'zh' ? text.split('；')[0] : text

  // Record the learner's own voice in parallel so they can hear the difference themselves.
  async function startRecorder() {
    if (!canRecord) return () => {}
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType }))
        setRecording(urlRef.current)
      }
      rec.start()
      return () => rec.state !== 'inactive' && rec.stop()
    } catch {
      return () => {}
    }
  }

  async function start() {
    speechSynthesis?.cancel()
    setError('')
    setResult(null)
    setPhase('listening')
    const stopRec = await startRecorder()
    if (!canRecognize) {
      // No recognizer (e.g. Firefox): still allow record-and-compare, stopped by the button.
      stopRef.current = () => { stopRec(); setPhase('done') }
      return
    }
    try {
      const heard = await listen(lang, (stop) => { stopRef.current = stop })
      setLocal(heard.local)
      if (!heard.alternatives.length) {
        setError(ERRORS['no-speech'])
      } else {
        setResult(judge(heard.alternatives, text, lang))
      }
    } catch (e) {
      setError(ERRORS[(e as Error).message] ?? 'Không nhận dạng được giọng nói.')
    } finally {
      stopRec()
      setPhase('done')
    }
  }

  const switchLang = (l: Lang) => { setLang(l); setResult(null); setError(''); setPhase('idle') }
  const tips = lang === 'zh' ? chineseTips(w.pinyin ?? '') : englishTips(w.ipa, result)
  const syl = lang === 'en' ? syllables(w.ipa) : []

  return (
    <div className="pron">
      <div className="pron-head">
        <b>🎙️ Đọc thử</b>
        {w.zh && (
          <div className="seg">
            <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => switchLang('en')}>English</button>
            <button type="button" className={lang === 'zh' ? 'on' : ''} onClick={() => switchLang('zh')}>中文</button>
          </div>
        )}
      </div>

      <div className="row">
        {phase === 'listening' ? (
          <button type="button" className="btn listening" onClick={() => stopRef.current()}>⏺ Đang nghe… (bấm để dừng)</button>
        ) : (
          <button type="button" className="btn" onClick={start}>
            🎙️ {phase === 'done' ? 'Đọc lại' : `Đọc “${sample}”`}
          </button>
        )}
        <button type="button" className="btn ghost small" onClick={() => speak(sample, 0.9, lang)}>🔊 Mẫu</button>
        <button type="button" className="btn ghost small" onClick={() => speak(sample, 0.55, lang)}>🐢 Mẫu chậm</button>
        {recording && phase !== 'listening' && (
          <button type="button" className="btn ghost small" onClick={() => void new Audio(recording).play()}>▶️ Giọng của bạn</button>
        )}
      </div>

      {!canRecognize && (
        <p className="muted small">
          Trình duyệt này không có nhận dạng giọng nói (hãy dùng Chrome hoặc Edge). Bạn vẫn có thể ghi âm rồi nghe lại để so với mẫu.
        </p>
      )}
      {local === false && (
        <p className="muted small">Lưu ý: trình duyệt gửi giọng nói tới máy chủ của nhà cung cấp (Google/Microsoft) để nhận dạng.</p>
      )}
      {error && <p className="pron-msg soft">{error}</p>}

      {result && (
        <div className={`pron-result ${result.ok ? 'ok' : 'soft'}`}>
          {result.ok ? (
            <p className="pron-msg ok">✅ Chuẩn rồi! Máy nghe đúng “{result.target}”.</p>
          ) : (
            <>
              <p className="pron-msg soft">
                Máy nghe thành: <b>“{result.heard || '…'}”</b> — giống {Math.round(result.score * 100)}%.
                {result.score >= 0.7 ? ' Gần đúng rồi, sửa một chút nữa nhé.' : ' Thử theo các gợi ý dưới đây.'}
              </p>
              <p className="pron-diff" lang={lang === 'zh' ? 'zh-CN' : 'en'}>
                {[...result.target].map((c, i) => <span key={i} className={result.marks[i] ? 'hit' : 'miss'}>{c}</span>)}
                <small className="muted"> (phần gạch dưới là chỗ máy nghe sai)</small>
              </p>
            </>
          )}
        </div>
      )}

      {(result && !result.ok) || (phase === 'done' && !canRecognize) ? (
        <div className="pron-coach">
          {syl.length > 1 && (
            <p className="syllables">
              {syl.map((x, i) => <span key={i} className={x.stress === 1 ? 'stress' : x.stress === 2 ? 'stress2' : ''}>{x.text}</span>)}
            </p>
          )}
          {lang === 'zh' && w.pinyin && <p className="syllables" lang="zh-CN">{w.pinyin}</p>}
          <ul>
            {tips.map((t) => <li key={t.title}><b>{t.title}:</b> {t.body}</li>)}
          </ul>
          <p className="muted small">
            Cách luyện: bấm 🐢 nghe chậm → đọc theo 3 lần → bấm ▶️ nghe lại giọng mình để so sánh → đọc lại.
          </p>
        </div>
      ) : null}
    </div>
  )
}
