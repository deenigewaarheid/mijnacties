import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, X, Menu, Plus, Bell } from 'lucide-react'
import Sidebar from './Sidebar'
import { useSearch } from '../context/SearchContext'
import { useAuth } from '../context/AuthContext'

function openCapture() {
  window.dispatchEvent(new CustomEvent('open-capture'))
}

const SEARCHABLE = ['/tasks', '/projecten']

function initials(email) {
  if (!email) return '?'
  const name = email.split('@')[0]
  const parts = name.split(/[._-]/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function Layout({ children }) {
  const location = useLocation()
  const { query, setQuery } = useSearch()
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
        <header data-noprint="" className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 flex items-center gap-3 sticky top-0 z-20 flex-shrink-0">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 flex-shrink-0 p-1"
          >
            <Menu size={20} />
          </button>

          {/* Search */}
          <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 flex-1 max-w-xs border transition-colors ${
            searchable
              ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus-within:border-accent-500'
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

          <div className="flex-1" />

          {/* Snel vastleggen button */}
          <button
            onClick={openCapture}
            className="hidden sm:flex items-center gap-1.5 bg-accent-600 hover:bg-accent-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            <Plus size={14} />
            Snel vastleggen
          </button>

          {/* Bell */}
          <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0">
            <Bell size={18} />
          </button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-accent-600 flex items-center justify-center flex-shrink-0 cursor-pointer" title={user?.email}>
            <span className="text-white text-xs font-bold leading-none select-none">{initials(user?.email)}</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto h-full">
          {children}
        </main>
      </div>

    </div>
  )
}
