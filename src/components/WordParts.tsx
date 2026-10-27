import { useState } from 'react'
import { api, shortTopic, type SessionWord, type Word } from '../api'
import { speak } from '../speech'

function stemPattern(word: string) {
  const w = word.toLowerCase().split(/[\s/]/)[0]
  const stem = w.length > 4 ? w.slice(0, Math.max(4, w.length - 2)) : w
  return new RegExp(`\\b(${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-z]*)`, 'i')
}

// Example sentence with the target word highlighted (or blanked for cloze questions).
export function Example({ word, text, blank = false }: { word: string; text: string; blank?: boolean }) {
  if (!text) return null
  const parts = text.split(stemPattern(word))
  return (
    <p className="example">
      {parts.map((p, i) => (i % 2 === 1 ? <mark key={i}>{blank ? '_____' : p}</mark> : p))}
    </p>
  )
}

export function hasCloze(w: Word) {
  return !!w.example && stemPattern(w.word).test(w.example)
}

export function SpeakButton({ text, label = 'Nghe', lang = 'en' }: { text: string; label?: string; lang?: 'en' | 'zh' }) {
  return (
    <button type="button" className="btn ghost small" onClick={() => speak(text, 0.9, lang)} aria-label={`Phát âm ${text}`}>
      🔊 {label}
    </button>
  )
}

export function Badges({ w }: { w: Word }) {
  return (
    <div className="badges">
      <span className={`badge lv-${w.level}`}>{w.level}</span>
      <span className="badge">{shortTopic(w.topic)}</span>
      {w.tags.includes('IELTS') && <span className="badge ielts">IELTS</span>}
      {w.tags.includes('AWL') && <span className="badge">AWL</span>}
      <span className="badge stars" title="Mức ưu tiên">{'★'.repeat(4 - w.priority)}</span>
    </div>
  )
}

export function WordFront({ w }: { w: Word }) {
  return (
    <div className="front">
      <Badges w={w} />
      <h2 className="headword">{w.word}</h2>
      <div className="ipa-row">
        <span className="ipa">{w.ipa}</span>
        <span className="pos">{w.pos}</span>
        <SpeakButton text={w.word} />
      </div>
      {w.definition && <p className="definition">{w.definition}</p>}
    </div>
  )
}

export function WordBack({ w }: { w: Word }) {
  return (
    <div className="back">
      <p className="meaning">{w.meaning}</p>
      <Chinese w={w} />
      {w.example && (
        <div className="example-row">
          <Example word={w.word} text={w.example} />
          <SpeakButton text={w.example} label="Câu" />
        </div>
      )}
    </div>
  )
}

// Chinese equivalent shown next to the Vietnamese meaning, so both languages are learned together.
export function Chinese({ w }: { w: Word }) {
  if (!w.zh) return null
  return (
    <div className="zh-row" lang="zh-CN">
      <span className="zh">{w.zh}</span>
      <span className="pinyin">{w.pinyin}</span>
      <SpeakButton text={w.zh.split('；')[0]} label="中文" lang="zh" />
    </div>
  )
}

// Generation effect: writing your own English + Chinese sentence makes the word stick in both languages.
export function NoteEditor({ w }: { w: SessionWord }) {
  const [sentence, setSentence] = useState(w.note?.sentence ?? '')
  const [sentenceZh, setSentenceZh] = useState(w.note?.sentence_zh ?? '')
  const [saved, setSaved] = useState(false)
  const save = async () => {
    await api.saveNote(w.id, sentence.trim(), sentenceZh.trim())
    setSaved(true)
  }
  const zhWord = w.zh?.split('；')[0]
  return (
    <details className="notes" open={!!(w.note?.sentence || w.note?.sentence_zh)}>
      <summary>✍️ Tự đặt câu tiếng Anh / tiếng Trung (giúp nhớ lâu hơn)</summary>
      <label>
        🇬🇧 Câu tiếng Anh với “{w.word}”
        <input
          lang="en"
          value={sentence}
          onChange={(e) => { setSentence(e.target.value); setSaved(false) }}
          placeholder={`I ... ${w.word} ...`}
        />
      </label>
      <label>
        🇨🇳 Câu tiếng Trung{zhWord ? ` với “${zhWord}”` : ''}
        <input
          lang="zh-CN"
          value={sentenceZh}
          onChange={(e) => { setSentenceZh(e.target.value); setSaved(false) }}
          placeholder={zhWord ? `我……${zhWord}……` : '我……'}
        />
      </label>
      <button type="button" className="btn small" onClick={save} disabled={saved}>
        {saved ? 'Đã lưu ✓' : 'Lưu'}
      </button>
    </details>
  )
}
