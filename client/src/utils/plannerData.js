// ─── Date helpers ─────────────────────────────────────────────────────────────
// All date comparisons use local-time midnight to avoid UTC offset bugs.

function localMidnight(dateStr) {
  // dateStr: 'YYYY-MM-DD'  →  local-time Date at 00:00:00
  return new Date(dateStr + 'T00:00:00')
}

export function localDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Converts a deadline (plain 'YYYY-MM-DD' or UTC ISO timestamp from PostgreSQL) to local YYYY-MM-DD.
// PostgreSQL TIMESTAMP columns come back as UTC ISO strings ("2026-05-24T22:00:00.000Z"),
// which is locally "2026-05-25" in UTC+2. Using new Date() + localDateStr() resolves this correctly.
export function dlStr(deadline) {
  if (!deadline) return null
  const s = String(deadline)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s   // plain date — use as-is
  return localDateStr(new Date(s))                 // ISO timestamp — convert to local date
}

function todayStr() {
  return localDateStr()
}

function offsetStr(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localDateStr(d)
}

export function isToday(dateStr) {
  if (!dateStr) return false
  return dateStr.slice(0, 10) === todayStr()
}

export function isTomorrow(dateStr) {
  if (!dateStr) return false
  return dateStr.slice(0, 10) === offsetStr(1)
}

// Returns date1 - date2 in whole days (positive → date1 is later)
export function daysDifference(dateStr1, dateStr2) {
  const ms = localMidnight(dateStr1.slice(0, 10)) - localMidnight(dateStr2.slice(0, 10))
  return Math.round(ms / 86_400_000)
}

// "maandag 26 mei"
export function formatDate(dateStr) {
  if (!dateStr) return ''
  return localMidnight(dateStr.slice(0, 10)).toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * getFilteredPlannerData(tasks)
 *
 * Transforms the raw /api/tasks array into five planner sections.
 * All returned tasks keep their original API shape plus any computed
 * fields noted below.  Subtask arrays are always present (never undefined).
 */
export function getFilteredPlannerData(tasks, refDate = null) {
  const today = refDate || localDateStr()

  const tomorrowD = new Date(today + 'T00:00:00')
  tomorrowD.setDate(tomorrowD.getDate() + 1)
  const tomorrow = localDateStr(tomorrowD)

  const in7D = new Date(today + 'T00:00:00')
  in7D.setDate(in7D.getDate() + 7)
  const in7days = localDateStr(in7D)

  const open = tasks.filter(t => !t.completed)

  // ── 1. TODAY ────────────────────────────────────────────────────────────────
  // Tasks due on refDate OR explicitly marked as focus (not overdue).
  // Subtasks narrowed to: due today/tomorrow OR ≤2 min.
  const todayTasks = open
    .filter(t => {
      const dl = dlStr(t.deadline)
      if (dl && dl < today) return false  // overdue → eigen sectie
      if (dl === today) return true        // deadline vandaag
      if (t.focus && !dl) return true     // focus zonder deadline
      return false
    })
    .map(t => ({
      ...t,
      subtasks: (t.subtasks || []).filter(s =>
        !s.completed && (
          dlStr(s.deadline) === today ||
          dlStr(s.deadline) === tomorrow ||
          (s.tijd_minuten != null && s.tijd_minuten <= 2)
        )
      ),
    }))

  // ── 2. TOMORROW ─────────────────────────────────────────────────────────────
  // Tasks due the day after refDate.
  const tomorrowTasks = open
    .filter(t => dlStr(t.deadline) === tomorrow)
    .map(t => ({ ...t, subtasks: t.subtasks || [] }))

  // ── 3. TWO-MINUTE ───────────────────────────────────────────────────────────
  // Standalone tasks ≤2 min AND subtasks ≤2 min (with parent reference).
  const twoMinute = []

  for (const task of open) {
    const taskDl = dlStr(task.deadline)
    const taskScheduled = taskDl === today || taskDl === tomorrow
    if (task.tijd_minuten != null && task.tijd_minuten <= 2 && !taskScheduled) {
      twoMinute.push({
        id:         task.id,
        title:      task.title,
        parentTask: null,
        _goalTitle: task._goalTitle || null,
        context:    task.context  || null,
        priority:   task.priority || null,
      })
    }
    for (const sub of task.subtasks || []) {
      const subDl = dlStr(sub.deadline)
      const subScheduled = subDl === today || subDl === tomorrow
      if (!sub.completed && sub.tijd_minuten != null && sub.tijd_minuten <= 2 && !subScheduled) {
        twoMinute.push({
          id:         sub.id,
          title:      sub.text,
          parentTask: task.title,
          _taskId:    task.id,
          context:    task.context  || null,
          priority:   task.priority || null,
        })
      }
    }
  }

  // ── 4. OVERDUE ──────────────────────────────────────────────────────────────
  // Uncompleted tasks whose deadline has already passed, oldest first.
  const overdue = open
    .filter(t => { const dl = dlStr(t.deadline); return dl && dl < today })
    .map(t => ({
      ...t,
      subtasks:    t.subtasks || [],
      daysOverdue: daysDifference(today, dlStr(t.deadline)),
    }))
    .sort((a, b) => localMidnight(dlStr(a.deadline)) - localMidnight(dlStr(b.deadline)))

  // ── 5. DEADLINES ────────────────────────────────────────────────────────────
  // Uncompleted tasks with a deadline strictly after today and within 7 days,
  // sorted by deadline ascending.  Each task gets daysUntil + deadlineLabel.
  const deadlines = open
    .filter(t => {
      const d = dlStr(t.deadline)
      return d && d > today && d <= in7days
    })
    .map(t => ({
      ...t,
      subtasks:      t.subtasks || [],
      daysUntil:     daysDifference(dlStr(t.deadline), today),
      deadlineLabel: formatDate(dlStr(t.deadline)),
    }))
    .sort((a, b) => localMidnight(dlStr(a.deadline)) - localMidnight(dlStr(b.deadline)))

  return { today: todayTasks, tomorrow: tomorrowTasks, twoMinute, overdue, deadlines }
}
