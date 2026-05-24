import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

function ConfirmDialog({ open, message, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 pt-2 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
          >
            Verwijderen
          </button>
        </div>
      </div>
    </div>
  )
}

export function useConfirm() {
  const [state, setState] = useState({ open: false, message: '', resolve: null })

  function confirm(message) {
    return new Promise(resolve => {
      setState({ open: true, message, resolve })
    })
  }

  function handleConfirm() {
    state.resolve(true)
    setState({ open: false, message: '', resolve: null })
  }

  function handleCancel() {
    state.resolve(false)
    setState({ open: false, message: '', resolve: null })
  }

  const dialog = (
    <ConfirmDialog
      open={state.open}
      message={state.message}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, dialog }
}
