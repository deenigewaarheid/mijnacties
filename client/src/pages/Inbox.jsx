import { useState, useEffect, useRef } from 'react'
import { Plus, Mail, X, Trash2, Loader2, CheckCircle2, Upload, FileText, ArrowRight, ChevronRight, Check } from 'lucide-react'
import api from '../api/client'
import { refreshBadges } from '../api/badges'
import { useConfirm } from '../components/ConfirmDialog'

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700',
  mid:  'bg-amber-100 text-amber-700',
  low:  'bg-accent-50 text-accent-700',
}
const PRIORITY_LABELS = { high: 'Hoog', mid: 'Gemiddeld', low: 'Laag' }
const CATEGORY_COLORS = { werk: 'bg-accent-50 text-accent-700', 'privé': 'bg-accent-100 text-accent-600' }
const BESTEMMING_COLORS = {
  actie: 'bg-accent-50 text-accent-700', kalender: 'bg-accent-100 text-accent-600',
  project: 'bg-orange-100 text-orange-700', wachten: 'bg-gray-100 text-gray-600',
  ooit: 'bg-gray-50 text-gray-500', weggooien: 'bg-red-50 text-red-500',
}
const BESTEMMING_LABELS = {
  actie: 'Actie', kalender: 'Kalender', project: 'Project',
  wachten: 'Wachten op', ooit: 'Ooit/misschien', weggooien: 'Niet nodig',
}
const EMPTY_MAIL = () => ({ body: '', subject: '', from: '' })

// ─── Analyze panel ────────────────────────────────────────────────────────────

