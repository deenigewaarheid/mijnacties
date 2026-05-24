import { useEffect } from 'react'
import { X } from 'lucide-react'

const ACHIEVEMENTS = {
  '5_completed': { emoji: '🎯', title: 'Goed bezig!',   message: '5 taken voltooid vandaag' },
  'inbox_zero':  { emoji: '✨', title: 'Inbox Zero!',    message: 'Alle mails verwerkt' },
  'week_streak': { emoji: '🔥', title: 'Week Streak',    message: 'Elke dag iets voltooid deze week' },
  'focus_day':   { emoji: '💪', title: 'Focus Dag',      message: 'Alleen high priority taken voltooid' },
}

export default function CelebrationToast({ achievement, onClose }) {
  const data = ACHIEVEMENTS[achievement]

  useEffect(() => {
    if (!data) return
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [data, onClose])

  if (!data) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
      <div className="bg-white border-2 border-green-200 rounded-xl shadow-xl px-5 py-4 flex items-center gap-4 min-w-[260px] max-w-xs">
        <span className="text-3xl leading-none flex-shrink-0">{data.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{data.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{data.message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
