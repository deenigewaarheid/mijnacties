import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import api from '../api/client'

const PRIORITY_STYLES = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-orange-100 text-orange-700',
  low:    'bg-green-100 text-green-700',
}

export default function AIInsights({ tasks, user }) {
  const [insights, setInsights] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  async function getInsights() {
    setLoading(true)
    setError(null)
    const prompt = `Analyseer deze takenlijst van een docent en geef 3 concrete suggesties:
TAKEN: ${tasks.map(t => `- ${t.title} (${t.priority}, ${t.deadline || 'geen deadline'})`).join('\n')}
CONTEXT: Vandaag: ${new Date().toLocaleDateString('nl-NL')}, Voltooid deze week: ${user.completedThisWeek}

Return ALLEEN een JSON array zonder uitleg of markdown:
[{"title": "Korte titel", "suggestion": "Concrete actie", "reason": "Waarom dit helpt", "priority": "high|medium|low"}]`

    try {
      const res = await api.post('/ai/insights', { prompt })
      setInsights(res.data.insights)
    } catch (err) {
      setError('Analyse mislukt. Probeer het opnieuw.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-accent-50 to-emerald-50 dark:from-accent-950/20 dark:to-emerald-950/20 border border-accent-100 dark:border-accent-900/50 rounded-xl p-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-accent-100 dark:bg-accent-900/50 flex items-center justify-center flex-shrink-0">
          <Sparkles size={18} className="text-accent-600 dark:text-accent-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-accent-900 dark:text-accent-200 font-display">AI Planningsadvies</p>
          <p className="text-xs text-accent-500 dark:text-accent-400">Persoonlijke tips op basis van jouw taken</p>
        </div>
        <button
          onClick={getInsights}
          disabled={loading}
          className="flex-shrink-0 text-sm font-semibold px-4 py-2 rounded-lg bg-accent-600 hover:bg-accent-700 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors"
        >
          {loading ? 'Aan het analyseren...' : insights ? 'Nieuwe tips' : 'Analyseren'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
      )}

      {/* Empty state */}
      {!insights && !loading && !error && (
        <p className="text-sm text-accent-400 dark:text-accent-500 text-center py-2">
          Klik op "Analyseren" voor persoonlijk advies op basis van jouw {tasks.length} taken.
        </p>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/60 dark:bg-white/5 rounded-lg p-4 animate-pulse">
              <div className="h-3 bg-accent-100 dark:bg-accent-900/40 rounded w-2/5 mb-2" />
              <div className="h-2.5 bg-accent-50 dark:bg-accent-900/20 rounded w-4/5" />
            </div>
          ))}
        </div>
      )}

      {/* Insights */}
      {insights && !loading && (
        <div className="space-y-3">
          {insights.map((insight, i) => {
            const pStyle = PRIORITY_STYLES[insight.priority] ?? PRIORITY_STYLES.low
            return (
              <div key={i} className="bg-white dark:bg-gray-900/80 border border-accent-100 dark:border-accent-900/40 rounded-lg p-4 flex gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${pStyle}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{insight.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{insight.suggestion}</p>
                  {insight.reason && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-1">{insight.reason}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
