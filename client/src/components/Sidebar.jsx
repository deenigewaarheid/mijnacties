import { useState, useEffect, useCallback } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Mail, CheckSquare, Settings, LogOut, RotateCcw, FolderKanban,
  LayoutDashboard, X, Plus, Trophy, Moon, Sun, CalendarDays, PenLine, HelpCircle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useDarkMode } from '../context/DarkModeContext'
import api from '../api/client'

const NAV_ITEMS = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',    badgeKey: null },
  { to: '/inbox',      icon: Mail,            label: 'Inbox',        badgeKey: 'inbox' },
  { to: '/mailmaker',  icon: PenLine,         label: 'Mailmaker',    badgeKey: 'mailmaker' },
  { to: '/tasks',      icon: CheckSquare,     label: 'Taken',        badgeKey: 'losse' },
  { to: '/projecten',  icon: FolderKanban,    label: 'Projecten',    badgeKey: 'projecten' },
  { to: '/doelen',     icon: Trophy,          label: 'Doelen',       badgeKey: null },
  { to: '/dagplanner', icon: CalendarDays,    label: 'Dagplanner',   badgeKey: null },
  { to: '/review',     icon: RotateCcw,       label: 'Review',       badgeKey: null },
  { to: '/settings',   icon: Settings,        label: 'Instellingen', badgeKey: null },
]

function NavIcon({ to, icon: Icon, label, badge, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl transition-colors group ${
          isActive
            ? 'bg-accent-50 dark:bg-accent-700/20 text-accent-700 dark:text-accent-300'
            : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={20} className={isActive ? 'text-accent-600 dark:text-accent-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'} />
          <span className={`text-[10px] font-medium leading-none text-center ${isActive ? 'text-accent-700 dark:text-accent-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600'}`}>
            {label}
          </span>
          {badge > 0 && (
            <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent-600 text-white text-[9px] font-bold flex items-center justify-center leading-none">
              {badge > 9 ? '9+' : badge}
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
        inbox:     mr.data.filter(m => m.status === 'unread').length,
        focus:     open.filter(t => t.focus || (t.priority === 'high' && t.deadline && getDaysLeft(t.deadline) <= 4)).length,
        tasks:     open.filter(t => !t.bestemming || t.bestemming === 'actie').length,
        wachten:   open.filter(t => t.bestemming === 'wachten').length,
        ooit:      tr.data.filter(t => t.bestemming === 'ooit').length,
        projecten: open.filter(t => t.bestemming === 'project' || (t.subtasks && t.subtasks.length > 0)).length,
        losse:     open.filter(t => t.bestemming === 'losse_eindjes').length,
        mailmaker: mmr.data.length,
      })
    } catch {}
  }, [])

  useEffect(() => {
    fetchCounts()
    const iv = setInterval(fetchCounts, 5 * 60 * 1000)
    window.addEventListener('refresh-badges', fetchCounts)
    return () => { clearInterval(iv); window.removeEventListener('refresh-badges', fetchCounts) }
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
      for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
        await api.post('/tasks', { title: line, bestemming: 'losse_eindjes' })
      }
      setCaptureText(''); setCapture(false); fetchCounts()
    } finally { setCaptureSaving(false) }
  }

  function handleLogout() { logout(); navigate('/login') }

  return (
    <>
      <aside
        data-noprint=""
        className={`w-36 min-h-screen bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col flex-shrink-0 fixed md:static inset-y-0 left-0 z-40 transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="flex flex-col items-center pt-5 pb-4 px-3 border-b border-gray-100 dark:border-gray-800">
          <div className="w-9 h-9 rounded-xl bg-accent-600 flex items-center justify-center mb-1.5">
            <Mail size={17} className="text-white" />
          </div>
          <span className="font-display text-[11px] font-bold text-gray-700 dark:text-gray-300 tracking-tight text-center leading-tight">
            Mail Analyzer
          </span>
        </div>

        {/* Nav grid — 2 columns */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <div className="grid grid-cols-2 gap-1">
            {NAV_ITEMS.map(item => (
              <NavIcon
                key={item.to}
                {...item}
                badge={item.badgeKey ? counts[item.badgeKey] : 0}
                onClick={onClose}
              />
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="px-2 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
          {/* Snel vastleggen */}
          <button
            onClick={() => setCapture(true)}
            className="w-full flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-700 text-white transition-colors"
          >
            <Plus size={18} />
            <span className="text-[10px] font-semibold leading-none">Vastleggen</span>
          </button>

          {/* Dark mode + logout */}
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={toggleDark}
              title={dark ? 'Licht' : 'Donker'}
              className="flex flex-col items-center gap-1 py-2 rounded-xl text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
              <span className="text-[10px] leading-none">{dark ? 'Licht' : 'Donker'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex flex-col items-center gap-1 py-2 rounded-xl text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-red-500 transition-colors"
            >
              <LogOut size={16} />
              <span className="text-[10px] leading-none">Uitloggen</span>
            </button>
          </div>

          {/* Email */}
          <p className="text-[9px] text-gray-300 dark:text-gray-600 text-center truncate px-1">{user?.email}</p>
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
              autoFocus lang="nl"
              value={captureText}
              onChange={e => setCaptureText(e.target.value)}
              placeholder={"Wat zit er in je hoofd?\n\nElke regel wordt een aparte taak..."}
              rows={5}
              className="w-full border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:border-accent-600 dark:focus:border-accent-500 resize-none transition-colors"
              onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveCapture() } }}
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
