import { useState, useEffect } from 'react'
import { Clock, CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import api from '../api/client'
import { refreshBadges } from '../api/badges'

function getDaysLeft(deadline) {
  const d = new Date(deadline); d.setHours(0,0,0,0)
  const t = new Date(); t.setHours(0,0,0,0)
  return Math.round((d - t) / 86400000)
}

export default function Wachten() {
  const [tasks, setTasks]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/tasks')
      .then(r => {
        const waiting = r.data.filter(t => !t.completed && t.bestemming === 'wachten')
        waiting.sort((a, b) => {
          const da = a.deadline ? getDaysLeft(a.deadline) : 999
          const db = b.deadline ? getDaysLeft(b.deadline) : 999
          return da - db
        })
        setTasks(waiting)
      })
      .finally(() => setLoading(false))
  }, [])

  async function markDone(taskId) {
    await api.patch(`/tasks/${taskId}`, { completed: true })
    setTasks(ts => ts.filter(t => t.id !== taskId))
    refreshBadges()
  }

  async function moveToActies(taskId) {
    await api.patch(`/tasks/${taskId}`, { bestemming: 'actie' })
    setTasks(ts => ts.filter(t => t.id !== taskId))
    refreshBadges()
  }

  return (
    <div className="max-w-xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-accent-700">Wachten op</h1>
        <p className="text-sm text-gray-400 mt-0.5">Taken waarbij je wacht op iemand anders</p>
      </div>

      {loading && <p className="text-gray-400 text-sm">Laden...</p>}

      {!loading && tasks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Clock size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Geen taken in de wachtrij.</p>
        </div>
      )}

      <div className="space-y-2">
        {tasks.map(task => {
          const days      = task.deadline ? getDaysLeft(task.deadline) : null
          const isOverdue = days !== null && days < 0
          const isToday   = days === 0

          return (
            <div key={task.id}
              className={`bg-white border rounded-xl px-4 py-3 shadow-sm ${
                isOverdue ? 'border-red-200' : isToday ? 'border-orange-200' : 'border-gray-100'
              }`}>
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-accent-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{task.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {isOverdue && (
                      <span className="text-xs text-red-600 font-medium flex items-center gap-0.5">
                        <AlertCircle size={10} />{Math.abs(days)}d verlopen
                      </span>
                    )}
                    {isToday && <span className="text-xs text-orange-600 font-medium">Vandaag!</span>}
                    {days !== null && !isOverdue && !isToday && (
                      <span className="text-xs text-gray-400">over {days}d</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button onClick={() => moveToActies(task.id)}
                    className="text-xs text-accent-600 hover:text-accent-700 transition-colors whitespace-nowrap">
                    → Acties
                  </button>
                  <button onClick={() => markDone(task.id)}
                    className="text-gray-200 hover:text-accent-500 transition-colors self-end">
                    <Circle size={18} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
