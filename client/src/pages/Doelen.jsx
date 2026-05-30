import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Circle, CheckCircle2, ChevronDown, ChevronRight, Pencil, X, Calendar, AlertTriangle, Trophy } from 'lucide-react'
import api from '../api/client'
import { useConfirm } from '../components/ConfirmDialog'

const GOAL_COLORS = [
  { bg: 'bg-accent-600', light: 'bg-accent-50',  border: 'border-accent-200', text: 'text-accent-700', bar: 'bg-accent-500' },
  { bg: 'bg-accent-500', light: 'bg-accent-50',  border: 'border-accent-100', text: 'text-accent-700', bar: 'bg-accent-500' },
  { bg: 'bg-emerald-500',light: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-700',bar: 'bg-emerald-500' },
  { bg: 'bg-orange-500', light: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-700', bar: 'bg-orange-500' },
  { bg: 'bg-rose-500',   light: 'bg-rose-50',    border: 'border-rose-200',   text: 'text-rose-700',   bar: 'bg-rose-500' },
  { bg: 'bg-cyan-500',   light: 'bg-cyan-50',    border: 'border-cyan-200',   text: 'text-cyan-700',   bar: 'bg-cyan-500' },
]
const getColor = i => GOAL_COLORS[i % GOAL_COLORS.length]

function getDaysLeft(dl) {
  if (!dl) return null
  const d = new Date(dl); d.setHours(0,0,0,0)
  const t = new Date(); t.setHours(0,0,0,0)
  return Math.round((d - t) / 86400000)
}

function getWarning(goal) {
  const actions  = goal.actions || []
  const open     = actions.filter(a => !a.completed)
  const days     = getDaysLeft(goal.deadline)

  if (goal.deadline && days < 0 && open.length > 0)
    return { msg: `Deadline verlopen — nog ${open.length} actie${open.length > 1 ? 's' : ''} open`, level: 'error' }
  if (goal.deadline && days !== null && days <= 3 && open.length === 0 && actions.length > 0)
    return { msg: 'Deadline bijna — alle acties klaar, vergeet het doel te bevestigen', level: 'warn' }
  if (goal.deadline && days !== null && days <= 7 && open.length === 0 && actions.length === 0)
    return { msg: 'Deadline bijna maar nog geen acties gepland', level: 'error' }
  if (!goal.deadline && actions.length === 0)
    return null
  if (goal.deadline && actions.length === 0)
    return { msg: 'Geen acties gepland — voeg stappen toe om dit doel te bereiken', level: 'warn' }
  const overActions = actions.filter(a => !a.completed && a.deadline && goal.deadline && a.deadline.slice(0,10) > goal.deadline.slice(0,10))
  if (overActions.length > 0)
    return { msg: `${overActions.length} actie${overActions.length > 1 ? 's hebben' : ' heeft'} een deadline ná het doel`, level: 'error' }
  return null
}

function formatDeadline(dl) {
  if (!dl) return null
  const d = new Date(dl)
  d.setHours(0,0,0,0)
  const t = new Date(); t.setHours(0,0,0,0)
  const days = Math.round((d - t) / 86400000)
  const label = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  if (days < 0)  return { label, cls: 'text-red-600 bg-red-50 border-red-200' }
  if (days === 0) return { label: 'Vandaag', cls: 'text-orange-600 bg-orange-50 border-orange-200' }
  if (days === 1) return { label: 'Morgen',  cls: 'text-orange-500 bg-orange-50 border-orange-200' }
  if (days <= 7)  return { label,            cls: 'text-amber-600 bg-amber-50 border-amber-200' }
  return { label, cls: 'text-gray-400 bg-gray-50 border-gray-200' }
}

// Inline date picker — text DD/MM/JJJJ + calendar icon
function DeadlinePicker({ value, onChange, placeholder = 'Deadline', small = false }) {
  const [text, setText] = useState('')

  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split('-')
      setText(`${d}/${m}/${y}`)
    } else {
      setText('')
    }
  }, [value])

  function handleText(e) {
    let raw = e.target.value.replace(/[^\d/]/g, '')
    if (raw.length === 2 && text.length === 1 && !raw.includes('/')) raw += '/'
    if (raw.length === 5 && text.length === 4 && raw.split('/').length === 2) raw += '/'
    setText(raw)
    const p = raw.split('/')
    if (p.length === 3 && p[0].length <= 2 && p[1].length <= 2 && p[2].length === 4) {
      onChange(`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`)
    } else if (!raw) {
      onChange('')
    }
  }

  function handleNative(e) {
    const iso = e.target.value
    onChange(iso || '')
    if (iso) {
      const [y, m, d] = iso.split('-')
      setText(`${d}/${m}/${y}`)
    } else setText('')
  }

  const sz = small ? 'text-xs py-0.5 px-2' : 'text-sm py-1 px-2.5'

  return (
    <div className="relative flex items-center">
      <input type="text" value={text} onChange={handleText} placeholder={placeholder}
        maxLength={10}
        className={`border border-gray-200 rounded-lg focus:outline-none focus:border-accent-500 text-gray-600 bg-white pr-7 ${sz}`} />
      <div className="absolute right-0 h-full w-7 flex items-center justify-center pointer-events-none">
        <Calendar size={12} className="text-gray-400" />
      </div>
      <input type="date"
        value={value || new Date().toISOString().slice(0,10)}
        onChange={handleNative}
        lang="nl"
        className="absolute right-0 top-0 bottom-0 w-7 opacity-0 cursor-pointer"
        tabIndex={-1} />
    </div>
  )
}

