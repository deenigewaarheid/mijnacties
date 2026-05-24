const STYLES = {
  urgent:  'bg-orange-100 text-orange-700 ring-1 ring-orange-200',
  info:    'bg-blue-50 text-blue-600',
  success: 'bg-green-50 text-green-600',
}

export default function GentleBadge({ count, type = 'info' }) {
  if (!count) return null
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STYLES[type] ?? STYLES.info}`}>
      {count}
    </span>
  )
}
