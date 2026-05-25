import { useState, useEffect } from 'react'
import { Mail, CheckCircle2, LogOut, Lock, Eye, EyeOff, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

function PasswordSection() {
  const [current, setCurrent]   = useState('')
  const [next, setNext]         = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext]       = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (next !== confirm) { setError('Nieuwe wachtwoorden komen niet overeen'); return }
    if (next.length < 8)  { setError('Nieuw wachtwoord moet minimaal 8 tekens zijn'); return }
    setSaving(true)
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next })
      setSuccess(true)
      setCurrent(''); setNext(''); setConfirm('')
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Wachtwoord wijzigen mislukt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-blue-100 rounded-2xl p-6 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Lock size={16} className="text-gray-500" />
        <h2 className="font-semibold text-gray-800">Wachtwoord wijzigen</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Huidig wachtwoord</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={current}
              onChange={e => setCurrent(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 pr-9"
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowCurrent(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Nieuw wachtwoord</label>
          <div className="relative">
            <input
              type={showNext ? 'text' : 'password'}
              value={next}
              onChange={e => setNext(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 pr-9"
              autoComplete="new-password"
            />
            <button type="button" onClick={() => setShowNext(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Bevestig nieuw wachtwoord</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            autoComplete="new-password"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button type="submit" disabled={saving || !current || !next || !confirm}
          className="flex items-center gap-2 bg-blue-800 hover:bg-blue-900 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          {success ? <><Check size={14} />Opgeslagen!</> : saving ? 'Opslaan...' : 'Wachtwoord wijzigen'}
        </button>
      </form>
    </div>
  )
}

export default function Settings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [gmailConnected, setGmailConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  useEffect(() => {
    api.get('/auth/gmail/status').then(r => setGmailConnected(r.data.connected)).catch(() => {})

    const params = new URLSearchParams(window.location.search)
    const encodedTokens = params.get('gmail_tokens')
    if (encodedTokens) {
      const tokens = JSON.parse(atob(encodedTokens))
      api.post('/auth/gmail/connect', { tokens }).then(() => {
        setGmailConnected(true)
        window.history.replaceState({}, '', '/settings')
      })
    }
  }, [])

  async function handleGmailConnect() {
    setLoading(true)
    try {
      const { data } = await api.get('/auth/gmail')
      window.location.href = data.authUrl
    } catch {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const { data } = await api.post('/mails/sync')
      setSyncResult(data.newMails > 0
        ? `✓ ${data.newMails} nieuwe mail${data.newMails !== 1 ? 's' : ''} binnengehaald`
        : 'Geen nieuwe mails gevonden'
      )
    } catch {
      setSyncResult('Synchronisatie mislukt')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncResult(null), 4000)
    }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-blue-900 mb-8">Instellingen</h1>

      <div className="bg-white border border-blue-100 rounded-2xl p-6 mb-4">
        <h2 className="font-semibold text-gray-800 mb-1">Account</h2>
        <p className="text-sm text-gray-500">{user?.email}</p>
      </div>

      <PasswordSection />

      <div className="bg-white border border-blue-100 rounded-2xl p-6 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-gray-800 mb-1">Gmail verbinden</h2>
            <p className="text-sm text-gray-500">
              Verbind je Gmail om automatisch mails te ontvangen via het "Analyzer" label.
            </p>
          </div>
          {gmailConnected && <CheckCircle2 size={20} className="text-green-500 flex-shrink-0 mt-0.5" />}
        </div>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleGmailConnect}
            disabled={loading || gmailConnected}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Mail size={14} />
            {gmailConnected ? 'Gmail verbonden' : loading ? 'Bezig...' : 'Verbind Gmail'}
          </button>
          {gmailConnected && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 border border-gray-200 hover:border-gray-400 text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Mail size={14} />
              {syncing ? 'Synchroniseren...' : 'Sync nu'}
            </button>
          )}
        </div>
        {syncResult && (
          <p className="mt-2 text-xs text-gray-500">{syncResult}</p>
        )}
      </div>

      <div className="bg-white border border-blue-100 rounded-2xl p-6">
        <h2 className="font-semibold text-gray-800 mb-3">Sessie</h2>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-red-600 hover:text-red-800 text-sm font-medium transition-colors"
        >
          <LogOut size={14} />
          Uitloggen
        </button>
      </div>
    </div>
  )
}