function ActionRow({ action, goalId, goalDeadline, onToggle, onDelete, onUpdate }) {
  const [editing, setEditing]           = useState(false)
  const [text, setText]                 = useState(action.title)
  const [dl, setDl]                     = useState(action.deadline ? action.deadline.slice(0,10) : '')
  const [editPriority, setEditPriority] = useState(action.priority || '')
  const [editContext, setEditContext]   = useState(action.context  || '')
  const [editEnergie, setEditEnergie]   = useState(action.energie  || '')
  const [editTijd, setEditTijd]         = useState(action.tijd_minuten || '')
  const inputRef  = useRef(null)
  const cancelRef = useRef(false)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  async function save() {
    if (!text.trim()) { cancel(); return }
    await onUpdate(goalId, action.id, {
      title: text.trim(), deadline: dl || null,
      priority: editPriority || null, context: editContext || null,
      energie: editEnergie || null, tijd_minuten: editTijd ? parseInt(editTijd) : null,
    })
    setEditing(false)
  }

  function cancel() {
    cancelRef.current = true
    setText(action.title)
    setDl(action.deadline ? action.deadline.slice(0,10) : '')
    setEditPriority(action.priority || '')
    setEditContext(action.context   || '')
    setEditEnergie(action.energie   || '')
    setEditTijd(action.tijd_minuten || '')
    setEditing(false)
  }

  const afterGoal = !action.completed && action.deadline && goalDeadline &&
    action.deadline.slice(0,10) > goalDeadline.slice(0,10)

  const iCls = 'text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-accent-500 bg-white text-gray-800'
  const sCls = `${iCls} cursor-pointer flex-1 min-w-0`

  if (editing) {
    return (
      <div className="space-y-1.5 py-1.5 px-4 border-t border-gray-100"
        onBlur={async e => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            if (!cancelRef.current) await save()
            cancelRef.current = false
          }
        }}>
        <div className="flex items-center gap-2">
          <Circle size={12} className="text-gray-300 flex-shrink-0" />
          <input ref={inputRef} value={text} onChange={e => setText(e.target.value)}
            lang="nl" className={`flex-1 ${iCls}`}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { cancelRef.current = true; cancel() } }} />
          <button onClick={cancel} className="text-gray-400 flex-shrink-0"><X size={13} /></button>
        </div>
        <div className="flex flex-wrap gap-2 pl-5">
          <DeadlinePicker value={dl} onChange={setDl} placeholder="Deadline" small />
          <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className={sCls}>
            <option value="">Prioriteit</option>
            <option value="high">Hoog</option>
            <option value="mid">Gemiddeld</option>
            <option value="low">Laag</option>
          </select>
          <select value={editContext} onChange={e => setEditContext(e.target.value)} className={sCls}>
            <option value="">@ context</option>
            <option value="@school">@school</option>
            <option value="@computer">@computer</option>
            <option value="@telefoon">@telefoon</option>
            <option value="@overleg">@overleg</option>
            <option value="@thuis">@thuis</option>
          </select>
          <select value={editEnergie} onChange={e => setEditEnergie(e.target.value)} className={sCls}>
            <option value="">energie</option>
            <option value="hoog">hoog</option>
            <option value="middel">middel</option>
            <option value="laag">laag</option>
          </select>
          <select value={editTijd} onChange={e => setEditTijd(e.target.value)} className={sCls}>
            <option value="">duur</option>
            <option value="2">2 min</option>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="60">60 min</option>
          </select>
        </div>
      </div>
    )
  }

  return (
    <div className={`group/action flex items-center gap-2.5 px-4 py-2 border-t border-gray-100 ${afterGoal ? 'bg-red-50' : ''}`}>
      <button onClick={() => onToggle(goalId, action.id, !action.completed)}
        className={`flex-shrink-0 transition-colors ${action.completed ? 'text-green-400 hover:text-green-600' : 'text-gray-300 hover:text-gray-500'}`}>
        {action.completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
      </button>

      <span className={`text-sm flex-1 min-w-0 truncate leading-snug ${action.completed ? 'line-through text-gray-300' : 'text-gray-700'}`}>
        {action.title}
      </span>

      {afterGoal && (
        <span className="text-xs text-red-500 flex items-center gap-0.5 font-medium flex-shrink-0">
          <AlertTriangle size={11} />ná doel
        </span>
      )}

      {action.deadline && !action.completed && (
        <span className={`text-xs flex-shrink-0 ${afterGoal ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {(() => { const [y,m,d] = action.deadline.slice(0,10).split('-'); return `${parseInt(d)}/${m}/${y}` })()}
        </span>
      )}

      <div className="flex gap-0.5 opacity-0 group-hover/action:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={() => setEditing(true)} className="p-1 rounded text-gray-300 hover:text-accent-600 transition-colors"><Pencil size={11} /></button>
        <button onClick={() => onDelete(goalId, action.id)} className="p-1 rounded text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
      </div>
    </div>
  )
}

function GoalCard({ goal, colorIdx, onDelete, onAddAction, onToggleAction, onDeleteAction, onUpdateAction, onUpdateGoal }) {
  const [open, setOpen]           = useState(true)
  const [addText, setAddText]     = useState('')
  const [addDl, setAddDl]         = useState('')
  const [adding, setAdding]       = useState(false)
  const [editTitle, setEditTitle] = useState(false)
  const [editDl, setEditDl]       = useState(false)
  const [titleText, setTitleText] = useState(goal.title)
  const [goalDl, setGoalDl]       = useState(goal.deadline ? goal.deadline.slice(0,10) : '')
  const cancelTitleRef = useRef(false)

  const color   = getColor(colorIdx)
  const actions = goal.actions || []
  const total   = actions.length
  const done    = actions.filter(a => a.completed).length
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0
  const dlInfo  = formatDeadline(goal.deadline)
  const warning = getWarning(goal)

  async function addAction(e) {
    e?.preventDefault()
    if (!addText.trim()) return
    setAdding(true)
    try {
      await onAddAction(goal.id, addText.trim(), addDl || null)
      setAddText(''); setAddDl('')
    } finally { setAdding(false) }
  }

  async function saveTitle() {
    if (!titleText.trim()) { cancelTitle(); return }
    await onUpdateGoal(goal.id, { title: titleText.trim() })
    setEditTitle(false)
  }

  function cancelTitle() {
    cancelTitleRef.current = true
    setEditTitle(false)
    setTitleText(goal.title)
  }

  async function saveGoalDl(val) {
    setGoalDl(val)
    await onUpdateGoal(goal.id, { deadline: val || null })
  }

  return (
    <div className={`bg-white rounded-xl border ${color.border} shadow-sm overflow-hidden`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className={`w-1 self-stretch rounded-full ${color.bg} flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            {/* Title */}
            {editTitle ? (
              <div className="flex items-center gap-2"
                onBlur={async e => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    if (!cancelTitleRef.current) await saveTitle()
                    cancelTitleRef.current = false
                  }
                }}>
                <input autoFocus value={titleText} onChange={e => setTitleText(e.target.value)}
                  lang="nl" className="flex-1 text-base font-semibold border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:border-accent-500 bg-white"
                  onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') cancelTitle() }} />
                <button onClick={cancelTitle} className="text-gray-400"><X size={14} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group/title">
                <h2 className="font-semibold text-base text-gray-900 dark:text-gray-100">{goal.title}</h2>
                <button onClick={() => setEditTitle(true)}
                  className="hidden group-hover/title:block text-gray-300 hover:text-accent-600 transition-colors">
                  <Pencil size={12} />
                </button>
              </div>
            )}

            {/* Deadline row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {editDl ? (
                <div className="flex items-center gap-1.5"
                  onBlur={async e => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      await saveGoalDl(goalDl)
                      setEditDl(false)
                    }
                  }}>
                  <DeadlinePicker value={goalDl} onChange={v => setGoalDl(v)} placeholder="Deadline doel" small />
                  <button onClick={() => { setGoalDl(goal.deadline ? goal.deadline.slice(0,10) : ''); setEditDl(false) }}
                    className="text-gray-400"><X size={12} /></button>
                </div>
              ) : dlInfo ? (
                <button onClick={() => setEditDl(true)}
                  className={`text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${dlInfo.cls}`}>
                  <Calendar size={9} />{dlInfo.label}
                </button>
              ) : (
                <button onClick={() => setEditDl(true)}
                  className="text-xs text-gray-300 hover:text-gray-500 flex items-center gap-1 transition-colors">
                  <Calendar size={10} />Deadline instellen
                </button>
              )}
            </div>

            {/* Progress */}
            {total > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${color.bar} rounded-full transition-all duration-300`}
                    style={{ width: `${pct}%` }} />
                </div>
                <span className={`text-xs font-mono ${color.text} opacity-60`}>{done}/{total}</span>
              </div>
            )}
          </div>

          {/* Collapse + delete */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setOpen(o => !o)}
              className={`${color.text} opacity-50 hover:opacity-100 transition-opacity`}>
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <button onClick={() => onDelete(goal.id)}
              className="text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 size={14} />
            </button>
        </div>
      </div>

      {/* Warning banner */}
      {warning && (
        <div className={`flex items-start gap-2 px-4 py-2.5 text-xs font-medium border-b ${
          warning.level === 'error'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <span>{warning.msg}</span>
        </div>
      )}

      {/* Actions */}
      {open && (
        <div className="flex-1">
          {actions.map(action => (
            <ActionRow
              key={action.id}
              action={action}
              goalId={goal.id}
              goalDeadline={goal.deadline}
              onToggle={(gid, aid, completed) => onToggleAction(gid, aid, { completed })}
              onDelete={onDeleteAction}
              onUpdate={onUpdateAction}
            />
          ))}

          {/* Add action */}
          <form onSubmit={addAction}
            className={`flex items-center gap-2 px-4 py-2.5 border-t ${color.border} border-opacity-30 flex-wrap`}>
            <Plus size={13} className="text-gray-300 flex-shrink-0" />
            <input value={addText} onChange={e => setAddText(e.target.value)}
              placeholder="Actie toevoegen..." lang="nl"
              className="flex-1 text-sm text-gray-600 placeholder-gray-300 bg-transparent border-none outline-none min-w-24" />
            {addText.trim() && (
              <>
                <DeadlinePicker value={addDl} onChange={setAddDl} placeholder="Deadline" small />
                <button type="submit" disabled={adding}
                  className={`text-xs ${color.text} font-medium opacity-80 hover:opacity-100 transition-opacity flex-shrink-0`}>
                  Toevoegen
                </button>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  )
}

export default function Doelen() {
  const [goals, setGoals]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc]   = useState('')
  const [newDl, setNewDl]       = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const cancelFormRef = useRef(false)
  const { confirm, dialog: confirmDialog } = useConfirm()

  useEffect(() => {
    api.get('/goals').then(r => setGoals(r.data)).finally(() => setLoading(false))
  }, [])

  async function createGoal(e) {
    e?.preventDefault?.()
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const res = await api.post('/goals', { title: newTitle.trim(), description: newDesc.trim() || null, deadline: newDl || null })
      setGoals(gs => [res.data, ...gs])
      setNewTitle(''); setNewDesc(''); setNewDl(''); setShowForm(false)
    } finally { setSaving(false) }
  }

  function cancelForm() {
    cancelFormRef.current = true
    setShowForm(false); setNewTitle(''); setNewDesc(''); setNewDl('')
  }

  async function deleteGoal(id) {
    const ok = await confirm('Weet je zeker dat je dit doel wilt verwijderen?')
    if (!ok) return
    await api.delete(`/goals/${id}`)
    setGoals(gs => gs.filter(g => g.id !== id))
  }

  async function updateGoal(id, data) {
    const res = await api.patch(`/goals/${id}`, data)
    setGoals(gs => gs.map(g => g.id === id ? { ...g, ...res.data } : g))
  }

  async function addAction(goalId, title, deadline) {
    const res = await api.post(`/goals/${goalId}/actions`, { title, deadline })
    setGoals(gs => gs.map(g =>
      g.id === goalId ? { ...g, actions: [...(g.actions || []), res.data] } : g
    ))
  }

  async function toggleAction(goalId, actionId, data) {
    await api.patch(`/goals/${goalId}/actions/${actionId}`, data)
    setGoals(gs => gs.map(g =>
      g.id === goalId
        ? { ...g, actions: g.actions.map(a => a.id === actionId ? { ...a, ...data } : a) }
        : g
    ))
  }

  async function deleteAction(goalId, actionId) {
    const ok = await confirm('Weet je zeker dat je deze actie wilt verwijderen?')
    if (!ok) return
    await api.delete(`/goals/${goalId}/actions/${actionId}`)
    setGoals(gs => gs.map(g =>
      g.id === goalId ? { ...g, actions: g.actions.filter(a => a.id !== actionId) } : g
    ))
  }

  async function updateAction(goalId, actionId, data) {
    const res = await api.patch(`/goals/${goalId}/actions/${actionId}`, data)
    setGoals(gs => gs.map(g =>
      g.id === goalId
        ? { ...g, actions: g.actions.map(a => a.id === actionId ? { ...a, ...res.data } : a) }
        : g
    ))
  }

  return (
    <>
      {confirmDialog}
      <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-display font-bold text-gray-900 dark:text-gray-100">Doelen</h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            <Plus size={15} />Nieuw doel
          </button>
        )}
      </div>

      {/* New goal form */}
      {showForm && (
        <form onSubmit={createGoal}
          onBlur={async e => {
            if (!e.currentTarget.contains(e.relatedTarget) && newTitle.trim()) {
              if (!cancelFormRef.current) await createGoal()
              cancelFormRef.current = false
            }
          }}
          className="bg-white border border-gray-200 rounded-xl px-5 py-4 mb-6 space-y-3 shadow-sm">
          <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Naam van het doel..." lang="nl"
            className="w-full text-base font-semibold border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-accent-500" />
          <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
            placeholder="Beschrijving (optioneel) — Wanneer is dit doel bereikt?"
            rows={2} lang="nl"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-accent-500 resize-none text-gray-600" />
          <div className="flex items-center gap-3">
            <DeadlinePicker value={newDl} onChange={setNewDl} placeholder="Deadline (optioneel)" />
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={cancelForm}
                className="px-4 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                Annuleren
              </button>
            </div>
          </div>
        </form>
      )}

      {loading && <p className="text-gray-400 text-sm">Laden...</p>}

      {!loading && goals.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Trophy size={40} className="mx-auto mb-4 opacity-30" />
          <p className="font-medium text-gray-500 mb-1">Nog geen doelen</p>
          <p className="text-sm">Voeg je eerste doel toe en koppel er acties aan.</p>
        </div>
      )}

      <div className="space-y-2">
        {goals.map((goal, i) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            colorIdx={i}
            onDelete={deleteGoal}
            onAddAction={addAction}
            onToggleAction={toggleAction}
            onDeleteAction={deleteAction}
            onUpdateAction={updateAction}
            onUpdateGoal={updateGoal}
          />
        ))}
      </div>
    </div>
    </>
  )
}
