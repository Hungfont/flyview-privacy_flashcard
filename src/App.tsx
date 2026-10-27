import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Learn from './pages/Learn'
import Review from './pages/Review'
import Browse from './pages/Browse'
import Stats from './pages/Stats'
import Method from './pages/Method'
import Settings from './pages/Settings'

export type Page = 'home' | 'learn' | 'review' | 'leech' | 'browse' | 'stats' | 'method' | 'settings'

const NAV: { page: Page; label: string }[] = [
  { page: 'home', label: 'Hôm nay' },
  { page: 'learn', label: 'Học mới' },
  { page: 'review', label: 'Ôn tập' },
  { page: 'browse', label: 'Từ điển' },
  { page: 'stats', label: 'Thống kê' },
  { page: 'method', label: 'Phương pháp' },
  { page: 'settings', label: 'Cài đặt' },
]

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [extra, setExtra] = useState<Record<string, string>>({})
  const [visit, setVisit] = useState(0) // remount pages on every navigation so data is fresh

  const go = (p: Page, e: Record<string, string> = {}) => {
    setPage(p)
    setExtra(e)
    setVisit((v) => v + 1)
    window.scrollTo(0, 0)
  }
  const home = () => go('home')

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={home}>📚 FlyVocab</button>
        <nav>
          {NAV.map((n) => (
            <button key={n.page} className={page === n.page ? 'active' : ''} onClick={() => go(n.page)}>
              {n.label}
            </button>
          ))}
        </nav>
      </header>
      <main key={visit}>
        {page === 'home' && <Dashboard go={go} />}
        {page === 'learn' && <Learn onExit={home} />}
        {(page === 'review' || page === 'leech') && <Review mode={page} onExit={home} />}
        {page === 'browse' && <Browse initial={extra} />}
        {page === 'stats' && <Stats onLeech={() => go('leech')} />}
        {page === 'method' && <Method />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  )
}
