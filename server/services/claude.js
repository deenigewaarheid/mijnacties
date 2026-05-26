const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Extract tasks from email body using Claude
 */
async function extractTasks(emailBody, emailSubject, emailFrom, sourceType = 'email', images = []) {
    try {
        const isDocument = sourceType === 'file';
        const intro = isDocument
            ? `Analyseer dit document en extraheer ALLE taken, opdrachten en actiepunten die erin staan.`
            : `Analyseer deze email en extraheer ALLE actiepunten die de ontvanger moet uitvoeren.`;

        const today = new Date().toISOString().slice(0, 10);
        const prompt = `${intro}

VANDAAG: ${today}

${isDocument ? 'DOCUMENT TITEL' : 'EMAIL VAN'}: ${isDocument ? emailSubject : emailFrom}
ONDERWERP: ${emailSubject}

${isDocument ? 'DOCUMENT TEKST' : 'EMAIL TEKST'}:
${emailBody}

REGELS:
- Elke taak is één concreet actiepunt, geformuleerd als opdracht (begin met een werkwoord)
- Ook "lezen", "bekijken", "doorlezen" zijn acties — als de mail zegt "lees dit" is dat een taak
- "description": schrijf een korte samenvatting (1-2 zinnen) van de relevante context uit de tekst voor deze taak
- "subtasks": ALLEEN invullen als in de tekst letterlijk meerdere losse stappen of deeltaken worden genoemd. Verzin GEEN subtaken zelf.
- Geef een realistische deadline als die in de tekst staat, anders null
- Prioriteit: "high" als urgent/vandaag/morgen, "low" als geen haast, anders "mid"
- Bij een FW: (doorgestuurde mail) extraheer ook de actie die het doorsturen impliceert
${isDocument ? '- Extraheer ALLE taken en opdrachten uit het document, ook als het er veel zijn' : ''}

Geef ALLEEN een JSON array terug, zonder uitleg:
[
  {
    "title": "Werkwoord + wat doen (kort en concreet)",
    "description": "Korte samenvatting van de relevante context uit de tekst",
    "deadline": "YYYY-MM-DD of null",
    "priority": "high of mid of low",
    "subtasks": []
  }
]

Als er GEEN actiepunten zijn, return: []`;

        // Build content: prepend images if present (Claude vision)
        const content = images.length > 0
            ? [
                ...images.map(img => ({
                    type: 'image',
                    source: { type: 'base64', media_type: img.mimeType, data: img.data }
                })),
                { type: 'text', text: prompt }
              ]
            : prompt;

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2000,
            messages: [{ role: 'user', content }]
        });

        const responseText = message.content[0].text.trim();
        console.log('Claude raw response:', responseText.substring(0, 500));

        // Parse JSON response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.log('No JSON array found in Claude response');
            return [];
        }

        const tasks = JSON.parse(jsonMatch[0]);
        console.log('Parsed tasks count:', tasks.length);
        return tasks;

    } catch (error) {
        console.error('Error extracting tasks:', error);
        return [];
    }
}

/**
 * Detect email category (werk/privé)
 */
async function detectCategory(emailBody, emailSubject, emailFrom) {
    try {
        const subjectLower = emailSubject.toLowerCase();
        const bodyLower = emailBody.toLowerCase();
        const fromLower = (emailFrom || '').toLowerCase();

        // Non-personal domains = werk
        const personalDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.nl', 'ziggo.nl', 'kpnmail.nl'];
        const domain = fromLower.split('@')[1] || '';
        if (domain && !personalDomains.some(d => domain.endsWith(d))) {
            return 'werk';
        }

        const werkKeywords = [
            'vergadering', 'budget', 'collega', 'directie', 'team',
            'school', 'leerling', 'ouder', 'rapport', 'cijfer', 'toets',
            'huiswerk', 'klas', 'les', 'docent', 'leraar', 'rooster',
            'mededeling', 'mededelingen', 'asg', 'sectie', 'mentor',
            'notulen', 'agenda', 'afspraak', 'bijeenkomst', 'aanwezig',
        ];

        if (werkKeywords.some(kw => bodyLower.includes(kw) || subjectLower.includes(kw))) {
            return 'werk';
        }

        return 'privé';

    } catch (error) {
        console.error('Error detecting category:', error);
        return 'werk';
    }
}

/**
 * Detect email priority
 */
async function detectPriority(emailBody, emailSubject, deadline = null) {
    try {
        const text = (emailSubject + ' ' + emailBody).toLowerCase();

        // High priority keywords
        const urgentKeywords = ['dringend', 'urgent', 'asap', 'vandaag', 'morgen', 'spoed'];
        if (urgentKeywords.some(kw => text.includes(kw))) {
            return 'high';
        }

        // Check deadline
        if (deadline) {
            const daysUntil = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysUntil <= 2) {
                return 'high';
            } else if (daysUntil <= 7) {
                return 'mid';
            }
        }

        // Low priority keywords
        const lowKeywords = ['wanneer je tijd hebt', 'geen haast'];
        if (lowKeywords.some(kw => text.includes(kw))) {
            return 'low';
        }

        return 'mid';

    } catch (error) {
        console.error('Error detecting priority:', error);
        return 'mid';
    }
}