function AnalyzePanel({ onClose, onDone, initialMail }) {
  const [step, setStep]           = useState(1)
  const [inputTab, setInputTab]   = useState('text')
  const [mails, setMails]         = useState(initialMail
    ? [{ body: initialMail.body || '', subject: initialMail.subject || '', from: initialMail.from_email || '' }]
    : [EMPTY_MAIL()])
  const [file, setFile]           = useState(null)
  const [fileSubject, setFileSubject] = useState('')
  const [fileFrom, setFileFrom]   = useState('')
  const [results, setResults]     = useState([])
  const [allTasks, setAllTasks]   = useState([])
  const [loading, setLoading]     = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError]         = useState('')
  const fileInputRef = useRef()

  function updateMail(i, field, value) {
    setMails(ms => ms.map((m, idx) => idx === i ? { ...m, [field]: value } : m))
  }

  async function handleAnalyzeText(e) {
    e.preventDefault()
    if (mails.every(m => !m.body.trim())) return
    setError(''); setLoading(true); setStep(2)
    const collected = []
    try {
      for (let i = 0; i < mails.length; i++) {
        const m = mails[i]
        if (!m.body.trim()) continue
        setLoadingMsg(mails.length > 1 ? `Mail ${i + 1} van ${mails.length} analyseren...` : 'AI analyseert mail (GTD)...')
        const { data } = await api.post('/mails/analyze', {
          body: m.body, subject: m.subject || 'Geen onderwerp', from: m.from || 'onbekend@email.com'
        })
        collected.push(data)
      }
      finishAnalysis(collected)
    } catch (err) {
      setError(err.response?.data?.error || 'Analyse mislukt'); setStep(1)
    } finally { setLoading(false) }
  }

  async function handleAnalyzeFile(e) {
    e.preventDefault()
    if (!file) return
    setError(''); setLoading(true); setStep(2); setLoadingMsg('Bestand lezen en analyseren...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('subject', fileSubject || 'Geen onderwerp')
      formData.append('from', fileFrom || 'onbekend@email.com')
      const { data } = await api.post('/mails/analyze-file', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      finishAnalysis([data])
    } catch (err) {
      setError(err.response?.data?.error || 'Bestand analyseren mislukt'); setStep(1)
    } finally { setLoading(false) }
  }

  function finishAnalysis(collected) {
    setResults(collected)
    let taskId = 0
    const flat = collected.flatMap(r =>
      r.tasks.map(t => ({
        ...t, _id: taskId++, mailId: r.mail.id,
        selected: t.bestemming !== 'weggooien',
        title: t.gtd?.verbeterd || t.title,
        originalTitle: t.gtd?.origineel,
      }))
    )
    setAllTasks(flat); setStep(3)
  }

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
      refreshBadges()
      onDone()
    } catch (err) {
      setError(err.response?.data?.error || 'Opslaan mislukt')
    }
  }

  function toggleTask(id) { setAllTasks(ts => ts.map(t => t._id === id ? { ...t, selected: !t.selected } : t)) }
  function updateTask(id, field, value) { setAllTasks(ts => ts.map(t => t._id === id ? { ...t, [field]: value } : t)) }
  function removeTask(id) { setAllTasks(ts => ts.filter(t => t._id !== id)) }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />

      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-display font-bold text-gray-900">Mail analyseren</h2>
            <div className="flex items-center gap-2 mt-1">
              {[1, 2, 3].map(n => (
                <div key={n} className="flex items-center gap-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                    step >= n ? 'bg-accent-600 text-white' : 'bg-gray-200 text-gray-400'
                  }`}>{n}</div>
                  {n < 3 && <ChevronRight size={10} className="text-gray-300" />}
                </div>
              ))}
              <span className="text-xs text-gray-400 ml-1">
                {step === 1 ? 'Invoeren' : step === 2 ? 'Analyseren...' : 'Goedkeuren'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                {[['text', <FileText size={13} />, 'Tekst plakken'], ['file', <Upload size={13} />, 'Bestand']].map(([key, icon, label]) => (
                  <button key={key} onClick={() => setInputTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      inputTab === key ? 'bg-white text-accent-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {icon}{label}
                  </button>
                ))}
              </div>

              {inputTab === 'text' && (
                <form onSubmit={handleAnalyzeText} className="space-y-4">
                  {mails.map((mail, i) => (
                    <div key={i} className={`space-y-3 ${mails.length > 1 ? 'border border-gray-100 rounded-xl p-4' : ''}`}>
                      {mails.length > 1 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">Mail {i + 1}</span>
                          <button type="button" onClick={() => setMails(ms => ms.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400"><X size={13} /></button>
                        </div>
                      )}
                      <textarea required={i === 0} rows={7} value={mail.body} onChange={e => updateMail(i, 'body', e.target.value)}
                        placeholder="Plak hier de volledige mailinhoud..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 resize-none transition-colors" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={mail.subject} onChange={e => updateMail(i, 'subject', e.target.value)}
                          placeholder="Onderwerp (optioneel)"
                          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent-500 transition-colors" />
                        <input type="text" value={mail.from} onChange={e => updateMail(i, 'from', e.target.value)}
                          placeholder="Afzender (optioneel)"
                          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent-500 transition-colors" />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => setMails(ms => [...ms, EMPTY_MAIL()])}
                    className="flex items-center gap-1 text-sm text-accent-600 hover:text-accent-700 font-medium">
                    <Plus size={13} />Nog een mail
                  </button>
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <button type="submit" className="w-full bg-accent-600 hover:bg-accent-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
                    {mails.filter(m => m.body.trim()).length > 1
                      ? `${mails.filter(m => m.body.trim()).length} mails analyseren`
                      : 'Analyseren met AI'}
                  </button>
                </form>
              )}

              {inputTab === 'file' && (
                <form onSubmit={handleAnalyzeFile} className="space-y-4">
                  <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={e => setFile(e.target.files[0] || null)} />
                  {file ? (
                    <div className="flex items-center gap-3 border border-accent-200 bg-accent-50 rounded-lg px-4 py-3">
                      <FileText size={16} className="text-accent-600 flex-shrink-0" />
                      <span className="text-sm text-accent-800 font-medium flex-1 truncate">{file.name}</span>
                      <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-red-400"><X size={14} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current.click()}
                      className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-accent-300 hover:text-accent-500 transition-colors">
                      <Upload size={24} />
                      <span className="text-sm">Klik om PDF of Word te kiezen</span>
                      <span className="text-xs">.pdf of .docx, max 10 MB</span>
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={fileSubject} onChange={e => setFileSubject(e.target.value)} placeholder="Onderwerp"
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent-500 transition-colors" />
                    <input type="text" value={fileFrom} onChange={e => setFileFrom(e.target.value)} placeholder="Afzender"
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent-500 transition-colors" />
                  </div>
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <button type="submit" disabled={!file} className="w-full bg-accent-600 hover:bg-accent-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors">
                    Bestand analyseren
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="flex flex-col items-center justify-center h-64">
              <Loader2 size={36} className="text-accent-600 animate-spin mb-4" />
              <p className="text-accent-800 font-medium text-sm">{loadingMsg}</p>
              <p className="text-gray-400 text-xs mt-1">Even geduld</p>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                {allTasks.filter(t => t.selected).length} taken geselecteerd
                {results.length > 1 && ` uit ${results.length} mails`}
              </p>

              <div className="space-y-2">
                {allTasks.map(task => (
                  <div key={task._id} className={`border rounded-xl p-3 transition-colors ${
                    task.bestemming === 'weggooien' ? 'border-red-100 bg-red-50 opacity-60' :
                    task.selected ? 'border-accent-200 bg-accent-50' : 'border-gray-200 bg-gray-50 opacity-50'
                  }`}>
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={task.selected} onChange={() => toggleTask(task._id)} className="mt-1" style={{ accentColor: '#0f6e56' }} />
                      <div className="flex-1 min-w-0">
                        <input type="text" value={task.title} onChange={e => updateTask(task._id, 'title', e.target.value)}
                          className="w-full font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-accent-300 focus:border-accent-500 focus:outline-none text-sm pb-0.5" />
                        {task.originalTitle && task.originalTitle !== task.title && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate">Origineel: {task.originalTitle}</p>
                        )}
                        {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
                        {task.gtd?.uitleg && <p className="text-xs text-gray-400 mt-1 italic">{task.gtd.uitleg}</p>}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {task.bestemming && task.bestemming !== 'actie' && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${BESTEMMING_COLORS[task.bestemming] || 'bg-gray-100 text-gray-600'}`}>
                              {BESTEMMING_LABELS[task.bestemming] || task.bestemming}
                            </span>
                          )}
                          {task.deadline && (
                            <input type="date" lang="nl" value={task.deadline?.split(' ')[0] || ''} onChange={e => updateTask(task._id, 'deadline', e.target.value)}
                              className="text-xs text-gray-500 bg-transparent border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none" />
                          )}
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.mid}`}>
                            {PRIORITY_LABELS[task.priority] || 'Gemiddeld'}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => removeTask(task._id)} className="text-gray-300 hover:text-red-400 flex-shrink-0"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 3 && (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
            <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-lg text-sm transition-colors">
              Annuleren
            </button>
            <button onClick={handleApprove}
              className="flex-1 bg-accent-600 hover:bg-accent-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
              <CheckCircle2 size={15} />
              Opslaan in taken
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Mail detail modal ────────────────────────────────────────────────────────

function MailDetailModal({ mail, onClose, onTasksApproved }) {
  const [analyzing, setAnalyzing] = useState(false)
  const [tasks, setTasks]         = useState(null)
  const [error, setError]         = useState('')

  async function handleAnalyze() {
    setAnalyzing(true); setError('')
    try {
      const { data } = await api.post(`/mails/${mail.id}/analyze`)
      let taskId = 0
      setTasks(data.tasks.map(t => ({
        ...t, _id: taskId++,
        selected: t.bestemming !== 'weggooien',
        title: t.gtd?.verbeterd || t.title,
        originalTitle: t.gtd?.origineel,
      })))
    } catch {
      setError('Analyse mislukt, probeer opnieuw')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleApprove() {
    try {
      await api.post(`/mails/${mail.id}/approve`, { tasks: tasks.filter(t => t.selected) })
      onTasksApproved()
    } catch {
      setError('Opslaan mislukt')
    }
  }

  function toggleTask(id) { setTasks(ts => ts.map(t => t._id === id ? { ...t, selected: !t.selected } : t)) }
  function updateTask(id, field, val) { setTasks(ts => ts.map(t => t._id === id ? { ...t, [field]: val } : t)) }
  function removeTask(id) { setTasks(ts => ts.filter(t => t._id !== id)) }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-200">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="font-display font-bold text-gray-900">{mail.subject}</h2>
            <p className="text-sm text-accent-600 mt-0.5">{mail.from_email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"><X size={18} /></button>
        </div>

        {/* Badges */}
        <div className="flex gap-2 px-6 py-3 border-b border-gray-100">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[mail.priority] || PRIORITY_COLORS.mid}`}>
            {PRIORITY_LABELS[mail.priority]}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[mail.category] || 'bg-gray-100 text-gray-500'}`}>
            {mail.category}
          </span>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {!tasks && (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{mail.body}</pre>
          )}

          {tasks && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">{tasks.filter(t => t.selected).length} taken geselecteerd</p>
              {tasks.length === 0 && <p className="text-sm text-gray-400">Geen actiepunten gevonden in deze mail.</p>}
              {tasks.map(task => (
                <div key={task._id} className={`border rounded-xl p-3 transition-colors ${
                  task.bestemming === 'weggooien' ? 'border-red-100 bg-red-50 opacity-60' :
                  task.selected ? 'border-accent-200 bg-accent-50' : 'border-gray-200 bg-gray-50 opacity-50'
                }`}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={task.selected} onChange={() => toggleTask(task._id)} className="mt-1" style={{ accentColor: '#0f6e56' }} />
                    <div className="flex-1 min-w-0">
                      <input type="text" value={task.title} onChange={e => updateTask(task._id, 'title', e.target.value)}
                        className="w-full font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-accent-300 focus:border-accent-500 focus:outline-none text-sm pb-0.5" />
                      {task.originalTitle && task.originalTitle !== task.title && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">Origineel: {task.originalTitle}</p>
                      )}
                      {task.description && <p className="text-xs text-gray-500 mt-1">{task.description}</p>}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {task.bestemming && task.bestemming !== 'actie' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${BESTEMMING_COLORS[task.bestemming] || 'bg-gray-100 text-gray-600'}`}>
                            {BESTEMMING_LABELS[task.bestemming] || task.bestemming}
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.mid}`}>
                          {PRIORITY_LABELS[task.priority] || 'Gemiddeld'}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => removeTask(task._id)} className="text-gray-300 hover:text-red-400 flex-shrink-0"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium py-2.5 rounded-lg text-sm transition-colors">
            Sluiten
          </button>
          {!tasks ? (
            <button onClick={handleAnalyze} disabled={analyzing}
              className="flex-1 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
              {analyzing ? <><Loader2 size={14} className="animate-spin" />Analyseren...</> : <><ArrowRight size={14} />Taken extraheren</>}
            </button>
          ) : (
            <button onClick={handleApprove} disabled={!tasks.some(t => t.selected)}
              className="flex-1 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
              <CheckCircle2 size={14} />Opslaan in taken
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Inbox ────────────────────────────────────────────────────────────────────

export default function Inbox() {
  const [mails, setMails]           = useState([])
  const [selected, setSelected]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [showAnalyze, setShowAnalyze] = useState(false)
  const [analyzeMail, setAnalyzeMail] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')
  const [syncing, setSyncing]       = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [gmailConnected, setGmailConnected] = useState(false)
  const [selectedMails, setSelectedMails] = useState(new Set())
  const { confirm, dialog: confirmDialog } = useConfirm()

  useEffect(() => {
    api.get('/auth/gmail/status').then(r => setGmailConnected(r.data.connected)).catch(() => {})
  }, [])

  async function handleSync() {
    setSyncing(true)
    try {
      const { data } = await api.post('/mails/sync')
      const msg = data.newMails > 0
        ? `✓ ${data.newMails} nieuwe mail${data.newMails !== 1 ? 's' : ''} binnengehaald`
        : 'Geen nieuwe mails'
      setSuccessMsg(msg)
      if (data.newMails > 0) fetchMails()
    } catch { setSuccessMsg('Sync mislukt') }
    finally { setSyncing(false); setTimeout(() => setSuccessMsg(''), 4000) }
  }

  async function handleReprocess() {
    setReprocessing(true)
    try {
      const { data } = await api.post('/mails/reprocess')
      setSuccessMsg(data.message)
      fetchMails()
    } catch { setSuccessMsg('Herverwerken mislukt') }
    finally { setReprocessing(false); setTimeout(() => setSuccessMsg(''), 6000) }
  }

  function fetchMails() {
    return api.get('/mails').then(r => setMails(r.data))
  }

  useEffect(() => {
    fetchMails().finally(() => setLoading(false))
  }, [])

  async function handleDelete(e, mailId) {
    e.stopPropagation()
    const ok = await confirm('Weet je zeker dat je deze mail wilt verwijderen?')
    if (!ok) return
    await api.delete(`/mails/${mailId}`)
    setMails(ms => ms.filter(m => m.id !== mailId))
    if (selected?.id === mailId) setSelected(null)
    refreshBadges()
  }

  function handleDone() {
    setShowAnalyze(false)
    setAnalyzeMail(null)
    fetchMails()
    setSuccessMsg('Taken opgeslagen!')
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  async function toggleMailmaker(e, mailId, current) {
    e.stopPropagation()
    await api.patch(`/mails/${mailId}`, { needs_reply: !current })
    setMails(ms => ms.map(m => m.id === mailId ? { ...m, needs_reply: !current } : m))
  }

  async function toggleProcessed(e, mailId, currentStatus) {
    e.stopPropagation()
    const newStatus = currentStatus === 'approved' ? 'unread' : 'approved'
    await api.patch(`/mails/${mailId}`, { status: newStatus })
    setMails(ms => ms.map(m => m.id === mailId ? { ...m, status: newStatus } : m))
  }

  function toggleSelect(mailId) {
    setSelectedMails(prev => {
      const next = new Set(prev)
      if (next.has(mailId)) next.delete(mailId)
      else next.add(mailId)
      return next
    })
  }

  async function handleBulkDelete() {
    const ok = await confirm(`Weet je zeker dat je ${selectedMails.size} mail${selectedMails.size !== 1 ? 's' : ''} wilt verwijderen?`)
    if (!ok) return
    for (const mailId of selectedMails) {
      await api.delete(`/mails/${mailId}`)
    }
    setMails(ms => ms.filter(m => !selectedMails.has(m.id)))
    setSelectedMails(new Set())
    refreshBadges()
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }

  function senderInitials(email) {
    if (!email) return '?'
    const name = email.split('@')[0]
    const parts = name.split(/[._-]/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <>
      {confirmDialog}
      <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-display font-bold text-gray-900 dark:text-gray-100">Inbox</h1>
        <button onClick={() => setShowAnalyze(true)}
          className="flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          <Plus size={15} />Mail analyseren
        </button>
      </div>

      {gmailConnected && (
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
            <Mail size={13} />{syncing ? 'Synchroniseren...' : 'Sync nu'}
          </button>
          <button onClick={handleReprocess} disabled={reprocessing}
            className="flex items-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
            <Mail size={13} />{reprocessing ? 'Bezig...' : 'Taken genereren uit mails'}
          </button>
          {successMsg && (
            <span className="text-xs text-accent-600 font-medium flex items-center gap-1">
              <CheckCircle2 size={13} />{successMsg}
            </span>
          )}
        </div>
      )}

      {loading && <p className="text-gray-500 text-sm">Laden...</p>}

      {!loading && mails.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Mail size={24} className="opacity-50" />
          </div>
          <p className="font-display font-semibold text-gray-500 mb-1">Geen mails</p>
          <p className="text-sm mb-4">Plak een mail om te beginnen.</p>
          <button onClick={() => setShowAnalyze(true)}
            className="inline-flex items-center gap-1.5 text-sm text-accent-600 hover:text-accent-700 font-semibold">
            <ArrowRight size={14} />Mail analyseren
          </button>
        </div>
      )}

      {/* Bulk delete toolbar */}
      {selectedMails.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl">
          <span className="text-sm text-gray-600 flex-1">{selectedMails.size} geselecteerd</span>
          <button onClick={() => setSelectedMails(new Set())} className="text-xs text-gray-500 hover:text-gray-700 font-medium">
            Deselecteer alles
          </button>
          <button onClick={handleBulkDelete}
            className="flex items-center gap-1.5 text-xs text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors font-semibold">
            <Trash2 size={12} />Verwijder ({selectedMails.size})
          </button>
        </div>
      )}

      <div className="space-y-2">
        {mails.map(mail => {
          const isApproved = mail.status === 'approved'
          const isSelected = selectedMails.has(mail.id)
          return (
            <div key={mail.id}
              className={`bg-white border rounded-xl px-4 py-3 transition-all dark:bg-gray-900 ${
                isSelected ? 'border-accent-300 bg-accent-50 dark:bg-accent-900/10' :
                isApproved ? 'border-gray-100 opacity-60 dark:border-gray-700' :
                'border-gray-200 hover:border-accent-200 hover:shadow-sm dark:border-gray-700'
              }`}>
              <div className="flex items-center gap-3">
                {/* Multi-select checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(mail.id)}
                  onClick={e => e.stopPropagation()}
                  className="w-4 h-4 flex-shrink-0 cursor-pointer"
                  style={{ accentColor: '#0f6e56' }}
                />

                {/* Sender avatar */}
                <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0 cursor-pointer"
                  onClick={() => { setAnalyzeMail(mail); setShowAnalyze(true) }}>
                  <span className="text-xs font-bold text-accent-700 leading-none select-none">
                    {senderInitials(mail.from_email)}
                  </span>
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => { setAnalyzeMail(mail); setShowAnalyze(true) }}>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{mail.from_email}</p>
                  <p className={`font-medium text-sm truncate ${isApproved ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                    {mail.subject}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[mail.priority] || PRIORITY_COLORS.mid}`}>
                    {PRIORITY_LABELS[mail.priority] || mail.priority}
                  </span>
                  <span className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[mail.category] || 'bg-gray-100 text-gray-500'}`}>
                    {mail.category}
                  </span>
                  <span className="text-xs text-gray-400 hidden md:inline">{formatDate(mail.received_at)}</span>

                  {/* Processed toggle */}
                  <button
                    onClick={e => toggleProcessed(e, mail.id, mail.status)}
                    title={isApproved ? 'Markeer als ongelezen' : 'Markeer als afgehandeld'}
                    className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                      isApproved
                        ? 'bg-accent-500 border-accent-500 text-white'
                        : 'border-gray-300 text-gray-300 hover:border-accent-400 hover:text-accent-500'
                    }`}>
                    <Check size={12} />
                  </button>

                  {/* Mailmaker toggle */}
                  <button
                    onClick={e => toggleMailmaker(e, mail.id, mail.needs_reply)}
                    title={mail.needs_reply ? 'In Mailmaker — klik om te verwijderen' : 'Toevoegen aan Mailmaker'}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      mail.needs_reply
                        ? 'bg-accent-600 border-accent-600 text-white'
                        : 'border-gray-200 text-gray-400 hover:border-accent-400 hover:text-accent-600'
                    }`}>
                    ✉
                  </button>

                  <button onClick={e => handleDelete(e, mail.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Mail detail modal */}
      {selected && (
        <MailDetailModal
          mail={selected}
          onClose={() => setSelected(null)}
          onTasksApproved={() => { setSelected(null); fetchMails(); refreshBadges(); setSuccessMsg('Taken opgeslagen!'); setTimeout(() => setSuccessMsg(''), 3000) }}
        />
      )}

      {/* Analyze slide-over */}
      {showAnalyze && (
        <AnalyzePanel
          onClose={() => { setShowAnalyze(false); setAnalyzeMail(null) }}
          onDone={handleDone}
          initialMail={analyzeMail}
        />
      )}
    </div>
    </>
  )
}
