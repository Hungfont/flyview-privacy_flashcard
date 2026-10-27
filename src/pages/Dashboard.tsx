import { useEffect, useState } from 'react'
import { api, type Habit, type Today } from '../api'
import type { Page } from '../App'

const TIPS = [
  'Cố nhớ lại trước khi lật thẻ. Chính lúc “cố nhớ” là lúc não ghi nhớ mạnh nhất (hiệu ứng kiểm tra).',
  'Ôn đúng lịch quan trọng hơn học nhiều: 15 phút mỗi ngày tốt hơn 2 giờ vào cuối tuần.',
  'Bỏ lỡ 1 ngày không sao, nghiên cứu cho thấy thói quen không bị phá. Chỉ cần đừng bỏ 2 ngày liền.',
  'Tự đặt một câu với từ mới về chính cuộc sống của bạn, bạn sẽ nhớ nó lâu hơn nhiều.',
  'Ôn một lượt ngắn trước khi ngủ: giấc ngủ giúp não củng cố từ vừa học.',
  'Đọc to từ và câu ví dụ. Kết hợp nghe, nói và nhìn giúp tạo nhiều “đường dẫn” tới trí nhớ.',
  'Sai là bình thường. Trả lời sai rồi được sửa giúp nhớ tốt hơn là chỉ đọc lại đáp án.',
  'Học cùng một giờ và ở cùng một chỗ mỗi ngày: khung cảnh quen thuộc giúp thói quen hình thành nhanh hơn.',
]

export function Heatmap({ habit }: { habit: Habit }) {
  return (
    <div className="heatmap" aria-label="Lịch học 16 tuần gần nhất">
      {habit.heat.map((h) => {
        const lvl = h.n === 0 ? 0 : h.n < habit.goal / 2 ? 1 : h.n < habit.goal ? 2 : h.n < habit.goal * 3 ? 3 : 4
        return <span key={h.day} className={`cell l${lvl}`} title={`${h.day}: ${h.n} thẻ`} />
      })}
    </div>
  )
}

export default function Dashboard({ go }: { go: (p: Page, extra?: Record<string, string>) => void }) {
  const [t, setT] = useState<Today | null>(null)
  useEffect(() => { void api.today().then(setT) }, [])
  if (!t) return <div className="panel">Đang tải…</div>

  const tip = TIPS[new Date().getDate() % TIPS.length]
  const goalPct = Math.min(100, (t.reviewedToday / t.habit.goal) * 100)

  return (
    <div className="dashboard">
      <section className="panel hero">
        <div>
          <p className="muted">Kế hoạch 30 ngày</p>
          <h1>Ngày {t.planDay}<span className="muted">/30</span></h1>
        </div>
        <div className="habit">
          <div className="ring" style={{ ['--p' as string]: `${goalPct}%` }}>
            <span>{t.reviewedToday}/{t.habit.goal}</span>
          </div>
          <div>
            <b>{t.habit.doneToday ? 'Đã đạt mục tiêu hôm nay ✅' : 'Mục tiêu nhỏ hôm nay'}</b>
            <p className="muted small">Chuỗi ngày học: <b>{t.habit.streak}</b> 🔥 (được phép nghỉ 1 ngày, chỉ không bỏ 2 ngày liền)</p>
          </div>
        </div>
      </section>

      <div className="grid2">
        <section className="panel action">
          <h3>1. Ôn tập</h3>
          <p className="stat">{t.due}</p>
          <p className="muted">thẻ đến hạn. Luôn làm phần này trước.</p>
          <button className="btn wide" disabled={!t.due} onClick={() => go('review')}>
            {t.due ? 'Bắt đầu ôn' : 'Không có thẻ cần ôn'}
          </button>
        </section>
        <section className="panel action">
          <h3>2. Học từ mới ★★★</h3>
          <p className="stat">{t.newLeft}</p>
          <p className="muted">
            từ còn lại hôm nay (đã học {t.learnedToday}/{t.newLimit}). Mỗi lượt 10 từ cùng chủ đề.
          </p>
          <button className="btn wide" disabled={!t.newLeft} onClick={() => go('learn')}>
            {t.newLeft ? 'Học 10 từ' : 'Đủ từ mới hôm nay'}
          </button>
        </section>
      </div>
      {t.throttled && (
        <p className="notice">
          Bạn đang có hơn 150 thẻ cần ôn nên số từ mới hôm nay tạm giảm còn {t.newLimit} để bạn không bị quá tải. Ôn bớt rồi học tiếp nhé.
        </p>
      )}

      <section className="panel action">
        <h3>3. Đọc lướt từ ★★ / ★ của ngày {t.planDay}</h3>
        <p className="muted">Chỉ cần nhận ra nghĩa, không cần cố nhớ. Lần gặp lại sau sẽ nhớ nhanh hơn. Bấm “+ Ôn tập” nếu muốn học kỹ từ nào đó.</p>
        <div className="row">
          <button className="btn ghost" onClick={() => go('browse', { day: String(t.planDay), priority: '2' })}>Lướt từ ★★</button>
          <button className="btn ghost" onClick={() => go('browse', { day: String(t.planDay), priority: '3' })}>Lướt từ ★</button>
          <button className="btn ghost" onClick={() => go('leech')}>Ôn từ khó</button>
        </div>
      </section>

      <section className="panel">
        <h3>Lịch học 16 tuần</h3>
        <Heatmap habit={t.habit} />
        <p className="tip">💡 {tip}</p>
      </section>
    </div>
  )
}