/**
 * Improve extracted actions using GTD principles (batch, one Claude call)
 */
async function improveActionsGTD(actions) {
    if (!actions || actions.length === 0) return [];
    try {
        const prompt = `Je bent een GTD-expert gespecialiseerd in het schrijven van concrete, uitvoerbare acties.

## JE TAAK
Verbeter de onderstaande ${actions.length} acties volgens GTD-principes.

## GTD-REGELS

### Een goede actie:
- Begint ALTIJD met een concreet werkwoord (infinitief)
- Beschrijft WAT je doet + WAAROP/MET WIE + eventueel VIA WELK MIDDEL
- Is uitvoerbaar zonder eerst nog na te denken over wat je precies moet doen
- Past in één werksessie

### Slechte formuleringen (verbied):
- "Bijwonen", "Aanwezig zijn bij", "Deelnemen aan" → dit hoort in de KALENDER
- "Houd rekening met" → geen actie, maak het concreet
- Zelfstandige naamwoorden als taak: "Vergadering", "Rapport", "Website"
- Vage werkwoorden: "Regelen", "Doen", "Afhandelen" (te vaag)

### Werkwoorden die je gebruikt:
Communicatie: Bellen, Mailen, Appen, Bespreken met, Vragen aan, Bevestigen bij, Terugkoppelen aan, Informeren, Antwoorden op, Opvolgen bij, Afstemmen met
Schrijven: Schrijven, Opstellen, Uitwerken, Aanpassen, Corrigeren, Invullen, Formuleren, Samenvatten, Noteren, Documenteren, Redigeren, Bijwerken
Lezen: Lezen, Bekijken, Doorlezen, Nakijken, Beoordelen, Controleren, Bestuderen, Raadplegen, Vergelijken, Analyseren, Reviewen
Regelen: Reserveren, Plannen, Boeken, Kopen, Bestellen, Ophalen, Inleveren, Afspreken, Aanmelden, Registreren, Archiveren, Sorteren
Digitaal: Opzoeken, Downloaden, Uploaden, Printen, Opslaan, Installeren, Aanmaken, Verwijderen, Delen, Exporteren, Updaten, Back-uppen
Beslissen: Kiezen tussen, Beslissen over, Afronden, Goedkeuren, Bevestigen, Vaststellen, Afsluiten, Tekenen, Accorderen
Maken: Maken, Bouwen, Ontwerpen, Uitvoeren, Testen, Repareren, Verbeteren, Voorbereiden, Opzetten, Configureren

### Bestemming:
- "actie" = concrete volgende actie voor jou
- "kalender" = iets wat je moet bijwonen/aanwezig zijn (vergadering, afspraak, evenement)
- "project" = meerdere acties nodig voor dit resultaat
- "wachten" = wacht op reactie van iemand anders
- "ooit" = mogelijk interessant, geen concrete deadline
- "weggooien" = geen actie nodig

## ACTIES OM TE VERBETEREN:
${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

### Contexten (kies het meest passende):
- "@school" = op school, met leerlingen of collega's
- "@computer" = achter de computer
- "@telefoon" = via telefoon of app
- "@overleg" = tijdens een vergadering of gesprek
- "@thuis" = thuis

### Energie:
- "laag" = weinig concentratie nodig (e-mail lezen, printen)
- "middel" = normale concentratie
- "hoog" = veel concentratie nodig (nakijken, beoordelen, schrijven)

## OUTPUT
Geef ALLEEN een JSON array terug met exact ${actions.length} objecten (in dezelfde volgorde):
[
  {
    "origineel": "de originele actie",
    "verbeterd": "Concreet werkwoord + object + context",
    "werkwoord": "het gebruikte werkwoord",
    "bestemming": "actie | kalender | project | wachten | ooit | weggooien",
    "uitleg": "Korte uitleg van de verbetering (max 1 zin)",
    "score": 1,
    "context": "@school | @computer | @telefoon | @overleg | @thuis | null",
    "energie": "laag | middel | hoog | null",
    "tijd_minuten": null
  }
]`;

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 3000,
            messages: [{ role: 'user', content: prompt }]
        });

        const responseText = message.content[0].text.trim();
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            return actions.map(a => ({ origineel: a, verbeterd: a, werkwoord: '', bestemming: 'actie', uitleg: '', score: 3 }));
        }
        const results = JSON.parse(jsonMatch[0]);
        return results;
    } catch (error) {
        console.error('Error improving actions with GTD:', error);
        return actions.map(a => ({ origineel: a, verbeterd: a, werkwoord: '', bestemming: 'actie', uitleg: '', score: 3 }));
    }
}

/**
 * Detect if email needs a reply + generate relevant questions
 */
