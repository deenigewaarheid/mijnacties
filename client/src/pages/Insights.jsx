import { useState, useEffect } from 'react'
import { BarChart2, Clock } from 'lucide-react'
import api from '../api/client'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildHourCounts(completedTasks) {
  const counts = Array(24).fill(0)
  for (const t of completedTasks) {
    if (!t.completed_at) continue
    const hour = new Date(t.completed_at).getHours()
    counts[hour]++
  }
  return counts
}

function getBestHours(counts) {
  return counts
    .map((count, hour) => ({ count, hour }))
    .filter(h => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map(h => `${h.hour}:00–${h.hour + 1}:00`)
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

function ProductivityHeatmap({ completedTasks }) {
  const counts  = buildHourCounts(completedTasks)
  const maxCount = Math.max(...counts, 1)
  const bestHours = getBestHours(counts)

  return (
    <div>
      {/* Grid */}
      <div
        className="gap-1"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)' }}
      >
        {counts.map((count, hour) => {
          const intensity = count / maxCount
          const bg = count === 0
            ? undefined
            : `rgba(59, 130, 246, ${(0.2 + intensity * 0.8).toFixed(2)})`

          return (
            <div key={hour} className="group relative">
              {/* Bar */}
              <div
                className={`h-12 rounded transition-transform duration-150 group-hover:scale-110 ${
                  count === 0 ? 'bg-gray-100 dark:bg-gray-800' : ''
                }`}
                style={bg ? { backgroundColor: bg } : undefined}
              />

              {/* Tooltip */}
              <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 pointer-events-none">
                <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                  {hour}:00 &bull; {count} {count === 1 ? 'taak' : 'taken'}
                </div>
                {/* Arrow */}
                <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Time labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-gray-500 px-0.5">
        <span>0:00</span>
        <span>6:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>

      {/* Best hours insight */}
      {bestHours.length > 0 && (
        <div className="mt-4 bg-accent-50 dark:bg-accent-950/40 border border-accent-100 dark:border-accent-700/50 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-base leading-none flex-shrink-0 mt-0.5">💡</span>
          <div>
            <p className="text-sm font-medium text-accent-700 dark:text-accent-300">
              Jouw beste tijden
            </p>
            <p className="text-xs text-accent-600 dark:text-accent-400 mt-0.5">
              {bestHours.join(' · ')}
            </p>
          </div>
        </div>
      )}

      {bestHours.length === 0 && (
        <p className="mt-4 text-sm text-center text-gray-400 dark:text-gray-600">
          Nog geen data — voltooi taken om jouw productiepatroon te zien.
        </p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Insights() {
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/tasks')
      .then(r => setTasks(r.data))
      .finally(() => setLoading(false))
  }, [])

  const completedTasks = tasks.filter(t => t.completed && t.completed_at)

  const totalDone    = completedTasks.length
  const counts       = buildHourCounts(completedTasks)
  const peakHour     = counts.indexOf(Math.max(...counts))
  const peakCount    = counts[peakHour]

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Inzichten</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
          Wanneer ben jij het meest productief?
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Laden...</p>
      ) : (
        <div className="space-y-5">

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Totaal voltooid</p>
              <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100">{totalDone}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Piekuur</p>
              <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                {peakCount > 0 ? `${peakHour}:00` : '—'}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Actieve uren</p>
              <p className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
                {counts.filter(c => c > 0).length}
              </p>
            </div>
          </div>

          {/* Heatmap card */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-6 py-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center">
                <Clock size={15} className="text-accent-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Productiviteit per uur</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Gebaseerd op {totalDone} voltooide taken</p>
              </div>

              {/* Legend */}
              <div className="ml-auto flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span>Weinig</span>
                <div className="flex gap-0.5">
                  {[0.2, 0.4, 0.6, 0.8, 1.0].map(o => (
                    <div
                      key={o}
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: `rgba(59,130,246,${o})` }}
                    />
                  ))}
                </div>
                <span>Veel</span>
              </div>
            </div>

            <ProductivityHeatmap completedTasks={completedTasks} />
          </div>

          {/* Day-of-week breakdown */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-6 py-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center">
                <BarChart2 size={15} className="text-accent-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Productiviteit per weekdag</p>
            </div>
            <DayOfWeekChart completedTasks={completedTasks} />
          </div>

        </div>
      )}
    </div>
  )
}

// ─── Bonus: Day-of-week bar chart ─────────────────────────────────────────────

const DAG_LABELS = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']

function DayOfWeekChart({ completedTasks }) {
  const dayCounts = Array(7).fill(0)
  for (const t of completedTasks) {
    if (!t.completed_at) continue
    dayCounts[new Date(t.completed_at).getDay()]++
  }
  const maxDay = Math.max(...dayCounts, 1)

  return (
    <div className="flex items-end gap-2 h-24">
      {dayCounts.map((count, day) => {
        const pct = count / maxDay
        return (
          <div key={day} className="flex-1 flex flex-col items-center gap-1.5 group relative">
            <div
              className="w-full rounded-md transition-all duration-300 group-hover:opacity-80"
              style={{
                height: `${Math.max(pct * 72, count > 0 ? 6 : 2)}px`,
                backgroundColor: count === 0
                  ? 'rgb(243,244,246)'
                  : `rgba(139,92,246,${0.25 + pct * 0.75})`,
              }}
            />
            {/* Tooltip */}
            <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 pointer-events-none">
              <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded-md whitespace-nowrap shadow-lg">
                {DAG_LABELS[day]} &bull; {count} taken
              </div>
              <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">{DAG_LABELS[day]}</span>
          </div>
        )
      })}
    </div>
  )
}
