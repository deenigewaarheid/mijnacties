import { useState, useEffect } from 'react'
import { FolderKanban, ChevronDown, ChevronRight, CheckCircle2, Circle } from 'lucide-react'
import api from '../api/client'

function SubtaskRow({ subtask, taskId, onToggle }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <button onClick={() => onToggle(taskId, subtask.id, !subtask.completed)}
        className={`flex-shrink-0 transition-colors ${subtask.completed ? 'text-green-500' : 'text-gray-200 hover:text-green-400'}`}>
        {subtask.completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
      </button>
      <span className={`text-xs flex-1 ${subtask.completed ? 'line-through text-gray-300' : 'text-gray-600'}`}>
        {subtask.text}
      </span>
      {subtask.deadline && (
        <span className="text-xs text-gray-300 flex-shrink-0">
          {new Date(subtask.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </div>
  )
}

function ProjectCard({ task, onSubtaskToggle }) {
  const [open, setOpen] = useState(false)
  const subtasks = task.subtasks || []
  const total    = subtasks.length
  const done     = subtasks.filter(s => s.completed).length
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-accent-200 transition-colors">
      <div className="px-4 py-2.5 flex items-center gap-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex-shrink-0 text-gray-300">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <span className="flex-1 text-sm text-gray-900 min-w-0 truncate">{task.title}</span>
        {total > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0 w-32">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-accent-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-400 font-mono w-8 text-right">{done}/{total}</span>
          </div>
        )}
        {task.deadline && (
          <span className="text-xs text-gray-400 flex-shrink-0">
            {new Date(task.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {pct === 100 && <span className="text-xs text-green-600 font-medium flex-shrink-0">Klaar</span>}
      </div>

      {open && (
        <div className="border-t border-gray-100 px-8 py-2 bg-gray-50 dark:bg-gray-800/50">
          {subtasks.length === 0
            ? <p className="text-xs text-gray-400 py-1">Geen subtaken</p>
            : subtasks.map(s => (
                <SubtaskRow key={s.id} subtask={s} taskId={task.id} onToggle={onSubtaskToggle} />
              ))
          }
        </div>
      )}
    </div>
  )
}

export default function Projecten() {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/tasks')
      .then(r => {
        setTasks(r.data.filter(t => !t.completed && t.subtasks && t.subtasks.length > 0))
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSubtaskToggle(taskId, subtaskId, completed) {
    await api.patch(`/tasks/${taskId}/subtasks/${subtaskId}`, { completed })
    setTasks(ts => ts.map(t => {
      if (t.id !== taskId) return t
      return { ...t, subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, completed } : s) }
    }))
  }

  return (
    <div>
      <h1 className="text-xl font-display font-bold text-gray-900 dark:text-gray-100 mb-5">Projecten</h1>

      {loading && <p className="text-gray-400 text-sm">Laden...</p>}

      {!loading && tasks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <FolderKanban size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Geen projecten gevonden.</p>
        </div>
      )}

      <div className="space-y-1.5">
        {tasks.map(task => (
          <ProjectCard key={task.id} task={task} onSubtaskToggle={handleSubtaskToggle} />
        ))}
      </div>
    </div>
  )
}