async function detectNeedsReply(emailData) {
    try {
        const prompt = `Analyseer deze email en bepaal of een antwoord vereist is.

EMAIL VAN: ${emailData.from || 'onbekend'}
ONDERWERP: ${emailData.subject || '(geen onderwerp)'}
EMAIL TEKST:
${(emailData.body || '').substring(0, 2000)}

Geef ALLEEN JSON terug:
{
  "needsReply": true of false,
  "displaySubject": "Beknopt Nederlands onderwerp (max 6 woorden) als het origineel leeg/generiek is, anders null",
  "customQuestions": [
    {
      "id": "cq1",
      "question": "Specifieke vraag voor deze mail",
      "type": "choice",
      "options": ["optie1", "optie2", "optie3"]
    }
  ]
}

needsReply=true: directe vraag gesteld, verzoek om bevestiging/actie, uitnodiging.
needsReply=false: nieuwsbrief, automatisch bericht, eenzijdige info, spam, factuur.

Bedenk 1-3 SPECIFIEKE vragen voor DEZE mail (niet over doel of toon, die staan al vast).
Gebruik type "choice" voor vragen met duidelijke opties, anders type "text".`;

        const message = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 800,
            messages: [{ role: 'user', content: prompt }]
        });

        const text = message.content[0].text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return { needsReply: false, displaySubject: null, customQuestions: [] };

        const result = JSON.parse(jsonMatch[0]);
        return {
            needsReply:      result.needsReply      || false,
            displaySubject:  result.displaySubject  || null,
            customQuestions: result.customQuestions || [],
        };
    } catch (error) {
        console.error('Error detecting reply need:', error);
        return { needsReply: false, displaySubject: null, customQuestions: [] };
    }
}

/**
 * Generate email reply based on user answers
 */
async function generateReply(originalEmail, answers) {
    try {
        const doel            = answers.doel            || 'afhandelen';
        const toon            = answers.toon            || 'professioneel';
        const specifiekePunten = answers.specifieke_punten || '';
        const customAnswers   = answers.custom          || {};

        const customLines = Object.entries(customAnswers)
            .filter(([, v]) => v)
            .map(([q, a]) => `- ${q}: ${a}`)
            .join('\n');

        const prompt = `Je bent een wiskunde docent op vmbo TL niveau in Nederland.

ORIGINELE EMAIL:
Van: ${originalEmail.from || 'onbekend'}
Onderwerp: ${originalEmail.subject || '(geen onderwerp)'}

${originalEmail.body || ''}

---

Schrijf een antwoord op bovenstaande email met de volgende parameters:
- DOEL: ${doel}
- TOON: ${toon}
${specifiekePunten ? `- SPECIFIEKE PUNTEN DIE ERIN MOETEN: ${specifiekePunten}` : ''}
${customLines}

REGELS:
- Schrijf ALLEEN de emailtekst, geen headers of "Onderwerp:"
- Gebruik correct Nederlands
- Eindig met een passende groet
- Wees bondig maar volledig`;

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }]
        });

        return message.content[0].text.trim();

    } catch (error) {
        console.error('Error generating reply:', error);
        throw error;
    }
}

/**
 * Complete mail analysis (all-in-one)
 */
async function analyzeEmail(emailData, sourceType = 'email') {
    try {
        console.log('🤖 Analyzing email with Claude...');

        const images = emailData.images || [];

        const [tasks, category, priority, replyInfo] = await Promise.all([
            extractTasks(emailData.body, emailData.subject, emailData.from, sourceType, images),
            detectCategory(emailData.body, emailData.subject, emailData.from),
            detectPriority(emailData.body, emailData.subject),
            sourceType === 'email' ? detectNeedsReply(emailData) : Promise.resolve({ needsReply: false, displaySubject: null, customQuestions: [] })
        ]);

        if (tasks.length > 0) {
            const gtdResults = await improveActionsGTD(tasks.map(t => t.title));
            tasks.forEach((task, i) => {
                if (gtdResults[i]) {
                    task.gtd = gtdResults[i];
                    task.bestemming = gtdResults[i].bestemming || 'actie';
                    task.context    = gtdResults[i].context    || null;
                    task.energie    = gtdResults[i].energie    || null;
                    task.tijd_minuten = gtdResults[i].tijd_minuten || null;
                }
            });
        }

        return {
            tasks,
            category,
            priority,
            needsReply:      replyInfo.needsReply,
            displaySubject:  replyInfo.displaySubject,
            customQuestions: replyInfo.customQuestions,
        };

    } catch (error) {
        console.error('Error analyzing email:', error);
        return {
            tasks: [],
            category: 'werk',
            priority: 'mid',
            needsReply: false,
            displaySubject: null,
            customQuestions: [],
        };
    }
}

module.exports = {
    extractTasks,
    detectCategory,
    detectPriority,
    improveActionsGTD,
    detectNeedsReply,
    generateReply,
    analyzeEmail
};
