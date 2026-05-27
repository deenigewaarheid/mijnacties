import { useState, useEffect, useCallback } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Mail, CheckSquare, Settings, LogOut, RotateCcw, FolderKanban, LayoutDashboard, X, Plus, Trophy, Moon, Sun, CalendarDays, TrendingUp, PenLine, HelpCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useDarkMode } from '../context/DarkModeContext'
import api from '../api/client'

const OVERZICHT = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',  badgeKey: null },
  { to: '/inbox',      icon: Mail,            label: 'Inbox',      badgeKey: 'inbox' },
  { to: '/mailmaker',  icon: PenLine,         label: 'Mailmaker',  badgeKey: 'mailmaker' },
]

const LIJSTEN = [
  { to: '/tasks',     icon: CheckSquare,  label: 'Taken',     badgeKey: 'losse' },
  { to: '/projecten', icon: FolderKanban, label: 'Projecten', badgeKey: 'projecten' },
  { to: '/doelen',    icon: Trophy,       label: 'Doelen',    badgeKey: null },
]

const EXTRA = [
  { to: '/dagplanner', icon: CalendarDays, label: 'Dagplanner',   badgeKey: null },
  { to: '/insights',   icon: TrendingUp,   label: 'Inzichten',    badgeKey: null },
  { to: '/review',     icon: RotateCcw,    label: 'Review',       badgeKey: null },
  { to: '/settings',   icon: Settings,     label: 'Instellingen', badgeKey: null },
]

function SectionLabel({ label }) {
  return (
    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest px-3 mb-1 mt-5 first:mt-0">
      {label}
    </p>
  )
}

function NavItem({ to, icon: Icon, label, badge, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-accent-50 text-accent-700 font-semibold dark:bg-accent-700/20 dark:text-accent-300'
            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={17}
            className={`flex-shrink-0 ${isActive ? 'text-accent-600 dark:text-accent-400' : 'text-gray-400 dark:text-gray-500'}`}
          />
          <span className="flex-1">{label}</span>
          {badge > 0 && (
            <span className={`text-xs font-semibold tabular-nums ${isActive ? 'text-accent-600 dark:text-accent-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const { dark, toggleDark } = useDarkMode()
  const navigate = useNavigate()
  const [counts, setCounts] = useState({ inbox: 0, focus: 0, tasks: 0, wachten: 0, ooit: 0, projecten: 0, losse: 0, mailmaker: 0 })
  const [capture, setCapture] = useState(false)
  const [captureText, setCaptureText] = useState('')
  const [captureSaving, setCaptureSaving] = useState(false)

  const fetchCounts = useCallback(async () => {
    try {
      const [tr, mr, mmr] = await Promise.all([api.get('/tasks'), api.get('/mails'), api.get('/mailmaker')])
      const open = tr.data.filter(t => !t.completed)
      function getDaysLeft(dl) {
        const d = new Date(dl); d.setHours(0,0,0,0)
        const t = new Date(); t.setHours(0,0,0,0)
        return Math.round((d - t) / 86400000)
      }
      setCounts({
        inbox:    mr.data.filter(m => m.status === 'unread').length,
        focus:    open.filter(t => t.focus || (t.priority === 'high' && t.deadline && getDaysLeft(t.deadline) <= 4)).length,
        tasks:    open.filter(t => !t.bestemming || t.bestemming === 'actie').length,
        wachten:  open.filter(t => t.bestemming === 'wachten').length,
        ooit:     tr.data.filter(t => t.bestemming === 'ooit').length,
        projecten:open.filter(t => t.bestemming === 'project' || (t.subtasks && t.subtasks.length > 0)).length,
        losse:    open.filter(t => t.bestemming === 'losse_eindjes').length,
        mailmaker: mmr.data.length,
      })
    } catch {}
  }, [])

  useEffect(() => {
    fetchCounts()
    const iv = setInterval(fetchCounts, 5 * 60 * 1000)
    window.addEventListener('refresh-badges', fetchCounts)
    return () => {
      clearInterval(iv)
      window.removeEventListener('refresh-badges', fetchCounts)
    }
  }, [fetchCounts])

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCapture(true) }
      if (e.key === 'Escape') setCapture(false)
    }
    function onOpenCapture() { setCapture(true) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-capture', onOpenCapture)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-capture', onOpenCapture)
    }
  }, [])

  async function saveCapture() {
    const text = captureText.trim()
    if (!text) { setCapture(false); return }
    setCaptureSaving(true)
    try {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      for (const line of lines) {
        await api.post('/tasks', { title: line, bestemming: 'losse_eindjes' })
      }
      setCaptureText('')
      setCapture(false)
      fetchCounts()
    } finally {
      setCaptureSaving(false)
    }
  }

  function handleLogout() { logout(); navigate('/login') }

  const allSections = [
    { label: 'Overzicht', items: OVERZICHT },
    { label: 'Lijsten',   items: LIJSTEN },
    { label: 'Extra',     items: EXTRA },
  ]

  return (
    <>
      <aside data-noprint="" className={`w-56 min-h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0 fixed md:static inset-y-0 left-0 z-40 transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Logo */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent-600 flex items-center justify-center flex-shrink-0">
            <Mail size={14} className="text-white" />
          </div>
          <span className="font-display text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">Mail Analyzer</span>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <nav className="space-y-0">
            {allSections.map(({ label, items }) => (
              <div key={label}>
                <SectionLabel label={label} />
                {items.map(l => (
                  <NavItem key={l.to} {...l} badge={l.badgeKey ? counts[l.badgeKey] : 0} onClick={onClose} />
                ))}
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom */}
        <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <button
            onClick={() => setCapture(true)}
            className="w-full flex items-center justify-center gap-1.5 bg-accent-600 hover:bg-accent-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Snel vastleggen
          </button>

          <div className="flex items-center justify-between px-1">
            <p className="text-gray-400 dark:text-gray-500 text-xs truncate">{user?.email}</p>
            <button
              onClick={toggleDark}
              title={dark ? 'Licht modus' : 'Donker modus'}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex-shrink-0 ml-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          <div className="flex items-center justify-between px-1">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 text-xs transition-colors"
            >
              <LogOut size={13} />
              Uitloggen
            </button>
            <button className="flex items-center gap-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 text-xs transition-colors">
              <HelpCircle size={13} />
              Help
            </button>
          </div>
        </div>
      </aside>

      {/* Capture modal */}
      {capture && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={e => e.target === e.currentTarget && setCapture(false)}
        >
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-gray-900 dark:text-gray-100">Snel vastleggen</h2>
              <button onClick={() => setCapture(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <X size={16} />
              </button>
            </div>
            <textarea
              autoFocus
              lang="nl"
              value={captureText}
              onChange={e => setCaptureText(e.target.value)}
              placeholder={"Wat zit er in je hoofd?\n\nElke regel wordt een aparte taak..."}
              rows={5}
              className="w-full border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-accent-600 dark:focus:border-accent-500 resize-none transition-colors"
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveCapture() }
              }}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 mb-4">Elke regel wordt een aparte taak. ⌘+Enter om op te slaan.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCapture(false)}
                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                Annuleren
              </button>
              <button onClick={saveCapture} disabled={captureSaving || !captureText.trim()}
                className="px-4 py-2 text-sm bg-accent-600 hover:bg-accent-700 text-white rounded-lg disabled:opacity-40 transition-colors font-semibold">
                {captureSaving ? 'Opslaan...' : 'Vastleggen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
