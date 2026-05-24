import { useState } from 'react'
import {
  CheckCircle2, FolderKanban, Inbox, CalendarDays, Trophy,
  ChevronLeft, ChevronRight, Check, Sparkles,
} from 'lucide-react'

// ─── Step configuration ───────────────────────────────────────────────────────

const STEPS = [
  {
    id:       'vorige-week',
    Icon:     CheckCircle2,
    label:    'Vorige week',
    title:    'Vorige week afsluiten',
    subtitle: 'Reflecteer op wat je hebt bereikt en wat niet.',
    gradient: 'from-blue-500 to-blue-600',
    text:     'text-blue-600 dark:text-blue-400',
  },
  {
    id:       'projecten',
    Icon:     FolderKanban,
    label:    'Projecten',
    title:    'Projecten checken',
    subtitle: 'Heeft elk project een duidelijke volgende actie?',
    gradient: 'from-purple-500 to-purple-600',
    text:     'text-purple-600 dark:text-purple-400',
  },
  {
    id:       'inbox',
    Icon:     Inbox,
    label:    'Inbox',
    title:    'Inbox leegmaken',
    subtitle: 'Verwerk alles naar nul — e-mails, notities en losse papieren.',
    gradient: 'from-orange-500 to-orange-600',
    text:     'text-orange-600 dark:text-orange-400',
  },
  {
    id:       'volgende-week',
    Icon:     CalendarDays,
    label:    'Volgende week',
    title:    'Komende week plannen',
    subtitle: 'Welke taken en afspraken staan er op de agenda?',
    gradient: 'from-green-500 to-green-600',
    text:     'text-green-600 dark:text-green-400',
  },
  {
    id:       'doelen',
    Icon:     Trophy,
    label:    'Doelen',
    title:    'Doelen checken',
    subtitle: 'Zijn je dagelijkse taken aligned met je langetermijndoelen?',
    gradient: 'from-yellow-400 to-yellow-500',
    text:     'text-yellow-600 dark:text-yellow-500',
  },
]

// ─── Interactive check item ───────────────────────────────────────────────────

function CheckItem({ label }) {
  const [checked, setChecked] = useState(false)
  return (
    <button
      onClick={() => setChecked(c => !c)}
      className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg border transition-all ${
        checked
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
          : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 dark:hover:border-gray-700'
      }`}
    >
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
        checked ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 dark:border-gray-600'
      }`}>
        {checked && <Check size={11} />}
      </div>
      <span className={`text-sm leading-snug ${
        checked ? 'line-through text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'
      }`}>
        {label}
      </span>
    </button>
  )
}

// ─── Step content components ──────────────────────────────────────────────────

function ReviewLastWeek() {
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Kijk terug op de afgelopen week. Wat is er gedaan, wat niet, en waarom?
      </p>
      <CheckItem label="Loop alle voltooide taken door — neem een moment om het te waarderen" />
      <CheckItem label="Bekijk verlopen taken: zijn ze nog relevant of kun je ze verwijderen?" />
      <CheckItem label="Noteer wat blijven liggen is en waarom — zonder oordeel" />
      <CheckItem label="Wat heeft je energie gegeven deze week? Schrijf het op." />
      <CheckItem label="Wat heeft energie gekost? Hoe kun je dat volgende week anders aanpakken?" />
      <CheckItem label="Welke taken wil je bewust doorschuiven naar volgende week?" />
    </div>
  )
}

function ReviewProjects() {
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Loop elk actief project door. Elk project heeft een concrete volgende actie nodig.
      </p>
      <CheckItem label="Open de projectenpagina en bekijk elk project één voor één" />
      <CheckItem label="Heeft elk project een duidelijke volgende stap in je takenlijst?" />
      <CheckItem label="Zijn er vastgelopen projecten? Benoem het obstakel en maak een plan." />
      <CheckItem label="Zijn alle projecten nog actueel en relevant voor nu?" />
      <CheckItem label="Zijn er nieuwe projecten die je nog moet aanmaken?" />
      <CheckItem label="Controleer subtaken — zijn ze juist, concreet en realistisch?" />
    </div>
  )
}

function ReviewInbox() {
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Verwerk alle inkomende informatie. Niks mag blijven hangen — inbox naar nul.
      </p>
      <CheckItem label="Verwerk alle e-mails in de app — analyseer en maak taken aan" />
      <CheckItem label="Verwerk losse aantekeningen, post-its en notitieblokken" />
      <CheckItem label="Check voiceberichten en chats (WhatsApp, Teams, Slack…)" />
      <CheckItem label="Verwerk fotonotities en schermafbeeldingen op je telefoon" />
      <CheckItem label="Elk item: verwijder, doe direct (&lt;2 min), plan of delegeer" />
      <CheckItem label="Maak de 'Niet gepland'-lijst leeg in de app" />
    </div>
  )
}

