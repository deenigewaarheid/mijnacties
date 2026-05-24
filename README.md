# Mail Analyzer

Webapp voor een Nederlandse wiskunde docent om mails te analyseren en taken te beheren.

## Wat het doet

- Mail plakken of PDF/Word uploaden → Claude AI haalt taken eruit
- Taken beheren: Alle taken / Vandaag / Deze week / Voltooid
- Gmail koppelen voor automatisch ontvangen van mails

## Tech stack

- **Backend**: Node.js + Express + PostgreSQL + Claude API + Gmail API
- **Frontend**: React + Vite + Tailwind CSS

## Starten (development)

```bash
# Beide servers tegelijk
npm run dev

# Of apart:
npm run server   # backend op http://localhost:3001
npm run client   # frontend op http://localhost:3000
```

## Vereisten

- Node.js 18+
- PostgreSQL — database `mail_analyzer` aanmaken via `server/database/schema.sql`
- `.env` in `server/` invullen (zie `server/.env.example`)

## Inloggen

Maak een account aan via de registreer-knop op de loginpagina.
