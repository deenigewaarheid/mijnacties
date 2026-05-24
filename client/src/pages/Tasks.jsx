import { useState, useEffect, useRef } from 'react'
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight,
  Trash2, Pencil, Check, X, Plus, Calendar,
  Target, Trophy, Zap, Flame, Moon, Clock, Sparkles, ArrowRight, AlertCircle,
  GraduationCap, Monitor, Phone, Users, Home, List
} from 'lucide-react'
import api from '../api/client'
import { refreshBadges } from '../api/badges'
import { useSearch } from '../context/SearchContext'
import { useConfirm } from '../components/ConfirmDialog'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDaysLeft(deadline) {
  const d = new Date(deadline); d.setHours(0, 0, 0, 0)
  const t = new Date();         t.setHours(0, 0, 0, 0)
  return Math.round((d - t) / 86400000)
}

function isAutoFocus(task) {
  return task.priority === 'high' && task.deadline && getDaysLeft(task.deadline) <= 4
}

function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return `${parseInt(d)}/${m}/${y}`
}

function DateInput({ value, onChange, className }) {
  function toDisplay(iso) {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return d ? `${d}/${m}/${y}` : ''
  }
  function toISO(disp) {
    const p = disp.split('/')
    if (p.length === 3 && p[2].length === 4)
      return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`
    return null
  }
  const [text, setText] = useState(toDisplay(value))
  useEffect(() => setText(toDisplay(value)), [value])
  function handleText(e) {
    let raw = e.target.value.replace(/[^\d/]/g, '')
    if (raw.length === 2 && text.length === 1 && !raw.includes('/')) raw += '/'
    if (raw.length === 5 && text.length === 4 && raw.split('/').length === 2) raw += '/'
    setText(raw)
    const iso = toISO(raw)
    if (iso) onChange(iso)
    else if (!raw) onChange('')
  }
  function handleNative(e) {
    onChange(e.target.value || '')
    setText(toDisplay(e.target.value))
  }
  return (
    <div className="relative inline-flex items-center">
      <input type="text" value={text} onChange={handleText}
        placeholder="dag/maand/jaar" maxLength={10} lang="nl"
        className={`${className} w-full pr-7`} />
      <div className="absolute right-0 top-0 bottom-0 w-7 flex items-center justify-center pointer-events-none">
        <Calendar size={13} className="text-gray-400" />
      </div>
      <input type="date" value={value || ''} onChange={handleNative}
        lang="nl"
        className="absolute right-0 top-0 bottom-0 w-7 opacity-0 cursor-pointer"
        tabIndex={-1} />
    </div>
  )
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const PRIO_BORDER = { high: 'border-l-red-400', mid: 'border-l-amber-400', low: 'border-l-green-400' }
const PRIO_DOT    = { high: 'bg-red-400',        mid: 'bg-amber-400',       low: 'bg-green-400' }
const PRIO_LABEL  = { high: 'Hoog',               mid: 'Gemiddeld',          low: 'Laag' }
const PRIO_CHIP   = { high: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400', mid: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', low: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
const TIJD_OPTIES     = [2, 15, 30, 60]
const TIJD_OPTIES_SUB = [2, 15, 30, 60]

// ─── Chip — small metadata label ─────────────────────────────────────────────

function Chip({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium ${className}`}>
      {children}
    </span>
  )
}

// ─── SubtaskItem ─────────────────────────────────────────────────────────────

