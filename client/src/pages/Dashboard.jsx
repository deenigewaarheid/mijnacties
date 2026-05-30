import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Mail, ArrowRight, FolderKanban, Target, AlertTriangle, Clock, FileDown, AlertCircle, Zap, Flame, Moon, CalendarDays, Calendar, ChevronDown, Inbox } from 'lucide-react'
import api from '../api/client'
import CelebrationToast from '../components/CelebrationToast'
import WorkloadIndicator from '../components/WorkloadIndicator'
import AIInsights from '../components/AIInsights'

function getDaysLeft(deadline) {
  const d = new Date(deadline); d.setHours(0,0,0,0)
  const t = new Date(); t.setHours(0,0,0,0)
  return Math.round((d - t) / 86400000)
}

function isToday(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr); d.setHours(0,0,0,0)
  const t = new Date(); t.setHours(0,0,0,0)
  return d.getTime() === t.getTime()
}

function StatCard({ value, label, onClick }) {
  return (
    <div onClick={onClick}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-4 cursor-pointer hover:border-accent-300 dark:hover:border-accent-700 hover:shadow-sm transition-all">
      <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-display font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  )
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ─── Productivity Insights ────────────────────────────────────────────────────

function ProductivityInsights({ tasks }) {
  const done = tasks.filter(t => t.completed)
  const open = tasks.filter(t => !t.completed)

  // 1. Voltooiing percentage
  const voltPct = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0

  // 2. Focus score — hoog-prio voltooid vandaag / totaal voltooid vandaag
  const doneToday    = done.filter(t => t.completed_at && isToday(t.completed_at))
  const focusToday   = doneToday.filter(t => t.priority === 'high')
  const focusScore   = doneToday.length > 0 ? Math.round((focusToday.length / doneToday.length) * 100) : 0

  // 3. Gemiddeld per dag — laatste 7 dagen
  const zeven = new Date(); zeven.setDate(zeven.getDate() - 7); zeven.setHours(0, 0, 0, 0)
  const recentDone = done.filter(t => t.completed_at && new Date(t.completed_at) >= zeven)
  const gemiddeld  = (recentDone.length / 7).toFixed(1)

  // 4. Open hoog-prioriteit taken
  const openHoog = open.filter(t => t.priority === 'high').length

  // Week voortgangsbalk — maandag t/m vandaag
  const weekStart = new Date()
  const dag = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (dag === 0 ? 6 : dag - 1))
  weekStart.setHours(0, 0, 0, 0)
  const completedWeek = done.filter(t => t.completed_at && new Date(t.completed_at) >= weekStart).length
  const openWeek      = open.filter(t => t.deadline && getDaysLeft(t.deadline) >= 0 && getDaysLeft(t.deadline) <= 6).length
  const weekTotal     = completedWeek + openWeek
  const weekPct       = weekTotal > 0 ? Math.round((completedWeek / weekTotal) * 100) : 0

  const cards = [
    {
      icon: CheckCircle2,
      label: 'Voltooiing',
      value: `${voltPct}%`,
      sub: `${done.length} van ${tasks.length} taken afgerond`,
      bg:     'from-accent-50 to-accent-100',
      border: 'border-accent-100',
      icon_c: 'text-accent-600',
      num_c:  'text-accent-700',
      lbl_c:  'text-accent-600',
    },
    {
      icon: Target,
      label: 'Focus score',
      value: `${focusScore}%`,
      sub: `${focusToday.length} van ${doneToday.length} hoog-prio vandaag`,
      bg:     'from-accent-50 to-accent-100',
      border: 'border-accent-100',
      icon_c: 'text-accent-500',
      num_c:  'text-accent-700',
      lbl_c:  'text-accent-600',
    },
    {
      icon: Zap,
      label: 'Gemiddeld / dag',
      value: gemiddeld,
      sub: `${recentDone.length} taken voltooid in 7 dagen`,
      bg:     'from-accent-50 to-emerald-50',
      border: 'border-accent-100',
      icon_c: 'text-accent-500',
      num_c:  'text-accent-700',
      lbl_c:  'text-accent-600',
    },
    {
      icon: AlertCircle,
      label: 'Urgent open',
      value: openHoog,
      sub: 'Hoge prioriteit, nog niet voltooid',
      bg:     'from-orange-50 to-amber-50',
      border: 'border-orange-100',
      icon_c: 'text-orange-500',
      num_c:  'text-orange-700',
      lbl_c:  'text-orange-600',
    },
  ]

  return (
    <div className="mb-6">
      {/* 4 metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {cards.map(({ icon: Icon, label, value, sub, bg, border, icon_c, num_c, lbl_c }) => (
          <div key={label} className={`bg-gradient-to-br ${bg} border ${border} rounded-xl px-4 py-4`}>
            <div className="flex items-center gap-2 mb-3">
              <Icon size={14} className={icon_c} />
              <span className={`text-xs font-bold uppercase tracking-wide ${lbl_c}`}>{label}</span>
            </div>
            <p className={`text-3xl font-bold leading-none mb-1.5 ${num_c}`}>{value}</p>
            <p className="text-xs text-gray-400 leading-snug">{sub}</p>
          </div>
        ))}
      </div>

      {/* Week voortgangsbalk */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl px-5 py-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Voortgang deze week
          </span>
          <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{weekPct}%</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-accent-500 to-accent-600 rounded-full transition-all duration-500"
            style={{ width: `${weekPct}%` }}
          />
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-400 flex-shrink-0" />
            {completedWeek} voltooid
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0" />
            {openWeek} open met deadline deze week
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Progressive task view ───────────────────────────────────────────────────

function DashTaskCard({ task }) {
  const dl        = task.deadline ? getDaysLeft(task.deadline) : null
  const isOverdue = dl !== null && dl < 0
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 dark:text-gray-100 truncate">{task.title}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.context      && <span className="text-xs text-accent-600 dark:text-accent-400">{task.context}</span>}
          {task.energie      && <span className="text-xs text-gray-400 dark:text-gray-500 inline-flex items-center gap-0.5">{task.energie === 'hoog' ? <Flame size={10} /> : task.energie === 'laag' ? <Moon size={10} /> : <Zap size={10} />}{task.energie}</span>}
          {task.tijd_minuten && <span className="text-xs text-gray-400 dark:text-gray-500">⏱{task.tijd_minuten}m</span>}
          {isOverdue         && <span className="text-xs text-red-500 font-medium">{Math.abs(dl)}d te laat</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {task.deadline && !isOverdue && dl > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {new Date(task.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {task.priority === 'high' && (
          <span className="text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">Hoog</span>
        )}
      </div>
    </div>
  )
}

function DashProjectRow({ task }) {
  const total = task.subtasks.length
  const done  = task.subtasks.filter(s => s.completed).length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
        <p className="text-sm text-gray-900 dark:text-gray-100 truncate flex-1">{task.title}</p>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{pct}%</span>
      </div>
      <div className="ml-4 h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-accent-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="ml-4 flex gap-2 mt-0.5">
        <span className="text-xs text-gray-400 dark:text-gray-500">{total - done} open</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">{done} klaar</span>
      </div>
    </div>
  )
}

const SECTION_COLORS = {
  blue:   { bg: 'bg-accent-50 dark:bg-accent-900/20',   icon: 'text-accent-600 dark:text-accent-400' },
  green:  { bg: 'bg-accent-50 dark:bg-accent-900/20',   icon: 'text-accent-600 dark:text-accent-400' },
  gray:   { bg: 'bg-gray-100 dark:bg-gray-800',          icon: 'text-gray-500 dark:text-gray-400' },
  red:    { bg: 'bg-red-100 dark:bg-red-900/30',         icon: 'text-red-600 dark:text-red-400' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/30',   icon: 'text-orange-600 dark:text-orange-400' },
  violet: { bg: 'bg-accent-100 dark:bg-accent-900/20',   icon: 'text-accent-600 dark:text-accent-400' },
}

function CollapsibleSection({ icon: Icon, title, color, tasks, expanded, onToggle, renderItem }) {
  const c = SECTION_COLORS[color] || SECTION_COLORS.gray
  const renderRow = renderItem || (task => <DashTaskCard key={task.id} task={task} />)
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.bg}`}>
            <Icon size={14} className={c.icon} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tasks.length} {tasks.length === 1 ? 'taak' : 'taken'}
            </p>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-800">
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-3 px-4">Geen taken in dit tijdvak.</p>
          ) : tasks.map(task => renderRow(task))}
        </div>
      )}
    </div>
  )
}

function ProgressiveTaskView({ tasks }) {
  const [expanded, setExpanded] = useState({ today: true, week: false, later: false })
  const open   = tasks.filter(t => !t.completed)
  const toggle = key => setExpanded(e => ({ ...e, [key]: !e[key] }))

  const today = open.filter(t => t.deadline && getDaysLeft(t.deadline) === 0)
  const week  = open.filter(t => t.deadline && getDaysLeft(t.deadline) >= 1 && getDaysLeft(t.deadline) <= 7)
  const later = open.filter(t => !t.deadline || getDaysLeft(t.deadline) > 7)

  return (
    <div className="space-y-2 mb-6">
      <CollapsibleSection icon={CalendarDays} title="Vandaag"     color="blue"  tasks={today} expanded={expanded.today} onToggle={() => toggle('today')} />
      <CollapsibleSection icon={Calendar}     title="Deze week"   color="green" tasks={week}  expanded={expanded.week}  onToggle={() => toggle('week')}  />
      <CollapsibleSection icon={Inbox}        title="Later"       color="gray"  tasks={later} expanded={expanded.later} onToggle={() => toggle('later')} />
    </div>
  )
}

// ─── Focus view ──────────────────────────────────────────────────────────────

function FocusView({ tasks, loading }) {
  const open = tasks.filter(t => !t.completed)
  const nextAction =
    open.find(t => t.priority === 'high' && t.deadline && isToday(t.deadline)) ||
    open.find(t => t.focus) ||
    open.find(t => t.priority === 'high') ||
    open[0] ||
    null

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-accent-600 to-accent-700 rounded-2xl p-8 text-white text-center shadow-xl">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(255,255,255,0.2)' }}>
          <Target size={28} className="text-white" />
        </div>

        <h2 className="text-2xl font-bold mb-2">Jouw focus nu</h2>
        <p className="text-accent-100 text-sm mb-8">
          Alles andere is verborgen. Concentreer je hier op.
        </p>

        {loading ? (
          <div className="bg-white/10 rounded-xl p-5">
            <p className="text-accent-100 text-sm">Laden...</p>
          </div>
        ) : nextAction ? (
          <div className="bg-white rounded-xl p-5 text-left">
            <p className="text-xs font-semibold text-accent-600 uppercase tracking-wide mb-2">Volgende actie</p>
            <p className="text-base font-semibold text-gray-900 mb-3 leading-snug">{nextAction.title}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {nextAction.deadline && (
                <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md font-medium">
                  {isToday(nextAction.deadline)
                    ? 'Deadline: vandaag'
                    : new Date(nextAction.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
                </span>
              )}
              {nextAction.context && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-medium">
                  {nextAction.context}
                </span>
              )}
              {nextAction.tijd_minuten && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md">
                  ⏱ {nextAction.tijd_minuten} min
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-5 text-center">
            <CheckCircle2 size={24} className="mx-auto mb-2 text-green-500" />
            <p className="text-gray-700 font-medium text-sm">Geen open taken — geweldig!</p>
          </div>
        )}

        <p className="text-purple-200 text-xs mt-6 opacity-70">
          Klik op "Focus aan" in de topbalk om terug te gaan naar het volledige dashboard.
        </p>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [tasks, setTasks]               = useState([])
  const [mails, setMails]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [pdfLoading, setPdfLoading]     = useState(false)
  const [focusMode, setFocusMode]       = useState(() => document.body.classList.contains('focus-mode'))
  const [showCelebration, setShowCelebration] = useState(null)
  const [secExp, setSecExp] = useState({ urgent: true, focus: false, projects: false })
  const toggleSec = key => setSecExp(e => ({ ...e, [key]: !e[key] }))
  const navigate = useNavigate()

  async function downloadDagplanner() {
    setPdfLoading(true)
    try {
      const { data } = await api.get('/dagplanner/data')
      printDagplanner(data)
    } catch (err) {
      alert('Dagplanner laden mislukt: ' + (err.response?.data?.error || err.message))
    } finally {
      setPdfLoading(false)
    }
  }

  function printDagplanner(d) {
    const dag = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag']
    const mnd = ['','jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']
    const dt  = new Date(d.datum + 'T00:00:00')
    const datumStr = `${dag[dt.getDay()]} ${dt.getDate()} ${mnd[dt.getMonth()+1]} ${dt.getFullYear()}`

    const urgKleur = { vandaag: '#dc2626', morgen: '#d97706', binnenkort: '#6b7280' }

    const taakRij = (t, i) => `
      <div class="taak">
        <span class="nr">${i+1}</span>
        <div class="taak-body">
          <div class="taak-titel">${esc(t.titel)}</div>
          <div class="taak-meta">
            ${t.prioriteit ? `<span class="badge prio-${t.prioriteit.toLowerCase()}">${t.prioriteit}</span>` : ''}
            ${t.context    ? `<span class="badge ctx">${esc(t.context)}</span>` : ''}
            ${t.energie    ? `<span class="badge eng">${esc(t.energie)}</span>` : ''}
            ${t.tijd       ? `<span class="badge tijd">⏱ ${t.tijd}min</span>` : ''}
          </div>
          ${(t.subtaken||[]).map(s => `<div class="subtaak">◦ ${esc(s)}</div>`).join('')}
        </div>
        <div class="checkbox"></div>
      </div>`

    const deadlineRij = t => `
      <div class="deadline-taak" style="border-left-color:${urgKleur[t.urgentie]||'#6b7280'}">
        <div class="deadline-header">
          <span class="deadline-titel">${esc(t.titel)}</span>
          <span class="deadline-badge" style="color:${urgKleur[t.urgentie]}">${t.urgentie.toUpperCase()} — ${esc(t.deadline_str)}</span>
        </div>
        ${t.detail ? `<div class="deadline-detail">${esc(t.detail)}</div>` : ''}
        ${(t.subtaken||[]).map(s => `<div class="subtaak ${s.gedaan?'gedaan':''}">${s.gedaan?'✓':'◦'} ${esc(s.tekst)}</div>`).join('')}
      </div>`

    const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8">
<title>Dagplanner ${d.datum}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; color: inherit; }
  body { font-family: -apple-system, Arial, sans-serif; font-size: 11px; color: #1f2937; background: #fff; padding: 20px; }
  @page { size: A4; margin: 14mm; }
  @media print { body { padding: 0; } .no-print { display: none; } }

  .header { background: #1e3a5f; color: #fff; padding: 12px 16px; border-radius: 6px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 16px; font-weight: 700; }
  .header .datum { font-size: 10px; color: #bfdbfe; margin-top: 2px; }
  .header .stats { font-size: 10px; color: #bfdbfe; text-align: right; }

  .sectie { margin-bottom: 14px; }
  .sectie-titel { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; margin-bottom: 6px; padding-bottom: 3px; border-bottom: 1.5px solid #e5e7eb; }

  .taak { display: flex; align-items: flex-start; gap: 8px; padding: 7px 8px; background: #f9fafb; border-radius: 5px; margin-bottom: 4px; border: 1px solid #e5e7eb; }
  .nr { font-size: 14px; font-weight: 800; color: #d1d5db; min-width: 18px; text-align: center; flex-shrink: 0; }
  .taak-body { flex: 1; min-width: 0; }
  .taak-titel { font-size: 11px; font-weight: 600; color: #111827; }
  .taak-meta { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 3px; }
  .checkbox { width: 14px; height: 14px; border: 1.5px solid #9ca3af; border-radius: 3px; flex-shrink: 0; margin-top: 1px; }

  .badge { font-size: 8.5px; padding: 1px 6px; border-radius: 20px; font-weight: 600; }
  .prio-hoog    { background: #fee2e2; color: #b91c1c; }
  .prio-middel  { background: #fef3c7; color: #92400e; }
  .prio-laag    { background: #dcfce7; color: #166534; }
  .ctx  { background: #e0e7ff; color: #3730a3; }
  .eng  { background: #fce7f3; color: #9d174d; }
  .tijd { background: #f3f4f6; color: #374151; }

  .subtaak { font-size: 9px; color: #6b7280; margin-top: 2px; padding-left: 4px; }
  .subtaak.gedaan { text-decoration: line-through; color: #9ca3af; }

  .deadline-taak { border-left: 3px solid #6b7280; padding: 6px 8px 6px 10px; background: #f9fafb; border-radius: 0 5px 5px 0; margin-bottom: 4px; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
  .deadline-header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .deadline-titel { font-size: 11px; font-weight: 600; color: #111827; flex: 1; }
  .deadline-badge { font-size: 8.5px; font-weight: 700; flex-shrink: 0; }
  .deadline-detail { font-size: 9px; color: #6b7280; margin-top: 2px; }

  .twee-kolom { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

  .notities { margin-top: 14px; }
  .notitie-lijn { border-bottom: 1px solid #e5e7eb; margin-bottom: 18px; }

  .print-btn { position: fixed; bottom: 20px; right: 20px; background: #1e3a5f; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .print-btn:hover { background: #2d6a9f; }

  .leeg { color: #9ca3af; font-style: italic; font-size: 10px; padding: 6px 8px; }
</style>
</head><body>

<div class="header">
  <div>
    <div class="h1" style="font-size:16px;font-weight:700">Dagplanner</div>
    <div class="datum">${datumStr} &nbsp;|&nbsp; GTD Productiviteitssysteem</div>
  </div>
  <div class="stats">
    ${d.taken_vandaag.length} taken vandaag &nbsp;|&nbsp; ${d.deadline_taken.length} deadlines
  </div>
</div>

<div class="twee-kolom">
  <div>
    <div class="sectie">
      <div class="sectie-titel">Taken van vandaag</div>
      ${d.taken_vandaag.length
        ? d.taken_vandaag.map((t,i) => taakRij(t,i)).join('')
        : '<div class="leeg">Geen taken voor vandaag.</div>'}
    </div>
  </div>

  <div>
    <div class="sectie">
      <div class="sectie-titel">Tijdrooster</div>
      ${['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'].map(u => `
        <div style="display:flex;align-items:flex-end;gap:8px;padding:0 0 2px 0;margin-bottom:10px;border-bottom:1px solid #e5e7eb">
          <span style="font-size:9px;color:#9ca3af !important;width:34px;flex-shrink:0;font-weight:600">${u}</span>
          <div style="flex:1"></div>
        </div>`).join('')}
    </div>
  </div>
</div>

<div class="sectie">
  <div class="sectie-titel" style="color:#b91c1c">Deadlines binnen 4 dagen</div>
  ${d.deadline_taken.length
    ? d.deadline_taken.map(deadlineRij).join('')
    : '<div class="leeg">Geen urgente deadlines — goed bezig!</div>'}
</div>

<div class="sectie">
  <div class="sectie-titel" style="color:#166534">Morgen</div>
  ${d.taken_morgen.length
    ? d.taken_morgen.map((t,i) => `<div style="padding:5px 8px;background:#f0fdf4;border-radius:4px;margin-bottom:3px;font-size:11px;border:1px solid #dcfce7"><strong>${esc(t.titel)}</strong>${t.detail?` <span style="color:#6b7280;font-size:10px">— ${esc(t.detail)}</span>`:''}</div>`).join('')
    : '<div class="leeg">Nog geen taken gepland voor morgen.</div>'}
</div>

<div class="notities sectie">
  <div class="sectie-titel">Notities &amp; losse gedachten</div>
  ${Array(6).fill('<div class="notitie-lijn"></div>').join('')}
</div>

<div class="sectie" style="margin-top:4px">
  <div class="sectie-titel">Dagafsluiting</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:5px;padding:8px">
      <div style="font-size:9px;color:#6b7280;font-weight:700;margin-bottom:4px">TERUGBLIK</div>
      <div style="font-size:9px;color:#374151">Wat ging goed? ___________________________________</div>
      <div style="font-size:9px;color:#374151;margin-top:8px">Wat kan beter? ____________________________________</div>
    </div>
    <div style="background:#dbeafe;border:1px solid #bfdbfe;border-radius:5px;padding:8px">
      <div style="font-size:9px;color:#6b7280;font-weight:700;margin-bottom:6px">ENERGIE EINDE DAG</div>
      <div style="display:flex;gap:8px;justify-content:center">
        ${Array(5).fill('<div style="width:18px;height:18px;border:1.5px solid #3b82f6;border-radius:50%"></div>').join('')}
      </div>
      <div style="font-size:9px;color:#6b7280;font-weight:700;margin-top:8px">TAKEN VOLTOOID: ___ / ___</div>
    </div>
  </div>
</div>

<button class="print-btn no-print" onclick="window.print()">&#128438; Afdrukken / Opslaan als PDF</button>

</body></html>`

    const w = window.open('', '_blank', 'width=900,height=1100')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 600)
  }

  useEffect(() => {
    function onToggle() { setFocusMode(document.body.classList.contains('focus-mode')) }
    window.addEventListener('focus-mode-change', onToggle)
    return () => window.removeEventListener('focus-mode-change', onToggle)
  }, [])

  useEffect(() => {
    Promise.all([api.get('/tasks'), api.get('/mails')])
      .then(([tr, mr]) => { setTasks(tr.data); setMails(mr.data) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading) return
    const completedToday = tasks.filter(t => t.completed && t.completed_at && isToday(t.completed_at))
    const unreadMails    = mails.filter(m => m.status === 'unread').length
    if (completedToday.length >= 5) {
      setShowCelebration('5_completed')
    } else if (unreadMails === 0 && mails.length > 0) {
      setShowCelebration('inbox_zero')
    }
  }, [loading, tasks, mails])

  const open     = tasks.filter(t => !t.completed)
  const overdue  = open.filter(t => t.deadline && getDaysLeft(t.deadline) < 0)
  const doneToday = tasks.filter(t => t.completed && t.completed_at && isToday(t.completed_at))
  const focusTasks = open.filter(t => t.focus || (t.priority === 'high' && t.deadline && getDaysLeft(t.deadline) <= 4))
  const projects   = open.filter(t => t.subtasks && t.subtasks.length > 0)
  const inboxCount = mails.filter(m => m.status === 'unread').length

  const urgentTasks = open
    .filter(t => t.deadline && getDaysLeft(t.deadline) <= 4)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))

  const todayTasks = open.filter(t => t.deadline && getDaysLeft(t.deadline) === 0)

  const weekStart = new Date()
  const _dow = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (_dow === 0 ? 6 : _dow - 1))
  weekStart.setHours(0, 0, 0, 0)
  const completedThisWeek = tasks.filter(t => t.completed && t.completed_at && new Date(t.completed_at) >= weekStart).length

  return (
    <div>
      {focusMode ? (
        <FocusView tasks={tasks} loading={loading} />
      ) : (
        <>
      <div className="mb-6">
        <h1 className="text-xl font-display font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
      </div>

      {/* Productivity Insights */}
      {!loading && <ProductivityInsights tasks={tasks} />}

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard value={inboxCount}       label="In inbox"       onClick={() => navigate('/inbox')} />
        <StatCard value={open.length}      label="Acties open"    onClick={() => navigate('/tasks')} />
        <StatCard value={doneToday.length} label="Vandaag gedaan" onClick={() => navigate('/tasks')} />
        <StatCard value={overdue.length}   label="Te laat"        onClick={() => navigate('/tasks')} />
      </div>

      {/* Inbox banner */}
      {inboxCount > 0 && (
        <div className="bg-accent-50 dark:bg-accent-700/10 border border-accent-100 dark:border-accent-700/30 rounded-xl px-5 py-4 mb-6 flex items-center gap-4">
          <Mail size={20} className="text-accent-600 dark:text-accent-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-accent-800 dark:text-accent-300 text-sm">Je inbox heeft {inboxCount} onverwerkte mail(s)</p>
            <p className="text-xs text-accent-600 dark:text-accent-400 mt-0.5">Verwerk je inbox om mentale rust te houden.</p>
          </div>
          <button onClick={() => navigate('/inbox')}
            className="flex items-center gap-1 text-sm text-accent-700 dark:text-accent-400 hover:text-accent-900 dark:hover:text-accent-200 font-semibold transition-colors flex-shrink-0">
            Verwerken <ArrowRight size={14} />
          </button>
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Laden...</p>}

      {/* Progressive task view */}
      {!loading && <ProgressiveTaskView tasks={tasks} />}

      {/* Extra sections */}
      {!loading && (
        <div className="space-y-2 mb-6">
          {urgentTasks.length > 0 && (
            <CollapsibleSection
              icon={AlertTriangle} title="Urgente acties" color="red"
              tasks={urgentTasks} expanded={secExp.urgent} onToggle={() => toggleSec('urgent')}
            />
          )}
          {focusTasks.length > 0 && (
            <CollapsibleSection
              icon={Target} title="Focus" color="orange"
              tasks={focusTasks} expanded={secExp.focus} onToggle={() => toggleSec('focus')}
            />
          )}
          {projects.length > 0 && (
            <CollapsibleSection
              icon={FolderKanban} title="Projecten" color="violet"
              tasks={projects} expanded={secExp.projects} onToggle={() => toggleSec('projects')}
              renderItem={task => <DashProjectRow key={task.id} task={task} />}
            />
          )}
        </div>
      )}
      {/* Workload indicator */}
      {!loading && todayTasks.length > 0 && (
        <div className="mt-6">
          <WorkloadIndicator tasks={todayTasks} />
        </div>
      )}

      {/* AI Planning Insights */}
      {!loading && open.length > 0 && (
        <div className="mt-4">
          <AIInsights tasks={open} user={{ completedThisWeek }} />
        </div>
      )}
        </>
      )}

      {showCelebration && (
        <CelebrationToast
          achievement={showCelebration}
          onClose={() => setShowCelebration(null)}
        />
      )}
    </div>
  )
}
