import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, Zap, Flame, Moon, Clock } from 'lucide-react'
import api from '../api/client'

const CONTEXT_COLORS = {
  '@school':   'bg-blue-100 text-blue-700',
  '@computer': 'bg-indigo-100 text-indigo-700',
  '@telefoon': 'bg-green-100 text-green-700',
  '@overleg':  'bg-orange-100 text-orange-700',
  '@thuis':    'bg-pink-100 text-pink-700',
}
const ENERGIE_COLORS = {
  hoog:   'bg-red-100 text-red-700',
  middel: 'bg-yellow-100 text-yellow-700',
  laag:   'bg-green-100 text-green-700',
}

function getDaysLeft(deadline) {
  const d = new Date(deadline); d.setHours(0,0,0,0)
  const t = new Date(); t.setHours(0,0,0,0)
  return Math.round((d - t) / 86400000)
}

function sortByUrgency(tasks) {
  const energyRank = { hoog: 0, middel: 1, laag: 2 }
  return [...tasks].sort((a, b) => {
    const da = a.deadline ? getDaysLeft(a.deadline) : 999
    const db = b.deadline ? getDaysLeft(b.deadline) : 999
    if (da !== db) return da - db
    return (energyRank[a.energie] ?? 3) - (energyRank[b.energie] ?? 3)
  })
}

export default function Focus() {
  const [tasks, setTasks]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [contextFilter, setContext] = useState('')
  const [done, setDone]             = useState([])

  function isFocused(t) {
    if (t.focus) return true
    if (t.priority === 'high' && t.deadline && getDaysLeft(t.deadline) <= 4) return true
    return false
  }

  useEffect(() => {
    api.get('/tasks')
      .then(r => setTasks(sortByUrgency(r.data.filter(t => !t.completed && isFocused(t)))))
      .finally(() => setLoading(false))
  }, [])

  async function markDone(taskId) {
    setDone(d => [...d, taskId])
    await api.patch(`/tasks/${taskId}`, { completed: true })
    setTimeout(() => setTasks(ts => ts.filter(t => t.id !== taskId)), 400)
  }

  const contexts = [...new Set(tasks.map(t => t.context).filter(Boolean))]
  const filtered = contextFilter ? tasks.filter(t => t.context === contextFilter) : tasks
  const visible  = filtered

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-blue-900">Wat doe ik nu?</h1>
        <p className="text-sm text-gray-400 mt-0.5">Handmatig gefocust + hoge prioriteit binnen 4 dagen</p>
      </div>

      {contexts.length > 0 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          <button onClick={() => setContext('')}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${!contextFilter ? 'bg-blue-800 text-white border-blue-800' : 'text-gray-500 border-gray-200 hover:border-gray-400'}`}>
            Alles
          </button>
          {contexts.map(ctx => (
            <button key={ctx} onClick={() => setContext(ctx === contextFilter ? '' : ctx)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${contextFilter === ctx ? 'bg-blue-800 text-white border-blue-800' : 'text-gray-500 border-gray-200 hover:border-gray-400'}`}>
              {ctx}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Laden...</p>}

      {!loading && visible.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Geen open taken. Goed bezig!</p>
        </div>
      )}

      <div className="space-y-2">
        {visible.map((task, i) => {
          const days      = task.deadline ? getDaysLeft(task.deadline) : null
          const isOverdue = days !== null && days < 0
          const isToday   = days === 0
          const isDone    = done.includes(task.id)

          return (
            <div key={task.id}
              className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm transition-all ${
                isDone    ? 'opacity-40 scale-95' :
                isOverdue ? 'border-red-200' :
                isToday   ? 'border-orange-200' : 'border-gray-100'
              }`}>
              <span className="text-2xl font-bold text-gray-100 w-7 flex-shrink-0 text-center">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm leading-snug">{task.title}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {task.context && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${CONTEXT_COLORS[task.context] || 'bg-gray-100 text-gray-600'}`}>
                      {task.context}
                    </span>
                  )}
                  {task.energie && (
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-0.5 ${ENERGIE_COLORS[task.energie]}`}>
                      {task.energie === 'hoog' ? <Flame size={9} /> : task.energie === 'laag' ? <Moon size={9} /> : <Zap size={9} />}{task.energie}
                    </span>
                  )}
                  {task.tijd_minuten && (
                    <span className="text-xs text-gray-400 flex items-center gap-0.5">
                      <Clock size={9} />{task.tijd_minuten}min
                    </span>
                  )}
                  {isOverdue && <span className="text-xs text-red-600 font-medium">{Math.abs(days)}d te laat</span>}
                  {isToday   && <span className="text-xs text-orange-600 font-medium">Vandaag!</span>}
                </div>
              </div>
              <button onClick={() => markDone(task.id)}
                className="text-gray-200 hover:text-green-500 transition-colors flex-shrink-0">
                {isDone ? <CheckCircle2 size={20} className="text-green-400" /> : <Circle size={20} />}
              </button>
            </div>
          )
        })}
      </div>

    </div>
  )
}
