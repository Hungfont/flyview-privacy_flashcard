import { useEffect, useState } from 'react'
import { api, type Settings as SettingsT } from '../api'

export default function Settings() {
  const [s, setS] = useState<SettingsT | null>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => { void api.today().then((t) => setS(t.settings)) }, [])
  if (!s) return <div className="panel">Đang tải…</div>

  const set = (k: keyof SettingsT, v: string) => { setS({ ...s, [k]: v }); setMsg('') }
  const save = async () => { setS(await api.saveSettings(s)); setMsg('Đã lưu ✓') }
  const reset = async () => {
    if (!confirm('Xóa toàn bộ tiến độ học (thẻ, lịch sử ôn, ghi chú)? Không thể hoàn tác.')) return
    await api.reset()
    setS((await api.today()).settings)
    setMsg('Đã xóa tiến độ.')
  }

  return (
    <div className="panel settings">
      <h2>Cài đặt</h2>
      <label>
        Số từ mới mỗi ngày
        <input type="number" min={5} max={200} value={s.new_per_day} onChange={(e) => set('new_per_day', e.target.value)} />
        <small>Người học chậm nên bắt đầu với 20–30 từ. Kế hoạch 30 ngày dùng 50 từ ★★★/ngày.</small>
      </label>
      <label>
        Từ mới được lấy từ
        <select value={s.new_max_priority} onChange={(e) => set('new_max_priority', e.target.value)}>
          <option value="1">Chỉ ★★★ cốt lõi</option>
          <option value="2">★★★ và ★★</option>
          <option value="3">Tất cả</option>
        </select>
      </label>
      <label>
        Tỷ lệ nhớ mong muốn
        <select value={s.retention} onChange={(e) => set('retention', e.target.value)}>
          <option value="0.85">85% (ôn ít hơn)</option>
          <option value="0.9">90% (khuyến nghị)</option>
          <option value="0.95">95% (ôn nhiều hơn)</option>
        </select>
      </label>
      <label>
        Mục tiêu nhỏ mỗi ngày (số thẻ)
        <input type="number" min={5} max={500} value={s.daily_goal_cards} onChange={(e) => set('daily_goal_cards', e.target.value)} />
        <small>Đặt thấp để ngày nào cũng làm được. Đều đặn quan trọng hơn số lượng.</small>
      </label>
      <label>
        Ngày bắt đầu kế hoạch 30 ngày
        <input type="date" value={s.start_day} onChange={(e) => set('start_day', e.target.value)} />
      </label>
      <div className="row">
        <button className="btn" onClick={save}>Lưu</button>
        <span className="muted">{msg}</span>
      </div>
      <hr />
      <p className="muted small">Tiến độ được lưu trong file SQLite <code>data/flashcard.db</code> trong thư mục dự án.</p>
      <button className="btn danger" onClick={reset}>Xóa toàn bộ tiến độ</button>
    </div>
  )
}
