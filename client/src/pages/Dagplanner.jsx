import { useState, useEffect } from 'react'
import { Printer, Clock, Zap, CalendarDays, AlertCircle, Target, Calendar } from 'lucide-react'
import api from '../api/client'
import { getFilteredPlannerData, formatDate, localDateStr, dlStr } from '../utils/plannerData'

function fmtDatum(iso) {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

const PRIO_NL = { high: 'Hoog', mid: 'Gemiddeld', low: 'Laag' }

function SectionHeader({ emoji, title }) {
  return (
    <h2 className="text-sm font-bold uppercase tracking-wide mb-3 pb-2 border-b-2 border-accent-200 dark:border-accent-700 text-gray-700 dark:text-gray-300">
      {emoji} {title}
    </h2>
  )
}

export default function Dagplanner() {
  const [rawTasks,   setRawTasks]   = useState([])
  const [rawGoals,   setRawGoals]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [notities,   setNotities]   = useState(() => localStorage.getItem('dp-notities') || '')
  const [planDate,   setPlanDate]   = useState(localDateStr)
  const [checkedIds, setCheckedIds] = useState(new Set())

  useEffect(() => {
    Promise.all([api.get('/tasks'), api.get('/goals')])
      .then(([tasksRes, goalsRes]) => {
        setRawTasks(tasksRes.data || [])
        setRawGoals(goalsRes.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { localStorage.setItem('dp-notities', notities) }, [notities])

  async function handleCheck(item, checked, inlineSubId = null) {
    const key = inlineSubId ? `${item.id}:${inlineSubId}` : String(item.id)
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
    try {
      const id = String(item.id)
      if (inlineSubId) {
        await api.patch(`/tasks/${item.id}/subtasks/${inlineSubId}`, { completed: checked })
      } else if (id.startsWith('goal-')) {
        await api.patch(`/goals/${item._goalId}/actions/${item._actionId}`, { completed: checked })
      } else if (id.startsWith('sub-')) {
        await api.patch(`/tasks/${item._taskId}/subtasks/${item._subId}`, { completed: checked })
      } else if (item._taskId) {
        // 2-minute subtask (numeric id but has _taskId)
        await api.patch(`/tasks/${item._taskId}/subtasks/${item.id}`, { completed: checked })
      } else {
        await api.patch(`/tasks/${item.id}`, { completed: checked })
      }
    } catch {
      // revert on error
      setCheckedIds(prev => {
        const next = new Set(prev)
        if (checked) next.delete(key)
        else next.add(key)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Dagplanner laden...</p>
        </div>
      </div>
    )
  }

  const goalActions = rawGoals.flatMap(goal =>
    (goal.actions || [])
      .filter(a => !a.completed)
      .map(a => ({
        id: `goal-${a.id}`,
        title: a.title,
        deadline: a.deadline,
        completed: false,
        focus: false,
        subtasks: [],
        context: a.context || null,
        tijd_minuten: a.tijd_minuten || null,
        priority: a.priority || null,
        _goalTitle: goal.title,
        _goalId: goal.id,
        _actionId: a.id,
      }))
  )

  const subTaskItems = rawTasks.flatMap(task =>
    (task.subtasks || [])
      .filter(s => !s.completed && s.deadline)
      .map(s => ({
        id: `sub-${s.id}`,
        title: s.text,
        deadline: s.deadline,
        completed: false,
        focus: false,
        subtasks: [],
        context: s.context || null,
        tijd_minuten: s.tijd_minuten || null,
        priority: s.priority || null,
        _parentTask: task.title,
        _taskId: task.id,
        _subId: s.id,
      }))
  )

  const data = getFilteredPlannerData([...rawTasks, ...goalActions, ...subTaskItems], planDate)

  const todayLabel    = formatDate(planDate)
  const tomorrowD     = new Date(planDate + 'T00:00:00')
  tomorrowD.setDate(tomorrowD.getDate() + 1)
  const tomorrowLabel = formatDate(localDateStr(tomorrowD))

  const totalMin = data.today.reduce((s, t) => s + (t.tijd_minuten || 0), 0)
  const uurStr   = totalMin >= 60 ? `${Math.floor(totalMin / 60)}u ` : ''
  const minStr   = totalMin % 60 ? `${totalMin % 60}m` : ''

  function isChecked(key) { return checkedIds.has(String(key)) }

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 p-8">

      {/* ── Header (screen only) ── */}
      <div className="no-print mb-8 bg-white rounded-xl shadow-sm border border-gray-200 dark:bg-gray-900 dark:border-gray-700 px-8 pt-8 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarDays size={20} className="text-accent-600 flex-shrink-0" />
              <h1 className="text-xl font-display font-bold text-gray-900 dark:text-gray-100 tracking-tight">Dagplanner</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{fmtDatum(planDate)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">GTD Productiviteitssysteem</p>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-xs text-accent-700 bg-accent-50 dark:bg-accent-700/10 dark:text-accent-300 rounded-lg px-3 py-1.5">
                <Target size={11} className="text-accent-500" />
                <span><strong>{data.today.length}</strong> taken vandaag</span>
              </div>
              {(data.deadlines.length + data.overdue.length) > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5">
                  <AlertCircle size={11} className="text-orange-400" />
                  <span><strong>{data.deadlines.length + data.overdue.length}</strong> deadlines binnenkort</span>
                </div>
              )}
              {totalMin > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1.5">
                  <Clock size={11} />
                  <span>{uurStr}{minStr} ingepland</span>
                </div>
              )}
              {data.twoMinute.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-accent-700 bg-accent-50 border border-accent-100 rounded-lg px-3 py-1.5">
                  <Zap size={11} className="text-accent-500" />
                  <span><strong>{data.twoMinute.length}</strong> taken van 2 min</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="flex-shrink-0 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-xl px-4 py-2.5 transition-colors"
          >
            <Printer size={14} />
            Afdrukken
          </button>
        </div>
      </div>

      {/* ── PAGINA 1 ── */}
      <div className="page-1">

        <div className="no-print-screen text-center pb-4 mb-8 border-b-4 border-gray-900">
          <h1 className="text-2xl font-bold uppercase tracking-tight">
            DAGPLANNER — {todayLabel}
          </h1>
        </div>

        {/* Vandaag */}
        <section className="section mb-8">
          <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-accent-200 dark:border-accent-700">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">📅 VANDAAG</h2>
            <div className="no-print relative inline-flex items-center">
              <span className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 pr-7 bg-white text-gray-700 select-none">
                {(() => { const [y,m,d] = planDate.split('-'); return `${d}/${m}/${y}` })()}
              </span>
              <Calendar size={13} className="absolute right-2 text-gray-400 pointer-events-none" />
              <input
                type="date"
                lang="nl"
                value={planDate}
                onChange={e => setPlanDate(e.target.value || localDateStr())}
                className="absolute right-0 top-0 bottom-0 w-7 opacity-0 cursor-pointer"
              />
            </div>
          </div>
          <div className="space-y-2">
            {data.today.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Geen taken gepland voor vandaag</p>
            ) : data.today.map(task => {
              const checked = isChecked(task.id)
              return (
                <div key={task.id} className="task text-sm leading-relaxed">
                  <label className="flex gap-2 items-start cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 flex-shrink-0"
                      style={{ accentColor: '#0f6e56' }}
                      checked={checked}
                      onChange={e => handleCheck(task, e.target.checked)}
                    />
                    <span className={checked ? 'line-through text-gray-400' : ''}>
                      {task.title}
                      {task._parentTask  && <span className="text-gray-500"> ({task._parentTask})</span>}
                      {task._goalTitle   && <span className="text-gray-500 inline-flex items-center gap-0.5"> • <Target size={10} className="inline" /> {task._goalTitle}</span>}
                      {task.context      && <span className="text-gray-600"> • {task.context}</span>}
                      {task.tijd_minuten && <span className="text-gray-600"> • {task.tijd_minuten}min</span>}
                      {task.priority     && <span className="text-gray-600"> • {PRIO_NL[task.priority] || task.priority}</span>}
                    </span>
                  </label>
                  {task.subtasks?.length > 0 && (
                    <div className="ml-6 text-xs text-gray-600 mt-1 space-y-0.5">
                      {task.subtasks.map(s => {
                        const subKey = `${task.id}:${s.id}`
                        const subChecked = isChecked(subKey)
                        return (
                          <div key={s.id} className="flex gap-1.5 items-start">
                            <span className="flex-shrink-0 select-none">└─</span>
                            <label className="flex gap-1.5 items-start cursor-pointer">
                              <input
                                type="checkbox"
                                className="mt-0.5 flex-shrink-0"
                                style={{ accentColor: '#0f6e56' }}
                                checked={subChecked}
                                onChange={e => handleCheck(task, e.target.checked, s.id)}
                              />
                              <span className={subChecked ? 'line-through text-gray-400' : ''}>{s.text}</span>
                            </label>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* 2-minuten */}
        <section className="section mb-8">
          <SectionHeader emoji="⚡" title="2-MINUTEN TUSSENDOOR" />
          <div className="space-y-2">
            {data.twoMinute.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Geen 2-minuten taken</p>
            ) : data.twoMinute.map(item => {
              const checked = isChecked(item.id)
              return (
                <div key={item.id} className="task text-sm">
                  <label className="flex gap-2 items-start cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 flex-shrink-0"
                      style={{ accentColor: '#0f6e56' }}
                      checked={checked}
                      onChange={e => handleCheck(item, e.target.checked)}
                    />
                    <span className={checked ? 'line-through text-gray-400' : ''}>
                      {item.title}
                      {item._goalTitle  && <span className="text-gray-500 inline-flex items-center gap-0.5"> • <Target size={10} className="inline" /> {item._goalTitle}</span>}
                      {item.parentTask  && <span className="text-gray-600"> → ({item.parentTask})</span>}
                    </span>
                  </label>
                </div>
              )
            })}
          </div>
        </section>

        {/* Achterstallig */}
        {data.overdue.length > 0 && (
          <section className="section mb-8">
            <SectionHeader emoji="⚠️" title="ACHTERSTALLIG" />
            <div className="space-y-2">
              {data.overdue.map(task => {
                const checked = isChecked(task.id)
                return (
                  <div key={task.id} className="task text-sm">
                    <label className="flex gap-2 items-start cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5 flex-shrink-0"
                        style={{ accentColor: '#0f6e56' }}
                        checked={checked}
                        onChange={e => handleCheck(task, e.target.checked)}
                      />
                      <span className={checked ? 'line-through text-gray-400' : ''}>
                        {task.title}
                        {task._goalTitle   && <span className="text-gray-500 inline-flex items-center gap-0.5"> • <Target size={10} className="inline" /> {task._goalTitle}</span>}
                        {task._parentTask  && <span className="text-gray-500"> ({task._parentTask})</span>}
                        {task.deadline && (
                          <span className="text-gray-600">
                            {' '}• Deadline was {formatDate(dlStr(task.deadline))} ({task.daysOverdue} {task.daysOverdue === 1 ? 'dag' : 'dagen'} te laat)
                          </span>
                        )}
                      </span>
                    </label>
                  </div>
                )
              })}
            </div>
          </section>
        )}

      </div>

      {/* Visual page divider (screen only) */}
      <div className="no-print relative border-t-2 border-dashed border-accent-200 dark:border-accent-700 my-8">
        <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 px-3 bg-white dark:bg-gray-900 text-xs text-gray-400 dark:text-gray-500">
          Pagina 2
        </span>
      </div>

      {/* ── PAGINA 2 ── */}
      <div className="page-2">

        {/* Morgen */}
        <section className="section mb-8">
          <SectionHeader emoji="📆" title={`MORGEN — ${tomorrowLabel}`} />
          <div className="space-y-2">
            {data.tomorrow.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Geen taken gepland voor morgen</p>
            ) : data.tomorrow.map(task => {
              const checked = isChecked(task.id)
              return (
                <div key={task.id} className="task text-sm">
                  <label className="flex gap-2 items-start cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 flex-shrink-0"
                      style={{ accentColor: '#0f6e56' }}
                      checked={checked}
                      onChange={e => handleCheck(task, e.target.checked)}
                    />
                    <span className={checked ? 'line-through text-gray-400' : ''}>
                      {task.title}
                      {task._parentTask  && <span className="text-gray-500"> ({task._parentTask})</span>}
                      {task._goalTitle   && <span className="text-gray-500 inline-flex items-center gap-0.5"> • <Target size={10} className="inline" /> {task._goalTitle}</span>}
                      {task.context      && <span className="text-gray-600"> • {task.context}</span>}
                      {task.tijd_minuten && <span className="text-gray-600"> • {task.tijd_minuten}min</span>}
                    </span>
                  </label>
                </div>
              )
            })}
          </div>
        </section>

        {/* Deadlines */}
        <section className="section mb-8">
          <SectionHeader emoji="🔔" title="DEADLINES KOMENDE 7 DAGEN" />
          <div className="space-y-1">
            {data.deadlines.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Geen deadlines in de komende week</p>
            ) : data.deadlines.map(item => (
              <div key={item.id} className="text-sm">
                <span className="font-medium capitalize">{item.deadlineLabel}</span>
                {' '}• {item.title}
                {item._goalTitle  && <span className="text-gray-500 inline-flex items-center gap-0.5"> • <Target size={10} className="inline" /> {item._goalTitle}</span>}
                {item._parentTask && <span className="text-gray-500"> ({item._parentTask})</span>}
                <span className="text-gray-600">
                  {' '}({item.daysUntil} {item.daysUntil === 1 ? 'dag' : 'dagen'})
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Notities */}
        <section className="section">
          <SectionHeader emoji="📝" title="NOTITIES" />
          <textarea
            value={notities}
            onChange={e => setNotities(e.target.value)}
            placeholder="Schrijf hier losse gedachten, ideeën of aantekeningen voor vandaag..."
            rows={6}
            className="no-print w-full text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-accent-500 dark:focus:border-accent-500 placeholder-gray-300 dark:placeholder-gray-600 bg-white dark:bg-gray-800 leading-relaxed transition-colors"
          />
          <div className="print-only mt-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="border-b border-gray-300 h-6" />
            ))}
          </div>
        </section>

      </div>

    </div>
  )
}

