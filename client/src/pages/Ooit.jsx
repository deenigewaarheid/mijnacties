import { useState, useEffect } from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import api from '../api/client'
import { refreshBadges } from '../api/badges'
import { useConfirm } from '../components/ConfirmDialog'

export default function Ooit() {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const { confirm, dialog: confirmDialog } = useConfirm()

  useEffect(() => {
    api.get('/tasks')
      .then(r => setTasks(r.data.filter(t => !t.completed && t.bestemming === 'ooit')))
      .finally(() => setLoading(false))
  }, [])

  async function moveToActies(taskId) {
    await api.patch(`/tasks/${taskId}`, { bestemming: 'actie' })
    setTasks(ts => ts.filter(t => t.id !== taskId))
    refreshBadges()
  }

  async function remove(taskId) {
    const ok = await confirm('Weet je zeker dat je dit idee wilt verwijderen?')
    if (!ok) return
    await api.delete(`/tasks/${taskId}`)
    setTasks(ts => ts.filter(t => t.id !== taskId))
    refreshBadges()
  }

  return (
    <>
      {confirmDialog}
      <div className="max-w-xl">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-blue-900">Ooit / misschien</h1>
          <p className="text-sm text-gray-400 mt-0.5">Ideeën en taken zonder concrete deadline</p>
        </div>

        {loading && <p className="text-gray-400 text-sm">Laden...</p>}

        {!loading && tasks.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Sparkles size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Geen ooit/misschien-ideeën.</p>
          </div>
        )}

        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id}
              className="bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm flex items-start gap-3">
              <Sparkles size={15} className="text-purple-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{task.description}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0 items-center">
                <button onClick={() => moveToActies(task.id)}
                  title="Verplaats naar volgende acties"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors">
                  <ArrowRight size={14} />
                  Actie
                </button>
                <button onClick={() => remove(task.id)}
                  className="text-xs text-gray-300 hover:text-red-400 transition-colors">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