function SubtaskItem({ sub, taskId, onToggle, onUpdate, onDelete }) {
  const [editing,     setEditing]     = useState(false)
  const [editText,    setEditText]    = useState(sub.text)
  const [editDeadline,setEditDeadline]= useState(sub.deadline ? sub.deadline.slice(0, 10) : '')
  const [editPriority,setEditPriority]= useState(sub.priority || '')
  const [editContext, setEditContext] = useState(sub.context  || '')
  const [editEnergie, setEditEnergie] = useState(sub.energie  || '')
  const [editTijd,    setEditTijd]    = useState(sub.tijd_minuten || '')
  const cancelRef = useRef(false)

  const deadlineDate = sub.deadline ? new Date(sub.deadline) : null
  const isOverdue    = deadlineDate && !sub.completed && getDaysLeft(sub.deadline) < 0

  async function save() {
    if (!editText.trim()) return
    await onUpdate(taskId, sub.id, {
      text: editText.trim(), deadline: editDeadline || null,
      priority: editPriority || null, context: editContext || null,
      energie: editEnergie || null, tijd_minuten: editTijd ? parseInt(editTijd) : null,
    })
    setEditing(false)
  }

  function cancel() {
    cancelRef.current = true
    setEditText(sub.text)
    setEditDeadline(sub.deadline ? sub.deadline.slice(0, 10) : '')
    setEditPriority(sub.priority || '')
    setEditContext(sub.context  || '')
    setEditEnergie(sub.energie  || '')
    setEditTijd(sub.tijd_minuten || '')
    setEditing(false)
  }

  if (editing) {
    const iCls = 'text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400 bg-transparent text-gray-800 dark:text-gray-200'
    const sCls = `${iCls} cursor-pointer flex-1 min-w-0`
    return (
      <div className="space-y-1.5 py-1 pl-1"
        onBlur={async e => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            if (!cancelRef.current) await save()
            cancelRef.current = false
          }
        }}>
        <div className="flex items-center gap-2">
          <Circle size={12} className="text-gray-300 flex-shrink-0" />
          <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') cancel() }}
            lang="nl" className={`flex-1 ${iCls}`} />
          <button onClick={cancel} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={13} /></button>
        </div>
        <div className="flex flex-wrap gap-2 pl-5">
          <DateInput value={editDeadline} onChange={v => setEditDeadline(v ?? '')} className={iCls} />
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
            {TIJD_OPTIES_SUB.map(t => <option key={t} value={t}>{t} min</option>)}
          </select>
        </div>
      </div>
    )
  }

  return (
    <div className="group/sub flex items-center gap-2.5 py-1.5">
      <button onClick={() => onToggle(taskId, sub.id, !sub.completed)}
        className={`flex-shrink-0 transition-colors ${sub.completed ? 'text-green-400 hover:text-green-600' : 'text-gray-300 hover:text-gray-500'}`}>
        {sub.completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
      </button>

      <span className={`text-sm flex-1 leading-snug ${sub.completed ? 'line-through text-gray-300 dark:text-gray-600' : 'text-gray-600 dark:text-gray-400'}`}>
        {sub.text}
      </span>

      {deadlineDate && (
        <span className={`text-xs flex-shrink-0 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {fmtDate(sub.deadline)}
        </span>
      )}

      <div className="flex gap-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity flex-shrink-0">
        <button onClick={e => { e.stopPropagation(); setEditing(true) }}
          className="p-1 rounded text-gray-300 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <Pencil size={11} />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(taskId, sub.id) }}
          className="p-1 rounded text-gray-300 hover:text-red-400 transition-colors">
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

// ─── TaskItem ─────────────────────────────────────────────────────────────────

function TaskItem({ task, onToggle, onSubtaskToggle, onDelete, onUpdate, onSubtaskAdd, onSubtaskUpdate, onSubtaskDelete, onFocusToggle, onTimeChange, onSubtaskTimeChange }) {
  const [open,         setOpen]         = useState(false)
  const [editing,      setEditing]      = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [editTitle,       setEditTitle]       = useState(task.title)
  const [editDeadline,    setEditDeadline]    = useState(task.deadline ? task.deadline.slice(0, 10) : '')
  const [editPriority,    setEditPriority]    = useState(task.priority)
  const [editCategory,    setEditCategory]    = useState(task.category || '')
  const [editContext,     setEditContext]     = useState(task.context  || '')
  const [editEnergie,     setEditEnergie]     = useState(task.energie  || '')
  const [editTijd,        setEditTijd]        = useState(task.tijd_minuten || '')
  const [editDescription, setEditDescription] = useState(task.description || '')
  const [newSubText,      setNewSubText]      = useState('')
  const cancelEditRef = useRef(false)

  const deadlineDate = task.deadline ? new Date(task.deadline) : null
  const isOverdue    = deadlineDate && !task.completed && getDaysLeft(task.deadline) < 0
  const dl           = task.deadline ? getDaysLeft(task.deadline) : null
  const hasMeta      = task.context || task.energie || task.tijd_minuten
  const subs         = task.subtasks || []
  const openSubs     = subs.filter(s => !s.completed).length
  const isFocused    = task.focus || isAutoFocus(task)
  const borderColor  = PRIO_BORDER[task.priority] || 'border-l-gray-200 dark:border-l-gray-700'

  async function handleComplete() {
    setIsCompleting(true)
    await new Promise(resolve => setTimeout(resolve, 400))
    await onToggle(task.id, true)
    setIsCompleting(false)
  }

  function startEdit(e) {
    e.stopPropagation()
    setEditTitle(task.title)
    setEditDeadline(task.deadline ? task.deadline.slice(0, 10) : '')
    setEditPriority(task.priority || 'mid')
    setEditCategory(task.category || '')
    setEditContext(task.context   || '')
    setEditEnergie(task.energie   || '')
    setEditTijd(task.tijd_minuten || '')
    setEditDescription(task.description || '')
    setEditing(true)
  }

  async function saveEdit() {
    if (!editTitle.trim()) { setEditing(false); return }
    await onUpdate(task.id, {
      title: editTitle, deadline: editDeadline || null,
      priority: editPriority, category: editCategory || null,
      context: editContext || null, energie: editEnergie || null,
      tijd_minuten: editTijd ? parseInt(editTijd) : null,
      description: editDescription || null,
    })
    setEditing(false)
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  if (editing) {
    const inputCls = 'border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500'
    const selectCls = `${inputCls} cursor-pointer`
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl p-4 shadow-sm space-y-3"
        onBlur={async e => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            if (!cancelEditRef.current) await saveEdit()
            cancelEditRef.current = false
          }
        }}>
        <div className="flex items-center gap-2">
          <Circle size={16} className="text-gray-300 flex-shrink-0" />
          <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { cancelEditRef.current = true; setEditing(false) } }}
            lang="nl" className={`flex-1 font-medium ${inputCls}`} placeholder="Taaknaam" />
        </div>

        <div className="flex flex-wrap gap-2 pl-6">
          <DateInput value={editDeadline} onChange={v => setEditDeadline(v ?? '')}
            className={`${inputCls} text-xs`} />
          <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className={`${selectCls} text-xs flex-1 min-w-0`}>
            <option value="high">Hoog</option>
            <option value="mid">Gemiddeld</option>
            <option value="low">Laag</option>
          </select>
          <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className={`${selectCls} text-xs flex-1 min-w-0`}>
            <option value="">Categorie</option>
            <option value="werk">Werk</option>
            <option value="privé">Privé</option>
          </select>
          <select value={editContext} onChange={e => setEditContext(e.target.value)} className={`${selectCls} text-xs flex-1 min-w-0`}>
            <option value="">@ context</option>
            <option value="@school">@school</option>
            <option value="@computer">@computer</option>
            <option value="@telefoon">@telefoon</option>
            <option value="@overleg">@overleg</option>
            <option value="@thuis">@thuis</option>
          </select>
          <select value={editEnergie} onChange={e => setEditEnergie(e.target.value)} className={`${selectCls} text-xs flex-1 min-w-0`}>
            <option value="">energie</option>
            <option value="hoog">hoog</option>
            <option value="middel">middel</option>
            <option value="laag">laag</option>
          </select>
          <select value={editTijd} onChange={e => setEditTijd(e.target.value)} className={`${selectCls} text-xs flex-1 min-w-0`}>
            <option value="">duur</option>
            {TIJD_OPTIES.map(t => <option key={t} value={t}>{t} min</option>)}
          </select>
        </div>

        <div className="pl-6">
          <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)}
            placeholder="Notitie (optioneel)..." rows={2} lang="nl"
            className={`w-full resize-none text-xs ${inputCls}`} />
        </div>

        {/* Subtasks */}
        <div className="pl-6 space-y-0.5">
          {subs.map(sub => (
            <SubtaskItem key={sub.id} sub={sub} taskId={task.id}
              onToggle={onSubtaskToggle}
              onUpdate={onSubtaskUpdate}
              onDelete={onSubtaskDelete} />
          ))}
          <form onSubmit={async e => { e.preventDefault(); if (!newSubText.trim()) return; await onSubtaskAdd(task.id, newSubText.trim()); setNewSubText('') }}
            className="flex items-center gap-2 mt-1">
            <Plus size={12} className="text-gray-400 flex-shrink-0" />
            <input value={newSubText} onChange={e => setNewSubText(e.target.value)}
              placeholder="Subtaak toevoegen..." lang="nl"
              className="flex-1 text-xs text-gray-600 dark:text-gray-400 bg-transparent border-none outline-none placeholder-gray-300 dark:placeholder-gray-600" />
          </form>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={() => { cancelEditRef.current = true; setEditing(false) }}
            className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg transition-colors">
            Annuleren
          </button>
        </div>
      </div>
    )
  }

  // ── Display mode ──────────────────────────────────────────────────────────
  return (
    <div className={`group relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 border-l-4 ${borderColor} rounded-xl px-4 py-3.5 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all duration-200 ${isCompleting ? 'opacity-0 scale-95 translate-x-4' : 'opacity-100 scale-100'}`}>
      <div className="flex items-start gap-3">

        {/* Checkbox */}
        <button onClick={() => task.completed ? onToggle(task.id, false) : handleComplete()}
          className={`mt-0.5 flex-shrink-0 transition-colors ${task.completed ? 'text-green-400' : 'text-gray-200 hover:text-gray-500 dark:hover:text-gray-400'}`}>
          {task.completed
            ? <CheckCircle2 size={18} />
            : <Circle size={18} />}
        </button>

        {/* Body */}
        <div className="flex-1 min-w-0">

          {/* Title + deadline */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-sm font-medium leading-snug transition-all duration-300 ${task.completed ? 'line-through text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-gray-100'}`}>
              {task.title}
            </span>
            {task.deadline && (
              <span className={`inline-flex items-center gap-1 text-xs flex-shrink-0 tabular-nums ${
                isOverdue ? 'text-red-500 font-semibold' :
                dl === 0   ? 'text-orange-500 font-medium' :
                dl === 1   ? 'text-amber-500 font-medium' :
                             'text-gray-400 dark:text-gray-500'
              }`}>
                {isOverdue && <AlertCircle size={11} />}
                {isOverdue ? `${Math.abs(dl)}d verlopen` :
                 dl === 0  ? 'vandaag' :
                 dl === 1  ? 'morgen' :
                             `· ${fmtDate(task.deadline)}`}
              </span>
            )}
          </div>

          {/* Meta row — only filled fields */}
          {hasMeta && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {task.context && (
                <Chip className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  {task.context}
                </Chip>
              )}
              {task.energie && (
                <Chip className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  {task.energie === 'hoog' ? <Flame size={10} /> : task.energie === 'laag' ? <Moon size={10} /> : <Zap size={10} />}{task.energie}
                </Chip>
              )}
              {task.tijd_minuten && (
                <Chip className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  <Clock size={10} />{task.tijd_minuten}m
                </Chip>
              )}
            </div>
          )}

          {/* Note preview */}
          {task.description && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 leading-relaxed line-clamp-1">
              {task.description}
            </p>
          )}

          {/* Subtask toggle */}
          {subs.length > 0 && (
            <button onClick={() => setOpen(o => !o)}
              className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>
                {openSubs > 0
                  ? `${openSubs} van ${subs.length} subtaken`
                  : `${subs.length} subtaken ✓`}
              </span>
              {/* Mini progress bar */}
              <div className="w-16 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden ml-1">
                <div className="h-full bg-green-400 rounded-full transition-all"
                  style={{ width: `${Math.round(((subs.length - openSubs) / subs.length) * 100)}%` }} />
              </div>
            </button>
          )}

          {/* Subtasks */}
          {open && subs.length > 0 && (
            <div className="mt-2 pl-3 border-l-2 border-gray-100 dark:border-gray-800 space-y-0.5">
              {subs.map(sub => (
                <SubtaskItem key={sub.id} sub={sub} taskId={task.id}
                  onToggle={onSubtaskToggle}
                  onUpdate={onSubtaskUpdate}
                  onDelete={onSubtaskDelete} />
              ))}
            </div>
          )}
        </div>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
          <button onClick={e => { e.stopPropagation(); onFocusToggle(task.id, !task.focus) }}
            title={task.focus ? 'Verwijder uit focus' : 'Voeg toe aan focus'}
            className={`p-1.5 rounded-lg transition-colors ${isFocused ? 'text-orange-400' : 'text-gray-300 hover:text-orange-400'}`}>
            <Target size={14} fill={isFocused ? 'currentColor' : 'none'} />
          </button>
          <button onClick={startEdit}
            className="p-1.5 rounded-lg text-gray-300 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(task.id) }}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Goal action item ─────────────────────────────────────────────────────────

function GoalActionItem({ action, onToggle }) {
  const deadlineDate = action.deadline ? new Date(action.deadline) : null
  const days         = action.deadline ? getDaysLeft(action.deadline) : null
  const isOverdue    = days !== null && days < 0

  return (
    <div className="group relative bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/40 border-l-4 border-l-violet-400 rounded-xl px-4 py-3.5 hover:border-violet-200 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3">
        <button onClick={() => onToggle(action.goalId, action.id)}
          className="mt-0.5 flex-shrink-0 text-violet-300 hover:text-violet-500 transition-colors">
          <Circle size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{action.title}</span>
            {deadlineDate && (
              <span className={`inline-flex items-center gap-1 text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                {isOverdue && <AlertCircle size={11} />}
                {isOverdue ? `${Math.abs(days)}d verlopen` : `· ${fmtDate(action.deadline)}`}
              </span>
            )}
          </div>
          <Chip className="mt-1.5 bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
            <Trophy size={9} /> {action.goalTitle}
          </Chip>
        </div>
      </div>
    </div>
  )
}

// ─── Urgency zones ────────────────────────────────────────────────────────────

const URGENCY_ZONES = [
  { label: 'Verlopen',         color: 'text-red-600',     test: d => d !== null && d < 0 },
  { label: 'Vandaag & morgen', color: 'text-orange-600',  test: d => d !== null && d >= 0 && d <= 1 },
  { label: '2 – 3 dagen',      color: 'text-orange-500',  test: d => d !== null && d >= 2 && d <= 3 },
  { label: '4 – 7 dagen',      color: 'text-amber-600',   test: d => d !== null && d >= 4 && d <= 7 },
  { label: '8 – 14 dagen',     color: 'text-blue-600',    test: d => d !== null && d >= 8 && d <= 14 },
  { label: 'Meer dan 2 weken', color: 'text-emerald-600', test: d => d !== null && d > 14 },
  { label: 'Geen deadline',    color: 'text-gray-400',    test: d => d === null },
]

// ─── Focus tab ───────────────────────────────────────────────────────────────

function FocusTab() {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [ctxFilter, setCtx]   = useState('')
  const [done, setDone]       = useState([])

  function isFocused(t) {
    return t.focus || (t.priority === 'high' && t.deadline && getDaysLeft(t.deadline) <= 4)
  }

  useEffect(() => {
    api.get('/tasks')
      .then(r => setTasks(
        r.data.filter(t => !t.completed && isFocused(t))
          .sort((a, b) => {
            const da = a.deadline ? getDaysLeft(a.deadline) : 999
            const db = b.deadline ? getDaysLeft(b.deadline) : 999
            return da - db
          })
      ))
      .finally(() => setLoading(false))
  }, [])

  async function markDone(id) {
    setDone(d => [...d, id])
    await api.patch(`/tasks/${id}`, { completed: true })
    setTimeout(() => setTasks(ts => ts.filter(t => t.id !== id)), 400)
    refreshBadges()
  }

  const contexts = [...new Set(tasks.map(t => t.context).filter(Boolean))]
  const visible  = ctxFilter ? tasks.filter(t => t.context === ctxFilter) : tasks

  return (
    <div>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">Handmatig gefocust of hoge prioriteit binnen 4 dagen</p>

      {contexts.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <button onClick={() => setCtx('')}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${!ctxFilter ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent' : 'text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400'}`}>
            Alle contexten
          </button>
          {contexts.map(ctx => (
            <button key={ctx} onClick={() => setCtx(ctx === ctxFilter ? '' : ctx)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${ctxFilter === ctx ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent' : 'text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400'}`}>
              {ctx}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-gray-400 text-sm">Laden...</p>}
      {!loading && visible.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Geen focustaken. Goed bezig!</p>
        </div>
      )}

      <div className="space-y-2">
        {visible.map((task, i) => {
          const dl        = task.deadline ? getDaysLeft(task.deadline) : null
          const isOverdue = dl !== null && dl < 0
          const isDone    = done.includes(task.id)
          return (
            <div key={task.id}
              className={`group flex items-center gap-4 bg-white dark:bg-gray-900 border rounded-xl px-5 py-4 transition-all ${
                isDone      ? 'opacity-40 scale-95' :
                isOverdue   ? 'border-red-200 dark:border-red-800' :
                dl === 0    ? 'border-orange-200 dark:border-orange-800' :
                              'border-gray-100 dark:border-gray-800'
              }`}>
              <span className="text-3xl font-black text-gray-100 dark:text-gray-800 w-8 flex-shrink-0 select-none">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">{task.title}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {task.context    && <Chip className="bg-gray-50 dark:bg-gray-800 text-gray-500">{task.context}</Chip>}
                  {task.energie    && <Chip className="bg-gray-50 dark:bg-gray-800 text-gray-500">{task.energie === 'hoog' ? <Flame size={10} /> : task.energie === 'laag' ? <Moon size={10} /> : <Zap size={10} />}{task.energie}</Chip>}
                  {task.tijd_minuten && <Chip className="bg-gray-50 dark:bg-gray-800 text-gray-500"><Clock size={10} />{task.tijd_minuten}m</Chip>}
                  {isOverdue       && <span className="text-xs text-red-500 font-medium">{Math.abs(dl)}d verlopen</span>}
                  {dl === 0        && <span className="text-xs text-orange-500 font-medium">Vandaag</span>}
                </div>
              </div>
              <button onClick={() => markDone(task.id)}
                className={`transition-colors flex-shrink-0 ${isDone ? 'text-green-400' : 'text-gray-200 hover:text-green-500'}`}>
                {isDone ? <CheckCircle2 size={22} /> : <Circle size={22} />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Wachten tab ─────────────────────────────────────────────────────────────

function WachtenTab() {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding]   = useState(false)

  useEffect(() => {
    api.get('/tasks')
      .then(r => {
        const w = r.data.filter(t => !t.completed && t.bestemming === 'wachten')
        w.sort((a, b) => (a.deadline ? getDaysLeft(a.deadline) : 999) - (b.deadline ? getDaysLeft(b.deadline) : 999))
        setTasks(w)
      })
      .finally(() => setLoading(false))
  }, [])

  async function addTask(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const res = await api.post('/tasks', { title: newTitle.trim(), bestemming: 'wachten' })
      setTasks(ts => [...ts, res.data]); setNewTitle(''); refreshBadges()
    } finally { setAdding(false) }
  }

  async function markDone(id)    { await api.patch(`/tasks/${id}`, { completed: true });      setTasks(ts => ts.filter(t => t.id !== id)); refreshBadges() }
  async function toActies(id)    { await api.patch(`/tasks/${id}`, { bestemming: 'actie' });   setTasks(ts => ts.filter(t => t.id !== id)); refreshBadges() }

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">Taken waarbij je wacht op iemand anders</p>
      <form onSubmit={addTask} className="flex gap-2 mb-6">
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
          placeholder="Wacht op..." lang="nl"
          className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-gray-400 bg-transparent text-gray-800 dark:text-gray-200" />
        <button type="submit" disabled={adding || !newTitle.trim()}
          className="text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2.5 rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-colors font-medium">
          + Toevoegen
        </button>
      </form>
      {loading && <p className="text-gray-400 text-sm">Laden...</p>}
      {!loading && tasks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Clock size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Geen taken in de wachtrij.</p>
        </div>
      )}
      <div className="space-y-2">
        {tasks.map(task => {
          const dl = task.deadline ? getDaysLeft(task.deadline) : null
          const isOverdue = dl !== null && dl < 0
          return (
            <div key={task.id}
              className={`group bg-white dark:bg-gray-900 border border-l-4 border-l-yellow-400 rounded-xl px-4 py-3.5 transition-all hover:shadow-sm ${isOverdue ? 'border-red-200 dark:border-red-800' : 'border-gray-100 dark:border-gray-800'}`}>
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
                  {task.description && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{task.description}</p>}
                  {dl !== null && (
                    <p className={`text-xs mt-1.5 font-medium ${isOverdue ? 'text-red-500' : dl === 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                      {isOverdue ? `${Math.abs(dl)}d verlopen` : dl === 0 ? 'Vandaag' : `over ${dl}d`}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                  <button onClick={() => toActies(task.id)}
                    className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center gap-1">
                    <ArrowRight size={12} /> Acties
                  </button>
                  <button onClick={() => markDone(task.id)}
                    className="text-gray-200 hover:text-green-500 transition-colors">
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

// ─── Ooit tab ─────────────────────────────────────────────────────────────────

function OoitTab() {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding]   = useState(false)

  useEffect(() => {
    api.get('/tasks')
      .then(r => setTasks(r.data.filter(t => !t.completed && t.bestemming === 'ooit')))
      .finally(() => setLoading(false))
  }, [])

  async function addTask(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const res = await api.post('/tasks', { title: newTitle.trim(), bestemming: 'ooit' })
      setTasks(ts => [...ts, res.data]); setNewTitle(''); refreshBadges()
    } finally { setAdding(false) }
  }

  const { confirm: confirmOoit, dialog: confirmOoitDialog } = useConfirm()

  async function toActies(id) { await api.patch(`/tasks/${id}`, { bestemming: 'actie' }); setTasks(ts => ts.filter(t => t.id !== id)); refreshBadges() }
  async function remove(id) {
    const ok = await confirmOoit('Weet je zeker dat je dit idee wilt verwijderen?')
    if (!ok) return
    await api.delete(`/tasks/${id}`)
    setTasks(ts => ts.filter(t => t.id !== id)); refreshBadges()
  }

  return (
    <>
      {confirmOoitDialog}
      <div className="max-w-2xl">
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">Ideeën en taken zonder concrete deadline</p>
      <form onSubmit={addTask} className="flex gap-2 mb-6">
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
          placeholder="Idee of taak toevoegen..." lang="nl"
          className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:outline-none focus:border-gray-400 bg-transparent text-gray-800 dark:text-gray-200" />
        <button type="submit" disabled={adding || !newTitle.trim()}
          className="text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2.5 rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-colors font-medium">
          + Toevoegen
        </button>
      </form>
      {loading && <p className="text-gray-400 text-sm">Laden...</p>}
      {!loading && tasks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Sparkles size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Geen ooit/misschien-ideeën.</p>
        </div>
      )}
      <div className="space-y-2">
        {tasks.map(task => (
          <div key={task.id}
            className="group bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 border-l-4 border-l-purple-300 rounded-xl px-4 py-3.5 flex items-center gap-3 hover:border-gray-200 hover:shadow-sm transition-all">
            <Sparkles size={15} className="text-purple-300 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
              {task.description && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{task.description}</p>}
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button onClick={() => toActies(task.id)}
                className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition-colors">
                <ArrowRight size={12} /> Actie
              </button>
              <button onClick={() => remove(task.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
    </>
  )
}

// ─── Losse eindjes tab ───────────────────────────────────────────────────────

function LosseEindjesTab({ onProcessed }) {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [editTitle, setEditTitle] = useState('')

  function load() {
    setLoading(true)
    api.get('/tasks')
      .then(r => setTasks(r.data.filter(t => !t.completed && t.bestemming === 'losse_eindjes')))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function verplaats(id, bestemming) {
    await api.patch(`/tasks/${id}`, { bestemming })
    setTasks(ts => ts.filter(t => t.id !== id)); refreshBadges()
    if (onProcessed) onProcessed()
  }
  const { confirm: confirmLosse, dialog: confirmLosseDialog } = useConfirm()

  async function verwijder(id) {
    const ok = await confirmLosse('Weet je zeker dat je deze taak wilt verwijderen?')
    if (!ok) return
    await api.delete(`/tasks/${id}`)
    setTasks(ts => ts.filter(t => t.id !== id)); refreshBadges()
  }
  async function saveTitle(id) {
    if (!editTitle.trim()) return
    await api.patch(`/tasks/${id}`, { title: editTitle.trim() })
    setTasks(ts => ts.map(t => t.id === id ? { ...t, title: editTitle.trim() } : t)); setEditing(null)
  }

  const BESTEMMINGEN = [
    { key: 'actie',   label: 'Actie',  cls: 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700' },
    { key: 'wachten', label: 'Wachten', cls: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 border border-yellow-200' },
    { key: 'ooit',    label: 'Ooit',    cls: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-100 border border-purple-200' },
  ]

  return (
    <>
      {confirmLosseDialog}
      <div>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">
        Snel vastgelegde taken — verwerk ze door een bestemming te kiezen
      </p>
      {loading && <p className="text-gray-400 text-sm">Laden...</p>}
      {!loading && tasks.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Inbox nul! Alles verwerkt.</p>
        </div>
      )}
      <div className="space-y-2">
        {tasks.map(task => (
          <div key={task.id}
            className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3.5">
            <div className="flex items-center gap-2 mb-3">
              {editing === task.id ? (
                <>
                  <input autoFocus value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTitle(task.id); if (e.key === 'Escape') setEditing(null) }}
                    lang="nl" className="flex-1 text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1 focus:outline-none bg-transparent text-gray-800 dark:text-gray-200" />
                  <button onClick={() => saveTitle(task.id)} className="text-green-500 hover:text-green-700"><Check size={14} /></button>
                  <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                </>
              ) : (
                <>
                  <p className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
                  <button onClick={() => { setEditing(task.id); setEditTitle(task.title) }}
                    className="text-gray-300 hover:text-gray-500 transition-colors"><Pencil size={13} /></button>
                  <button onClick={() => verwijder(task.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                </>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {BESTEMMINGEN.map(b => (
                <button key={b.key} onClick={() => verplaats(task.id, b.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${b.cls}`}>
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
    </>
  )
}

// ─── Context grouped view ────────────────────────────────────────────────────

const CONTEXT_DEFS = [
  { key: '@school',   icon: GraduationCap, label: 'Op school'       },
  { key: '@computer', icon: Monitor,       label: 'Achter computer'  },
  { key: '@telefoon', icon: Phone,         label: 'Telefoon'         },
  { key: '@overleg',  icon: Users,         label: 'In gesprek'       },
  { key: '@thuis',    icon: Home,          label: 'Thuis'            },
  { key: null,        icon: List,          label: 'Zonder context'   },
]

function fmtTijd(minuten) {
  const h = Math.floor(minuten / 60)
  const m = minuten % 60
  if (h > 0) return m > 0 ? `${h}u ${m}m` : `${h}u`
  return `${m}m`
}

function ContextGroupedView({ tasks, taskProps }) {
  const open = tasks.filter(t => !t.completed)

  const groups = CONTEXT_DEFS.map(def => {
    const items = def.key === null
      ? open.filter(t => !t.context)
      : open.filter(t => t.context === def.key)
    const totalTime = items.reduce((acc, t) => acc + (t.tijd_minuten || 15), 0)
    return { ...def, items, totalTime }
  }).filter(g => g.items.length > 0)

  if (groups.length === 0) return (
    <div className="text-center py-16 text-gray-400 dark:text-gray-600">
      <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
      <p className="text-sm">Geen taken om te tonen.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <div key={group.key ?? '_none'}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                <group.icon size={16} className="text-gray-500 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{group.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {group.items.length} {group.items.length === 1 ? 'taak' : 'taken'}
                </p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{fmtTijd(group.totalTime)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Geschat</p>
            </div>
          </div>
          <div className="space-y-2">
            {group.items.map(task => (
              <TaskItem key={task.id} task={task} {...taskProps} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Energy filter ───────────────────────────────────────────────────────────

const ENERGY_OPTS = [
  { key: 'hoog',   Icon: Flame, label: 'Hoge energie',   desc: 'Je bent scherp en productief' },
  { key: 'middel', Icon: Zap,   label: 'Normale energie', desc: 'Reguliere taken' },
  { key: 'laag',   Icon: Moon,  label: 'Lage energie',    desc: 'Simpele, routine taken' },
]

function EnergyFilter({ tasks, currentEnergy, onSelect }) {
  const open = tasks.filter(t => !t.completed)
  const counts = {
    hoog:   open.filter(t => t.energie === 'hoog').length,
    middel: open.filter(t => t.energie === 'middel').length,
    laag:   open.filter(t => t.energie === 'laag').length,
  }
  return (
    <select
      value={currentEnergy || ''}
      onChange={e => onSelect(e.target.value || null)}
      className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 focus:outline-none focus:border-gray-400 cursor-pointer"
    >
      <option value="">⚡ Energie</option>
      {ENERGY_OPTS.map(({ key, label }) => (
        <option key={key} value={key}>{label} ({counts[key]})</option>
      ))}
    </select>
  )
}

// ─── Formulier voor nieuwe taak ──────────────────────────────────────────────

const EMPTY_FORM = { title: '', deadline: '', priority: 'mid', category: '', description: '', subtasks: [] }
const FILTERS = [
  { key: 'all',      label: 'Alle taken' },
  { key: 'context',  label: 'Per context' },
  { key: 'today',    label: 'Vandaag' },
  { key: '2min',     label: '2 min', icon: Zap },
  { key: 'upcoming', label: 'Komende 30d' },
  { key: 'completed',label: 'Voltooid' },
]

// ─── Main component ──────────────────────────────────────────────────────────

export default function Tasks() {
  const { query: searchQuery } = useSearch()
  const [mainTab, setMainTab] = useState('acties')
  const [tab,     setTab]     = useState('all')
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [saving,  setSaving]  = useState(false)
  const [goalActions, setGoalActions] = useState([])
  const [tabCounts,   setTabCounts]   = useState({})
  const [collapsed,   setCollapsed]   = useState({})
  const [currentEnergy, setCurrentEnergy] = useState(null)
  const { confirm, dialog: confirmDialog } = useConfirm()

  useEffect(() => {
    function loadCounts() {
      api.get('/tasks').then(r => {
        const open = r.data.filter(t => !t.completed)
        setTabCounts({
          losse:   open.filter(t => t.bestemming === 'losse_eindjes').length,
          acties:  open.filter(t => !t.bestemming || t.bestemming === 'actie' || t.bestemming === 'kalender').length,
          wachten: open.filter(t => t.bestemming === 'wachten').length,
          ooit:    r.data.filter(t => t.bestemming === 'ooit').length,
        })
      }).catch(() => {})
    }
    loadCounts()
    window.addEventListener('refresh-badges', loadCounts)
    return () => window.removeEventListener('refresh-badges', loadCounts)
  }, [])

  useEffect(() => {
    api.get('/goals').then(r => {
      setGoalActions(r.data.flatMap(g =>
        (g.actions || []).filter(a => !a.completed && a.deadline)
          .map(a => ({ ...a, goalId: g.id, goalTitle: g.title, goalDescription: g.description }))
      ))
    }).catch(() => {})
  }, [])

  const endpoint        = tab === 'today' ? '/tasks/today' : '/tasks'
  const completedFilter = tab === 'completed' ? '?completed=true' : ''

  useEffect(() => {
    if (mainTab !== 'acties') return
    setLoading(true); setShowForm(false); setForm(EMPTY_FORM); setCurrentEnergy(null)
    api.get(endpoint + completedFilter)
      .then(r => setTasks(r.data))
      .finally(() => setLoading(false))
  }, [tab, mainTab])

  function filterTasks(tasks) {
    let result
    if (tab === 'upcoming')  result = tasks.filter(t => !t.completed && t.deadline && getDaysLeft(t.deadline) <= 30)
    else if (tab === 'completed') result = tasks
    else if (tab === '2min') result = tasks.filter(t => !t.completed && t.tijd_minuten != null && t.tijd_minuten <= 2)
    else result = tasks.filter(t => !t.completed)
    result = result.filter(t => t.bestemming !== 'losse_eindjes')
    if (currentEnergy) {
      result = result.filter(t => t.energie === currentEnergy)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t => t.title.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q)))
    }
    return result
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleToggle(id, completed) {
    await api.patch(`/tasks/${id}`, { completed })
    setTasks(ts => ts.map(t => t.id === id ? { ...t, completed } : t)); refreshBadges()
  }
  async function handleSubtaskToggle(taskId, subId, completed) {
    await api.patch(`/tasks/${taskId}/subtasks/${subId}`, { completed })
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, completed } : s) } : t))
  }
  async function handleDelete(id) {
    const ok = await confirm('Weet je zeker dat je deze taak wilt verwijderen?')
    if (!ok) return
    await api.delete(`/tasks/${id}`); setTasks(ts => ts.filter(t => t.id !== id)); refreshBadges()
  }
  async function handleUpdate(id, updates) {
    const res = await api.patch(`/tasks/${id}`, updates)
    setTasks(ts => ts.map(t => t.id === id ? { ...t, ...res.data } : t))
  }
  async function handleFocusToggle(id, focus) {
    await api.patch(`/tasks/${id}`, { focus })
    setTasks(ts => ts.map(t => t.id === id ? { ...t, focus } : t))
  }
  async function handleSubtaskAdd(taskId, text) {
    const res = await api.post(`/tasks/${taskId}/subtasks`, { text })
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), res.data] } : t))
  }
  async function handleSubtaskUpdate(taskId, subId, updates) {
    const res = await api.patch(`/tasks/${taskId}/subtasks/${subId}`, updates)
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, ...res.data } : s) } : t))
  }
  async function handleSubtaskDelete(taskId, subId) {
    const ok = await confirm('Weet je zeker dat je deze subtaak wilt verwijderen?')
    if (!ok) return
    await api.delete(`/tasks/${taskId}/subtasks/${subId}`)
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subId) } : t))
  }
  async function handleTimeChange(id, tijd) {
    await api.patch(`/tasks/${id}`, { tijd_minuten: tijd || null })
    setTasks(ts => ts.map(t => t.id === id ? { ...t, tijd_minuten: tijd || null } : t))
  }
  async function handleSubtaskTimeChange(taskId, subId, tijd) {
    await api.patch(`/tasks/${taskId}/subtasks/${subId}`, { tijd_minuten: tijd || null })
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, tijd_minuten: tijd || null } : s) } : t))
  }
  async function handleGoalActionToggle(goalId, actionId) {
    await api.patch(`/goals/${goalId}/actions/${actionId}`, { completed: true })
    setGoalActions(gs => gs.filter(a => !(a.id === actionId && a.goalId === goalId)))
  }

  async function handleCreateTask(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const res = await api.post('/tasks', {
        title: form.title, deadline: form.deadline || null,
        priority: form.priority, category: form.category || null,
        description: form.description || null,
        subtasks: form.subtasks.filter(s => s.trim()),
      })
      setTasks(ts => [{ ...res.data, subtasks: [] }, ...ts])
      setForm(EMPTY_FORM); setShowForm(false); refreshBadges()
    } finally { setSaving(false) }
  }

  const taskProps = {
    onToggle: handleToggle, onSubtaskToggle: handleSubtaskToggle,
    onDelete: handleDelete, onUpdate: handleUpdate,
    onSubtaskAdd: handleSubtaskAdd,
    onSubtaskUpdate: handleSubtaskUpdate, onSubtaskDelete: handleSubtaskDelete,
    onFocusToggle: handleFocusToggle,
    onTimeChange: handleTimeChange, onSubtaskTimeChange: handleSubtaskTimeChange,
  }

  function sortByUrgency(list) {
    return [...list].sort((a, b) => {
      if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline)
      if (a.deadline) return -1; if (b.deadline) return 1
      const p = { high: 0, mid: 1, low: 2 }
      return (p[a.priority] ?? 1) - (p[b.priority] ?? 1)
    })
  }

  function groupByCategory(list) {
    const cats = [
      { key: 'werk',  label: 'Werk',  dot: 'bg-blue-400',    hdr: 'text-blue-700 dark:text-blue-400' },
      { key: 'privé', label: 'Privé', dot: 'bg-pink-400',    hdr: 'text-pink-700 dark:text-pink-400' },
    ]
    const groups = cats.map(c => ({
      ...c,
      tasks:   sortByUrgency(list.filter(t => t.category === c.key)),
      overdue: list.filter(t => t.category === c.key && t.deadline && getDaysLeft(t.deadline) < 0).length,
    })).filter(g => g.tasks.length > 0)

    const knownKeys    = new Set(cats.map(c => c.key))
    const kalenderTaken = sortByUrgency(list.filter(t => t.bestemming === 'kalender'))
    if (kalenderTaken.length > 0) groups.push({
      key: '_kalender', label: 'Kalender', dot: 'bg-emerald-400', hdr: 'text-emerald-700 dark:text-emerald-400',
      tasks: kalenderTaken, overdue: kalenderTaken.filter(t => t.deadline && getDaysLeft(t.deadline) < 0).length,
    })
    const other = sortByUrgency(list.filter(t => !knownKeys.has(t.category) && t.bestemming !== 'kalender'))
    if (other.length > 0) groups.push({
      key: '_other', label: 'Overig', dot: 'bg-gray-400', hdr: 'text-gray-600 dark:text-gray-400',
      tasks: other, overdue: other.filter(t => t.deadline && getDaysLeft(t.deadline) < 0).length,
    })
    return groups
  }

  function toLocalKey(iso) {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  function groupByDay(tasks) {
    const days = {}, noDue = []
    tasks.forEach(t => {
      const dl = t.deadline || t.subtasks?.filter(s => !s.completed && s.deadline).sort((a,b) => new Date(a.deadline)-new Date(b.deadline))[0]?.deadline
      if (!dl) { noDue.push(t); return }
      const key = toLocalKey(dl)
      if (!days[key]) days[key] = []
      days[key].push(t)
    })
    return { sorted: Object.keys(days).sort(), days, noDue }
  }

  function formatDayHeader(dateStr) {
    const d    = new Date(dateStr + 'T00:00:00')
    const diff = Math.round((d - new Date().setHours(0,0,0,0)) / 86400000)
    const naam = d.toLocaleDateString('nl-NL', { weekday: 'long' })
    const datum = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
    if (diff === 0)  return `Vandaag — ${datum}`
    if (diff === 1)  return `Morgen — ${datum}`
    if (diff === -1) return `Gisteren — ${datum}`
    return `${naam.charAt(0).toUpperCase() + naam.slice(1)} — ${datum}`
  }

  const visibleTasks = filterTasks(tasks)
  const { sorted, days, noDue } = groupByDay(visibleTasks)

  function getVisibleGoalActions() {
    if (tab === 'completed') return []
    let res = goalActions
    if (tab === 'today')    res = goalActions.filter(a => getDaysLeft(a.deadline) === 0)
    if (tab === 'upcoming') res = goalActions.filter(a => getDaysLeft(a.deadline) <= 30)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      res = res.filter(a => a.title.toLowerCase().includes(q) || a.goalTitle?.toLowerCase().includes(q))
    }
    return res.sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
  }
  const visibleGoalActions = getVisibleGoalActions()

  const MAIN_TABS = [
    { key: 'losse',   label: 'Niet gepland' },
    { key: 'acties',  label: 'Acties' },
    { key: 'focus',   label: 'Focus' },
    { key: 'wachten', label: 'Wachten op' },
    { key: 'ooit',    label: 'Ooit' },
  ]

  const inputCls = 'border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-sm bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500'

  return (
    <div>
      {confirmDialog}
      {/* ── Main tabs ── */}
      <div className="flex gap-0 mb-8 border-b border-gray-200 dark:border-gray-700 overflow-x-auto no-scrollbar">
        {MAIN_TABS.map(t => {
          const count = tabCounts[t.key]
          return (
            <button key={t.key} onClick={() => setMainTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                mainTab === t.key
                  ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                  : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {t.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full leading-none ${
                  mainTab === t.key
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                }`}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Acties tab ── */}
      {mainTab === 'acties' && (
        <div>
          {/* Sub-filter tabs + energy filter on one row */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl flex-wrap">
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setTab(f.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === f.key
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}>
                  {f.icon && <f.icon size={12} />}
                  {f.label}
                </button>
              ))}
            </div>

            {tab !== 'completed' && tab !== 'context' && (
              <EnergyFilter tasks={tasks} currentEnergy={currentEnergy} onSelect={setCurrentEnergy} />
            )}
          </div>

          {/* Nieuwe taak formulier */}
          {tab === 'all' && (
            showForm ? (
              <form onSubmit={handleCreateTask}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Circle size={16} className="text-gray-300 flex-shrink-0" />
                  <input autoFocus placeholder="Nieuwe taak..." value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    lang="nl" className={`flex-1 font-medium ${inputCls}`} />
                </div>
                <div className="grid grid-cols-2 gap-2 pl-6 sm:grid-cols-4">
                  <DateInput value={form.deadline} onChange={v => setForm(f => ({ ...f, deadline: v ?? '' }))}
                    className={`${inputCls} text-xs`} />
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className={`${inputCls} text-xs cursor-pointer`}>
                    <option value="high">Hoog</option>
                    <option value="mid">Gemiddeld</option>
                    <option value="low">Laag</option>
                  </select>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className={`${inputCls} text-xs cursor-pointer`}>
                    <option value="">Categorie</option>
                    <option value="werk">Werk</option>
                    <option value="privé">Privé</option>
                  </select>
                </div>

                {form.subtasks.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 pl-6">
                    <Circle size={12} className="text-gray-200 flex-shrink-0" />
                    <input value={s} onChange={e => setForm(f => ({ ...f, subtasks: f.subtasks.map((x, j) => j === i ? e.target.value : x) }))}
                      placeholder={`Subtaak ${i + 1}`} lang="nl"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setForm(f => ({ ...f, subtasks: [...f.subtasks, ''] })) } }}
                      className={`flex-1 text-xs ${inputCls}`} />
                    <button type="button" onClick={() => setForm(f => ({ ...f, subtasks: f.subtasks.filter((_, j) => j !== i) }))}
                      className="text-gray-300 hover:text-red-400 flex-shrink-0"><X size={12} /></button>
                  </div>
                ))}

                <div className="flex items-center justify-between pl-6">
                  <button type="button" onClick={() => setForm(f => ({ ...f, subtasks: [...f.subtasks, ''] }))}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors">+ Subtaak</button>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
                      className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg transition-colors">
                      Annuleren
                    </button>
                    <button type="submit" disabled={saving || !form.title.trim()}
                      className="text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors font-medium">
                      {saving ? 'Opslaan...' : 'Toevoegen'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-5 transition-colors group">
                <span className="w-5 h-5 rounded-full border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center group-hover:border-gray-400 transition-colors">
                  <Plus size={11} />
                </span>
                Nieuwe taak toevoegen
              </button>
            )
          )}

          {loading && <p className="text-gray-400 text-sm">Laden...</p>}

          {!loading && tab !== 'context' && visibleTasks.length === 0 && visibleGoalActions.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-gray-600">
              <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Geen taken{tab === 'today' ? ' voor vandaag' : ''}.</p>
            </div>
          )}

          {/* Upcoming — grouped by day */}
          {tab === 'upcoming' && !loading && (visibleTasks.length > 0 || visibleGoalActions.length > 0) && (() => {
            const gaByDay = {}
            visibleGoalActions.forEach(a => {
              const key = a.deadline.slice(0, 10)
              if (!gaByDay[key]) gaByDay[key] = []
              gaByDay[key].push(a)
            })
            const allKeys = [...new Set([...sorted, ...Object.keys(gaByDay)])].sort()
            return (
              <div className="space-y-6">
                {allKeys.map(dateKey => (
                  <div key={dateKey}>
                    <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                      {formatDayHeader(dateKey)}
                    </h2>
                    <div className="space-y-2">
                      {(days[dateKey] || []).map(task => <TaskItem key={task.id} task={task} {...taskProps} />)}
                      {(gaByDay[dateKey] || []).map(a => <GoalActionItem key={`ga-${a.id}`} action={a} onToggle={handleGoalActionToggle} />)}
                    </div>
                  </div>
                ))}
                {noDue.length > 0 && (
                  <div>
                    <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Geen deadline</h2>
                    <div className="space-y-2">{noDue.map(task => <TaskItem key={task.id} task={task} {...taskProps} />)}</div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* All — grouped by category */}
          {tab === 'all' && !loading && (visibleTasks.length > 0 || visibleGoalActions.length > 0) && (
            <div className="space-y-4">
              {groupByCategory(visibleTasks).map(group => (
                <div key={group.key}>
                  <button onClick={() => setCollapsed(c => ({ ...c, [group.key]: !c[group.key] }))}
                    className="w-full flex items-center justify-between py-2 mb-2 text-left">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${group.dot}`} />
                      <span className={`text-xs font-semibold uppercase tracking-wider ${group.hdr}`}>
                        {group.label}
                      </span>
                      {group.overdue > 0 && (
                        <span className="text-xs bg-red-50 dark:bg-red-900/30 text-red-500 px-1.5 py-0.5 rounded-md font-medium">
                          {group.overdue} verlopen
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500">{group.tasks.length}</span>
                      {collapsed[group.key] ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>
                  {!collapsed[group.key] && (
                    <div className="space-y-2">
                      {group.tasks.map(task => <TaskItem key={task.id} task={task} {...taskProps} />)}
                    </div>
                  )}
                </div>
              ))}
              {visibleGoalActions.length > 0 && (
                <div>
                  <button onClick={() => setCollapsed(c => ({ ...c, _goals: !c._goals }))}
                    className="w-full flex items-center justify-between py-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <Trophy size={12} className="text-violet-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-violet-500">Doelacties</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{visibleGoalActions.length}</span>
                      {collapsed._goals ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>
                  {!collapsed._goals && (
                    <div className="space-y-2">
                      {visibleGoalActions.map(a => <GoalActionItem key={`ga-${a.id}`} action={a} onToggle={handleGoalActionToggle} />)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Context grouped view */}
          {tab === 'context' && !loading && (
            <ContextGroupedView tasks={tasks} taskProps={taskProps} />
          )}

          {/* Other filters — flat list */}
          {tab !== 'all' && tab !== 'upcoming' && tab !== 'context' && !loading && visibleTasks.length > 0 && (
            <div className="space-y-2">
              {sortByUrgency(visibleTasks).map(task => <TaskItem key={task.id} task={task} {...taskProps} />)}
              {visibleGoalActions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider px-1 mb-2">Doelacties</p>
                  {visibleGoalActions.map(a => <GoalActionItem key={`ga-${a.id}`} action={a} onToggle={handleGoalActionToggle} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mainTab === 'losse'   && <LosseEindjesTab onProcessed={() => setMainTab('acties')} />}
      {mainTab === 'focus'   && <FocusTab />}
      {mainTab === 'wachten' && <WachtenTab />}
      {mainTab === 'ooit'    && <OoitTab />}
    </div>
  )
}
