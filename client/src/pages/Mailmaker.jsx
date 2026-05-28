import { useState, useEffect } from 'react'
import { Copy, Check, Send, ChevronDown, Loader2 } from 'lucide-react'
import api from '../api/client'

const DOEL_OPTS = [
  'Afhandelen',
  'Uitstellen',
  'Meer info vragen',
  'Nee zeggen',
  'Afspraak maken',
  'Bevestigen',
]

const TOON_OPTS = [
  'Professioneel',
  'Vriendelijk',
  'Kort en bondig',
  'Enthousiast',
  'Formeel',
]

function ChipSelect({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt.toLowerCase())}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            value === opt.toLowerCase()
              ? 'bg-accent-600 border-accent-600 text-white'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function CustomQuestion({ question, value, onChange }) {
  if (question.type === 'choice' && question.options?.length > 0) {
    return (
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">{question.question}</p>
        <ChipSelect
          options={question.options}
          value={value || ''}
          onChange={onChange}
        />
      </div>
    )
  }
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{question.question}</p>
      <input
        type="text"
        lang="nl"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="Jouw antwoord..."
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-500"
      />
    </div>
  )
}

function MailTab({ mail, onReplied }) {
  const displaySubject = mail.display_subject || mail.subject || '(geen onderwerp)'
  const questions = (() => { try { return JSON.parse(mail.questions || '[]') } catch { return [] } })()

  const [doel, setDoel] = useState('')
  const [toon, setToon] = useState('professioneel')
  const [specifiek, setSpecifiek] = useState('')
  const [customAnswers, setCustomAnswers] = useState({})
  const [generating, setGenerating] = useState(false)
  const [reply, setReply] = useState(mail.generated_reply || '')
  const [copied, setCopied] = useState(false)
  const [marking, setMarking] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)

  async function handleGenerate() {
    if (!doel) return
    setGenerating(true)
    try {
      const { data } = await api.post(`/mailmaker/${mail.id}/generate`, {
        answers: {
          doel,
          toon,
          specifieke_punten: specifiek,
          custom: customAnswers,
        },
      })
      setReply(data.reply)
    } catch {
      setReply('Er is iets misgegaan. Probeer opnieuw.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(reply)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleMarkReplied() {
    setMarking(true)
    try {
      await api.post(`/mailmaker/${mail.id}/mark-replied`)
      onReplied(mail.id)
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Original mail */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowOriginal(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-100 transition-colors"
        >
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Van: {mail.from_email}</p>
            <p className="text-sm font-medium text-gray-800">{displaySubject}</p>
          </div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform flex-shrink-0 ml-3 ${showOriginal ? 'rotate-180' : ''}`} />
        </button>
        {showOriginal && (
          <div className="px-4 pb-4 border-t border-gray-200">
            <pre className="mt-3 text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed max-h-60 overflow-y-auto">
              {mail.body}
            </pre>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Wat is je doel met het antwoord?</p>
          <ChipSelect options={DOEL_OPTS} value={doel} onChange={setDoel} />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Welke toon wil je?</p>
          <ChipSelect options={TOON_OPTS} value={toon} onChange={setToon} />
        </div>

        {questions.map((q, i) => (
          <CustomQuestion
            key={q.id || i}
            question={q}
            value={customAnswers[q.question] || ''}
            onChange={v => setCustomAnswers(prev => ({ ...prev, [q.question]: v }))}
          />
        ))}

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Specifieke punten die erin moeten staan?{' '}
            <span className="font-normal text-gray-400">(optioneel)</span>
          </p>
          <textarea
            lang="nl"
            value={specifiek}
            onChange={e => setSpecifiek(e.target.value)}
            placeholder="Bijv. verwijs naar ons gesprek van dinsdag, noem de deadline van vrijdag..."
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-500 resize-none"
          />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!doel || generating}
        className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-40 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
      >
        {generating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {generating ? 'Genereren...' : 'Antwoord genereren'}
      </button>

      {/* Generated reply */}
      {reply && (
        <div className="border border-accent-100 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-accent-50 border-b border-accent-100">
            <p className="text-xs font-semibold text-accent-900 uppercase tracking-wider">Gegenereerd antwoord</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-accent-700 hover:text-accent-900 transition-colors"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Gekopieerd!' : 'Kopiëren'}
              </button>
            </div>
          </div>
          <pre className="p-4 text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
            {reply}
          </pre>
          <div className="px-4 pb-4 flex justify-end">
            <button
              onClick={handleMarkReplied}
              disabled={marking}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
            >
              <Check size={13} />
              {marking ? 'Markeren...' : 'Markeer als beantwoord'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Mailmaker() {
  const [mails, setMails] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    api.get('/mailmaker')
      .then(r => { setMails(r.data); setActiveTab(0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleReplied(mailId) {
    setMails(prev => {
      const next = prev.filter(m => m.id !== mailId)
      setActiveTab(t => Math.min(t, Math.max(0, next.length - 1)))
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (mails.length === 0) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-display font-bold text-gray-900 dark:text-gray-100 mb-8">Mailmaker</h1>
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500 text-sm">Geen mails die een antwoord vereisen.</p>
          <p className="text-gray-400 text-xs mt-1">Nieuwe mails worden hier getoond zodra AI detecteert dat ze een antwoord nodig hebben.</p>
        </div>
      </div>
    )
  }

  const activeMail = mails[activeTab]

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-display font-bold text-gray-900 dark:text-gray-100 mb-6">Mailmaker</h1>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 mb-6 -mx-1 px-1">
        {mails.map((mail, i) => {
          const label = mail.display_subject || mail.subject || '(geen onderwerp)'
          const short = label.length > 28 ? label.slice(0, 26) + '…' : label
          return (
            <button
              key={mail.id}
              onClick={() => setActiveTab(i)}
              className={`flex-shrink-0 px-3.5 py-2 rounded-t-lg text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === i
                  ? 'border-accent-600 text-accent-700 bg-white dark:bg-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {short}
            </button>
          )
        })}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {activeMail && (
          <MailTab
            key={activeMail.id}
            mail={activeMail}
            onReplied={handleReplied}
          />
        )}
      </div>
    </div>
  )
}
