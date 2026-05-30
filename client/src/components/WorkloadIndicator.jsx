// STATUS_CONFIG uses complete class strings so Tailwind JIT scans them correctly.
const STATUS_CONFIG = {
  green: {
    wrap:   'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/50',
    badge:  'bg-white text-green-700',
    bar:    'bg-green-500',
    text:   'text-green-800 dark:text-green-300',
    meta:   'text-green-600 dark:text-green-400',
  },
  blue: {
    wrap:   'bg-accent-50 dark:bg-accent-950/30 border-accent-100 dark:border-accent-700/50',
    badge:  'bg-white text-accent-700',
    bar:    'bg-accent-500',
    text:   'text-accent-700 dark:text-accent-300',
    meta:   'text-accent-600 dark:text-accent-400',
  },
  orange: {
    wrap:   'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50',
    badge:  'bg-white text-orange-700',
    bar:    'bg-orange-500',
    text:   'text-orange-800 dark:text-orange-300',
    meta:   'text-orange-600 dark:text-orange-400',
  },
  red: {
    wrap:   'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50',
    badge:  'bg-white text-red-700',
    bar:    'bg-red-500',
    text:   'text-red-800 dark:text-red-300',
    meta:   'text-red-600 dark:text-red-400',
  },
}

function getStatus(utilizationPercent) {
  if (utilizationPercent < 70)  return { label: 'Rustig',      color: 'green',  emoji: '😌', advice: 'Je hebt nog ruimte voor extra taken' }
  if (utilizationPercent < 100) return { label: 'Goed gevuld', color: 'blue',   emoji: '👍', advice: 'Goede balans tussen werk en pauzes' }
  if (utilizationPercent < 130) return { label: 'Druk',        color: 'orange', emoji: '⚠️', advice: 'Overweeg taken te verplaatsen of delegeren' }
  return                               { label: 'Te vol',       color: 'red',    emoji: '🚨', advice: 'Dit is niet vol te houden — verschuif taken!' }
}

export default function WorkloadIndicator({ tasks, capacity = 8 }) {
  if (!tasks.length) return null

  const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.tijd_minuten ?? 15) / 60, 0)
  const utilizationPercent  = Math.round((totalEstimatedHours / capacity) * 1000) / 10
  const barWidth            = Math.min(utilizationPercent, 100)

  const status = getStatus(utilizationPercent)
  const c      = STATUS_CONFIG[status.color]

  const totalDisplay = totalEstimatedHours.toFixed(1)
  const pctDisplay   = utilizationPercent.toFixed(1)

  return (
    <div className={`border rounded-xl p-5 ${c.wrap}`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <span className="text-3xl leading-none flex-shrink-0">{status.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${c.text}`}>Werkdruk vandaag</p>
          <p className={`text-xs mt-0.5 ${c.meta}`}>{tasks.length} taken gepland</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${c.badge}`}>
          {status.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Bar labels */}
      <div className={`flex justify-between text-xs mt-1.5 ${c.meta}`}>
        <span>{totalDisplay}u ingepland van {capacity}u beschikbaar</span>
        <span className="font-medium">{pctDisplay}%</span>
      </div>

      {/* Advice */}
      <p className={`text-sm font-medium mt-3 ${c.text}`}>{status.advice}</p>
    </div>
  )
}