function ReviewNextWeek() {
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Plan vooruit. Wat moet er volgende week absoluut gebeuren?
      </p>
      <CheckItem label="Bekijk je kalender voor de komende 7 dagen" />
      <CheckItem label="Markeer de 3 meest belangrijke taken als 'Focus'" />
      <CheckItem label="Stel deadlines in voor taken die al te lang openstaan" />
      <CheckItem label="Zijn er afspraken of vergaderingen die voorbereiding vereisen?" />
      <CheckItem label="Plan momenten voor diep concentratiewerk (geen afleidingen)" />
      <CheckItem label="Controleer of er taken zijn waarbij je op iemand wacht" />
    </div>
  )
}

function ReviewGoals() {
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Koppel je dagelijkse werk aan je grotere ambities. Is alles nog aligned?
      </p>
      <CheckItem label="Open de doelenpagina en bekijk elk doel" />
      <CheckItem label="Heb je deze week stappen gezet richting je doelen?" />
      <CheckItem label="Zijn je doelen nog actueel, of wil je er één bijstellen?" />
      <CheckItem label="Voeg een concrete actie toe aan elk doel met weinig voortgang" />
      <CheckItem label="Zijn er gewoonten of routines die je wil starten of stoppen?" />
      <CheckItem label="Sluit af: wat is één woord dat deze week typeerde voor jou?" />
    </div>
  )
}

const STEP_COMPONENTS = [
  ReviewLastWeek,
  ReviewProjects,
  ReviewInbox,
  ReviewNextWeek,
  ReviewGoals,
]

// ─── Completion screen ────────────────────────────────────────────────────────

function CompletionScreen({ onRestart }) {
  return (
    <div className="max-w-4xl mx-auto text-center py-20">
      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
        <Sparkles size={36} className="text-white" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Review voltooid!</h2>
      <p className="text-gray-500 dark:text-gray-400 mb-1">Je systeem is up-to-date en je hoofd is leeg.</p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-10">Volgende review: over 7 dagen.</p>
      <button
        onClick={onRestart}
        className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors underline underline-offset-2"
      >
        Nieuwe review starten
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Review() {
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)

  if (done) {
    return <CompletionScreen onRestart={() => { setStep(0); setDone(false) }} />
  }

  const progress   = (step + 1) / STEPS.length * 100
  const current    = STEPS[step]
  const CurrentIcon = current.Icon
  const StepContent = STEP_COMPONENTS[step]

  return (
    <div className="max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Wekelijkse Review</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
          Houd je systeem gezond en je hoofd leeg
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Stap {step + 1} van {STEPS.length}
          </span>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-start justify-between gap-1 mb-8">
        {STEPS.map((s, i) => {
          const isCompleted = i < step
          const isCurrent   = i === step
          const { Icon }    = s
          return (
            <button
              key={s.id}
              onClick={() => i <= step && setStep(i)}
              disabled={i > step}
              className="flex flex-col items-center gap-2 flex-1 disabled:cursor-default focus:outline-none"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                isCompleted
                  ? 'bg-green-500 shadow-sm'
                  : isCurrent
                    ? `bg-gradient-to-br ${s.gradient} shadow-md`
                    : 'bg-gray-100 dark:bg-gray-800'
              }`}>
                {isCompleted
                  ? <Check size={16} className="text-white" />
                  : <Icon size={16} className={isCurrent ? 'text-white' : 'text-gray-400 dark:text-gray-500'} />
                }
              </div>
              <span className={`text-xs font-medium text-center leading-tight hidden sm:block transition-colors ${
                isCurrent   ? s.text :
                isCompleted ? 'text-green-600 dark:text-green-400' :
                              'text-gray-400 dark:text-gray-500'
              }`}>
                {s.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Step content card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-8">
        {/* Card header */}
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${current.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <CurrentIcon size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{current.title}</h2>
            <p className="text-sm text-gray-400 dark:text-gray-500">{current.subtitle}</p>
          </div>
        </div>

        <StepContent key={step} />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-0 transition-colors"
        >
          <ChevronLeft size={16} />
          Vorige
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            className={`flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white bg-gradient-to-r ${current.gradient} hover:opacity-90 transition-opacity`}
          >
            Volgende stap
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={() => setDone(true)}
            className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors"
          >
            <Check size={16} />
            Review voltooien
          </button>
        )}
      </div>
    </div>
  )
}
