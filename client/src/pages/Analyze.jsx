import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, CheckCircle2, Trash2, Plus, Upload, FileText, X } from 'lucide-react'
import api from '../api/client'

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700',
  mid:  'bg-yellow-100 text-yellow-700',
  low:  'bg-green-100 text-green-700'
}

const CATEGORY_LABELS = {
  werk: 'Werk',
  'privÃ©': 'PrivÃ©',
}

const BESTEMMING_COLORS = {
  actie:     'bg-accent-100 text-accent-700',
  kalender:  'bg-accent-50 text-accent-600',
  project:   'bg-orange-100 text-orange-700',
  wachten:   'bg-gray-100 text-gray-600',
  ooit:      'bg-gray-50 text-gray-500',
  weggooien: 'bg-red-50 text-red-500',
}
const BESTEMMING_LABELS = {
  actie:     'Actie',
  kalender:  'Kalender',
  project:   'Project',
  wachten:   'Wachten op',
  ooit:      'Ooit/misschien',
  weggooien: 'Niet nodig',
}

const EMPTY_MAIL = () => ({ body: '', subject: '', from: '' })

export default function Analyze() {
  const [step, setStep] = useState(1)
  const [inputTab, setInputTab] = useState('text') // 'text' | 'file'

  // Multiple text mails
  const [mails, setMails] = useState([EMPTY_MAIL()])

  // File upload
  const [file, setFile] = useState(null)
  const [fileSubject, setFileSubject] = useState('')
  const [fileFrom, setFileFrom] = useState('')
  const fileInputRef = useRef()

  // Results (one entry per analyzed mail)
  const [results, setResults] = useState([])
  const [allTasks, setAllTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // --- Mail block helpers ---
  function updateMail(i, field, value) {
    setMails(ms => ms.map((m, idx) => idx === i ? { ...m, [field]: value } : m))
  }
  function addMail() { setMails(ms => [...ms, EMPTY_MAIL()]) }
  function removeMail(i) { setMails(ms => ms.filter((_, idx) => idx !== i)) }

  // --- Analyze text mails ---
  async function handleAnalyzeText(e) {
    e.preventDefault()
    if (mails.every(m => !m.body.trim())) return
    setError('')
    setLoading(true)
    setStep(2)

    const collected = []
    try {
      for (let i = 0; i < mails.length; i++) {
        const m = mails[i]
        if (!m.body.trim()) continue
        setLoadingMsg(mails.length > 1 ? `Mail ${i + 1} van ${mails.length} analyseren en acties verbeteren...` : 'AI analyseert mail en verbetert acties (GTD)...')
        const { data } = await api.post('/mails/analyze', {
          body: m.body,
          subject: m.subject || 'Geen onderwerp',
          from: m.from || 'onbekend@email.com'
        })
        collected.push(data)
      }
      finishAnalysis(collected)
    } catch (err) {
      setError(err.response?.data?.error || 'Analyse mislukt')
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  // --- Analyze file ---
  async function handleAnalyzeFile(e) {
    e.preventDefault()
    if (!file) return
    setError('')
    setLoading(true)
    setStep(2)
    setLoadingMsg('Bestand lezen en analyseren...')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('subject', fileSubject || 'Geen onderwerp')
      formData.append('from', fileFrom || 'onbekend@email.com')

      const { data } = await api.post('/mails/analyze-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      finishAnalysis([data])
    } catch (err) {
      setError(err.response?.data?.error || 'Bestand analyseren mislukt')
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  function finishAnalysis(collected) {
    setResults(collected)
    let taskId = 0
    const flat = collected.flatMap(r =>
      r.tasks.map(t => ({
        ...t,
        _id: taskId++,
        mailId: r.mail.id,
        selected: t.bestemming !== 'weggooien',
        title: t.gtd?.verbeterd || t.title,
        originalTitle: t.gtd?.origineel,
      }))
    )
    setAllTasks(flat)
    setStep(3)
  }

  // --- Approve all ---
  async function handleApprove() {
    try {
      const byMail = {}
      for (const t of allTasks.filter(t => t.selected)) {
        if (!byMail[t.mailId]) byMail[t.mailId] = []
        byMail[t.mailId].push(t)
      }
      for (const [mailId, tasks] of Object.entries(byMail)) {
        await api.post(`/mails/${mailId}/approve`, { tasks })
      }
      navigate('/tasks')
    } catch (err) {
      setError(err.response?.data?.error || 'Opslaan mislukt')
    }
  }

  function toggleTask(id) {
    setAllTasks(ts => ts.map(t => t._id === id ? { ...t, selected: !t.selected } : t))
  }
  function updateTask(id, field, value) {
    setAllTasks(ts => ts.map(t => t._id === id ? { ...t, [field]: value } : t))
  }
  function removeTask(id) {
    setAllTasks(ts => ts.filter(t => t._id !== id))
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate('/inbox')}
        className="flex items-center gap-1 text-sm text-accent-700 hover:text-accent-900 mb-6"
      >
        <ArrowLeft size={14} /> Terug naar inbox
      </button>

      <h1 className="text-2xl font-bold text-accent-700 mb-2">Mail analyseren</h1>

      {/* Steps */}
      <div className="flex items-center gap-3 mb-8">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step >= n ? 'bg-accent-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>{n}</div>
            <span className={`text-sm ${step === n ? 'text-accent-700 font-medium' : 'text-gray-400'}`}>
              {n === 1 ? 'Mail invoeren' : n === 2 ? 'AI analyseert' : 'Taken goedkeuren'}
            </span>
            {n < 3 && <div className={`w-8 h-0.5 ${step > n ? 'bg-accent-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="bg-white border border-accent-100 rounded-2xl p-6">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setInputTab('text')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                inputTab === 'text' ? 'bg-white text-accent-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText size={14} /> Tekst plakken
            </button>
            <button
              onClick={() => setInputTab('file')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                inputTab === 'file' ? 'bg-white text-accent-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Upload size={14} /> Bestand uploaden
            </button>
          </div>

          {/* Text tab */}
          {inputTab === 'text' && (
            <form onSubmit={handleAnalyzeText} className="space-y-4">
              {mails.map((mail, i) => (
                <div key={i} className={`space-y-3 ${mails.length > 1 ? 'border border-gray-100 rounded-xl p-4' : ''}`}>
                  {mails.length > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">Mail {i + 1}</span>
                      <button type="button" onClick={() => removeMail(i)} className="text-gray-300 hover:text-red-400">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mailinhoud *</label>
                    <textarea
                      required={i === 0}
                      rows={8}
                      value={mail.body}
                      onChange={e => updateMail(i, 'body', e.target.value)}
                      placeholder="Plak hier de volledige mail..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Onderwerp</label>
                      <input
                        type="text"
                        value={mail.subject}
                        onChange={e => updateMail(i, 'subject', e.target.value)}
                        placeholder="Optioneel"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Afzender</label>
                      <input
                        type="text"
                        value={mail.from}
                        onChange={e => updateMail(i, 'from', e.target.value)}
                        placeholder="naam@email.nl"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addMail}
                className="flex items-center gap-1.5 text-sm text-accent-700 hover:text-accent-900 font-medium"
              >
                <Plus size={14} /> Nog een mail toevoegen
              </button>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                className="w-full bg-accent-600 hover:bg-accent-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                {mails.filter(m => m.body.trim()).length > 1
                  ? `${mails.filter(m => m.body.trim()).length} mails analyseren`
                  : 'Analyseren met AI'}
              </button>
            </form>
          )}

          {/* File tab */}
          {inputTab === 'file' && (
            <form onSubmit={handleAnalyzeFile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bestand (PDF of Word) *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={e => setFile(e.target.files[0] || null)}
                />
                {file ? (
                  <div className="flex items-center gap-3 border border-accent-100 bg-accent-50 rounded-lg px-4 py-3">
                    <FileText size={18} className="text-accent-600 flex-shrink-0" />
                    <span className="text-sm text-accent-700 font-medium flex-1 truncate">{file.name}</span>
                    <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-red-400">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-accent-300 hover:text-accent-500 transition-colors"
                  >
                    <Upload size={24} />
                    <span className="text-sm">Klik om een PDF of Word-bestand te kiezen</span>
                    <span className="text-xs">.pdf of .docx, max 10 MB</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Onderwerp</label>
                  <input
                    type="text"
                    value={fileSubject}
                    onChange={e => setFileSubject(e.target.value)}
                    placeholder="Optioneel"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Afzender</label>
                  <input
                    type="text"
                    value={fileFrom}
                    onChange={e => setFileFrom(e.target.value)}
                    placeholder="naam@email.nl"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={!file}
                className="w-full bg-accent-600 hover:bg-accent-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
              >
                Bestand analyseren
              </button>
            </form>
          )}
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="bg-white border border-accent-100 rounded-2xl p-12 flex flex-col items-center">
          <Loader2 size={40} className="text-accent-600 animate-spin mb-4" />
          <p className="text-accent-700 font-medium">{loadingMsg}</p>
          <p className="text-gray-400 text-sm mt-1">Even geduld</p>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-4">
          {results.length > 1 && (
            <div className="bg-white border border-accent-100 rounded-2xl p-4">
              <p className="text-sm text-accent-700 font-medium">{results.length} mails geanalyseerd</p>
            </div>
          )}

          {results.length === 1 && (
            <div className="bg-white border border-accent-100 rounded-2xl p-6">
              <h2 className="font-semibold text-gray-800 mb-2">Gedetecteerd</h2>
              <div className="flex gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent-100 text-accent-700">
                  {CATEGORY_LABELS[results[0]?.category] || results[0]?.category}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[results[0]?.priority]}`}>
                  {results[0]?.priority === 'high' ? 'Hoog' : results[0]?.priority === 'low' ? 'Laag' : 'Gemiddeld'}
                </span>
              </div>
            </div>
          )}

          <div className="bg-white border border-accent-100 rounded-2xl p-6">
            <h2 className="font-semibold text-gray-800 mb-4">
              Gevonden taken ({allTasks.filter(t => t.selected).length} geselecteerd)
            </h2>

            {allTasks.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">Geen taken gevonden.</p>
            )}

            <div className="space-y-3">
              {allTasks.map(task => (
                <div key={task._id} className={`border rounded-xl p-4 transition-colors ${
                  task.bestemming === 'weggooien' ? 'border-red-100 bg-red-50 opacity-60' :
                  task.bestemming === 'kalender'  ? 'border-accent-100 bg-accent-50' :
                  task.selected ? 'border-accent-100 bg-accent-50' : 'border-gray-200 bg-gray-50 opacity-60'
                }`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={task.selected}
                      onChange={() => toggleTask(task._id)}
                      className="mt-1 accent-accent-700"
                    />
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={task.title}
                        onChange={e => updateTask(task._id, 'title', e.target.value)}
                        className="w-full font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-accent-300 focus:border-accent-500 focus:outline-none text-sm pb-0.5"
                      />
                      {/* Original title if different */}
                      {task.originalTitle && task.originalTitle !== task.title && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">Origineel: {task.originalTitle}</p>
                      )}
                      {/* Calendar warning */}
                      {task.bestemming === 'kalender' && (
                        <p className="text-xs text-accent-600 mt-1">Dit hoort in je agenda, niet in je takenlijst.</p>
                      )}
                      {task.description && (
                        <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                      )}
                      {/* GTD uitleg */}
                      {task.gtd?.uitleg && (
                        <p className="text-xs text-gray-400 mt-1 italic">{task.gtd.uitleg}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* Bestemming badge */}
                        {task.bestemming && task.bestemming !== 'actie' && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BESTEMMING_COLORS[task.bestemming] || 'bg-gray-100 text-gray-600'}`}>
                            {BESTEMMING_LABELS[task.bestemming] || task.bestemming}
                          </span>
                        )}
                        {task.deadline && (
                          <input
                            type="date"
                            lang="nl"
                            value={task.deadline?.split(' ')[0] || ''}
                            onChange={e => updateTask(task._id, 'deadline', e.target.value)}
                            className="text-xs text-gray-500 bg-transparent border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent-400"
                          />
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.mid}`}>
                          {task.priority === 'high' ? 'Hoog' : task.priority === 'low' ? 'Laag' : 'Gemiddeld'}
                        </span>
                        {task.subtasks?.length > 0 && (
                          <span className="text-xs text-gray-400">{task.subtasks.length} subtaken</span>
                        )}
                        {task.gtd?.score && (
                          <span className="text-xs text-gray-300">GTD {task.gtd.score}/5</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => removeTask(task._id)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/inbox')}
              className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleApprove}
              className="flex-1 bg-accent-600 hover:bg-accent-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              Goedkeuren en opslaan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

