import { useEffect, useState } from 'react'
import { api, shortTopic, type Progress, type Stats as StatsT } from '../api'
import { Heatmap } from './Dashboard'

function Bars({ rows, label }: { rows: Progress[]; label: (p: Progress) => string }) {
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={label(r)} className="bar-row">
          <span className="bar-label">{label(r)}</span>
          <div className="stack" title={`Đã thuộc ${r.mastered ?? 0} • Đang học ${r.started - (r.mastered ?? 0)} • Tổng ${r.total}`}>
            <div className="m" style={{ width: `${((r.mastered ?? 0) / r.total) * 100}%` }} />
            <div className="s" style={{ width: `${((r.started - (r.mastered ?? 0)) / r.total) * 100}%` }} />
          </div>
          <span className="bar-num">{r.started}/{r.total}</span>
        </div>
      ))}
    </div>
  )
}

export default function Stats({ onLeech }: { onLeech: () => void }) {
  const [s, setS] = useState<StatsT | null>(null)
  useEffect(() => { void api.stats().then(setS) }, [])
  if (!s) return <div className="panel">Đang tải…</div>
  const maxMin = Math.max(1, ...s.minutes.map((m) => m.n))

  return (
    <div className="stats">
      <div className="kpis">
        <div className="panel kpi"><span>Đã bắt đầu học</span><b>{s.started.toLocaleString('vi-VN')}</b></div>
        <div className="panel kpi"><span>Đã thuộc (nhớ ≥ 21 ngày)</span><b>{s.mastered.toLocaleString('vi-VN')}</b></div>
        <div className="panel kpi">
          <span>Tỷ lệ nhớ khi ôn (30 ngày)</span>
          <b>{s.recall30 === null ? '—' : `${Math.round(s.recall30 * 100)}%`}</b>
        </div>
        <div className="panel kpi"><span>Tổng lượt ôn</span><b>{s.reviews.toLocaleString('vi-VN')}</b></div>
      </div>
      <p className="muted small">
        Tỷ lệ nhớ quanh 85–92% là lý tưởng: đủ khó để nhớ sâu nhưng không gây nản. “Đã thuộc” là từ mà thuật toán dự đoán bạn
        còn nhớ sau ít nhất 21 ngày.
      </p>

      <section className="panel">
        <h3>Lịch học</h3>
        <Heatmap habit={s.habit} />
        <h3>Số thẻ mỗi ngày (30 ngày)</h3>
        <div className="cols">
          {s.minutes.map((m) => (
            <div key={m.day} className="col" title={`${m.day}: ${m.n} thẻ, ${m.min} phút`}>
              <div style={{ height: `${(m.n / maxMin) * 100}%` }} />
            </div>
          ))}
          {!s.minutes.length && <p className="muted">Chưa có dữ liệu.</p>}
        </div>
      </section>

      <section className="panel">
        <h3>Theo cấp độ</h3>
        <p className="legend"><i className="m" /> Đã thuộc <i className="s" /> Đang học</p>
        <Bars rows={s.byLevel} label={(r) => r.level!} />
      </section>
      <section className="panel">
        <h3>Theo chủ đề</h3>
        <Bars rows={s.byTopic} label={(r) => shortTopic(r.topic!)} />
      </section>

      <section className="panel">
        <h3>Từ khó (quên từ 3 lần trở lên)</h3>
        {s.leeches.length ? (
          <>
            <ul className="leeches">
              {s.leeches.map((w) => <li key={w.id}><b>{w.word}</b> {w.meaning} <span className="muted">({w.lapses} lần)</span></li>)}
            </ul>
            <p className="muted small">Mẹo: tự đặt câu và ghi mẹo nhớ riêng cho những từ này. Cách học sâu hơn giúp hết “quên lặp lại”.</p>
            <button className="btn" onClick={onLeech}>Ôn từ khó</button>
          </>
        ) : (
          <p className="muted">Chưa có từ khó nào 👍</p>
        )}
      </section>
    </div>
  )
}
