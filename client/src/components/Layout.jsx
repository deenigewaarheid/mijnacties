import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, X, Menu, Target } from 'lucide-react'
import Sidebar from './Sidebar'
import { useSearch } from '../context/SearchContext'

function FocusModeToggle() {
  const [active, setActive] = useState(() => localStorage.getItem('focus-mode') === 'true')

  useEffect(() => {
    if (active) document.body.classList.add('focus-mode')
    else document.body.classList.remove('focus-mode')
  }, [])

  function toggle() {
    const next = !active
    setActive(next)
    if (next) document.body.classList.add('focus-mode')
    else document.body.classList.remove('focus-mode')
    localStorage.setItem('focus-mode', String(next))
    window.dispatchEvent(new Event('focus-mode-change'))
  }

  return (
    <button
      onClick={toggle}
      title={active ? 'Focus modus uitschakelen' : 'Focus modus inschakelen'}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex-shrink-0 ${
        active
          ? 'bg-purple-600 text-white ring-2 ring-purple-300 dark:ring-purple-700'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      <Target size={13} />
      {active ? 'Focus aan' : 'Focus'}
    </button>
  )
}

const PAGE_TITLES = {
  '/dashboard':  'Dashboard',
  '/inbox':      'Inbox',
  '/tasks':      'Taken',
  '/review':     'Wekelijkse review',
  '/settings':   'Instellingen',
  '/projecten':  'Projecten',
  '/doelen':     'Doelen',
  '/dagplanner': 'Dagplanner',
  '/insights':   'Inzichten',
}

const SEARCHABLE = ['/tasks', '/projecten']

export default function Layout({ children }) {
  const location = useLocation()
  const { query, setQuery } = useSearch()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const title = PAGE_TITLES[location.pathname] || 'Mail Analyzer'
  const searchable = SEARCHABLE.includes(location.pathname)

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-h-screen">
        {/* Topbar */}
        <div data-noprint="" className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-gray-500 hover:text-gray-800 flex-shrink-0"
          >
            <Menu size={20} />
          </button>

          <FocusModeToggle />

          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 flex-1 max-w-xs border transition-colors ${
            searchable
              ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              : 'bg-gray-50 dark:bg-gray-800 border-transparent opacity-40 pointer-events-none'
          }`}>
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Zoek taken..."
              className="bg-transparent border-none outline-none text-sm text-gray-700 dark:text-gray-300 flex-1 placeholder-gray-400 min-w-0"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <main className="flex-1 p-4 md:p-8 overflow-auto h-full">
          {children}
        </main>
      </div>
    </div>
  )
}
