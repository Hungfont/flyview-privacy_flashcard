import { useEffect, useState } from 'react'
import { api, shortTopic, type BrowseItem } from '../api'
import { Example, SpeakButton } from '../components/WordParts'

const STATUS: Record<string, string> = { '': 'Tất cả', new: 'Chưa học', learning: 'Đang học', mastered: 'Đã thuộc', hard: 'Từ khó' }

function statusOf(w: BrowseItem) {
  if (w.state === null) return { label: 'Chưa học', cls: '' }
  if ((w.lapses ?? 0) >= 3) return { label: 'Từ khó', cls: 'hard' }
  if ((w.stability ?? 0) >= 21) return { label: 'Đã thuộc', cls: 'mastered' }
  return { label: 'Đang học', cls: 'learning' }
}

export default function Browse({ initial }: { initial: Record<string, string> }) {
  const [filters, setFilters] = useState<Record<string, string>>({ q: '', level: '', topic: '', day: '', priority: '', tag: '', status: '', ...initial })
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ total: number; items: BrowseItem[] } | null>(null)
  const [topics, setTopics] = useState<{ topic: string; n: number }[]>([])
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => { void api.meta().then((m) => setTopics(m.topics)) }, [])
  useEffect(() => {
    const params = Object.fromEntries(Object.entries({ ...filters, page: String(page) }).filter(([, v]) => v))
    const h = setTimeout(() => void api.words(params).then(setData), 200)
    return () => clearTimeout(h)
  }, [filters, page])

  const set = (k: string, v: string) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0) }
  const add = async (w: BrowseItem) => {
    await api.addWord(w.id)
    setData((d) => d && { ...d, items: d.items.map((x) => (x.id === w.id ? { ...x, state: 0, stability: 0, lapses: 0 } : x)) })
  }
  const pages = data ? Math.ceil(data.total / 50) : 0

  return (
    <div className="browse">
      <div className="filters panel">
        <input placeholder="Tìm từ hoặc nghĩa…" value={filters.q} onChange={(e) => set('q', e.target.value)} />
        <select value={filters.level} onChange={(e) => set('level', e.target.value)}>
          <option value="">Mọi cấp độ</option>
          {['B1', 'B2', 'C1', 'C2'].map((l) => <option key={l}>{l}</option>)}
        </select>
        <select value={filters.topic} onChange={(e) => set('topic', e.target.value)}>
          <option value="">Mọi chủ đề</option>
          {topics.map((t) => <option key={t.topic} value={t.topic}>{shortTopic(t.topic)} ({t.n})</option>)}
        </select>
        <select value={filters.day} onChange={(e) => set('day', e.target.value)}>
          <option value="">Mọi ngày</option>
          {Array.from({ length: 30 }, (_, i) => <option key={i} value={i + 1}>Ngày {i + 1}</option>)}
        </select>
        <select value={filters.priority} onChange={(e) => set('priority', e.target.value)}>
          <option value="">Mọi mức ưu tiên</option>
          <option value="1">★★★ Cốt lõi</option>
          <option value="2">★★ Quan trọng</option>
          <option value="3">★ Mở rộng</option>
        </select>
        <select value={filters.tag} onChange={(e) => set('tag', e.target.value)}>
          <option value="">Mọi tag</option>
          <option value="IELTS">IELTS</option>
          <option value="AWL">AWL</option>
        </select>
        <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <p className="muted">{data ? `${data.total.toLocaleString('vi-VN')} từ` : 'Đang tải…'}</p>
      <ul className="word-list">
        {data?.items.map((w) => {
          const st = statusOf(w)
          return (
            <li key={w.id} className="panel word-item">
              <div className="word-line" onClick={() => setOpen(open === w.id ? null : w.id)}>
                <div>
                  <b className="w">{w.word}</b> <span className="ipa">{w.ipa}</span> <span className="pos">{w.pos}</span>
                  <div className="meaning-sm">{w.meaning}</div>
                </div>
                <div className="word-meta">
                  <span className={`badge lv-${w.level}`}>{w.level}</span>
                  <span className={`status ${st.cls}`}>{st.label}</span>
                </div>
              </div>
              {open === w.id && (
                <div className="word-more">
                  <Example word={w.word} text={w.example} />
                  <p className="muted small">
                    {shortTopic(w.topic)} • Ngày {w.day} • {'★'.repeat(4 - w.priority)} {w.tags && `• ${w.tags}`}
                  </p>
                </div>
              )}
              <div className="row">
                <SpeakButton text={w.word} />
                {w.state === null && <button className="btn ghost small" onClick={() => add(w)}>+ Ôn tập</button>}
              </div>
            </li>
          )
        })}
      </ul>
      {pages > 1 && (
        <div className="row pager">
          <button className="btn ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>← Trước</button>
          <span>Trang {page + 1}/{pages}</span>
          <button className="btn ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sau →</button>
        </div>
      )}
    </div>
  )
}
