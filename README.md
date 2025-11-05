# FinWise AI

Personal finance insights with a friendly chat UI, clear charts, and proactive alerts.

This repo contains:

- `finwise-frontend/` — Next.js app that talks directly to Google Gemini via a local API route.
- `finwise_agent/` — Optional Python agent (ADK quickstart) with tools and in-process memory.

No database. Everything runs locally. The frontend does not depend on the Python agent.

## Features

- WhatsApp-style chat on the left, insights dashboard on the right
- Drag-and-drop CSV upload and preview table
- Smart summaries: total income, total expense, net savings, average amount, risk/mood
- Charts: category breakdown, monthly net trend, savings forecast
- Proactive alerts for overspending, net drop, and category spikes
- Light/dark mode toggle and sticky header/footer

## Repository structure

```
.
├─ finwise-frontend/        # Next.js app (Gemini direct)
├─ finwise_agent/           # Python ADK agent (optional)
├─ .gitignore
└─ README.md
```

## Prerequisites

- Windows with Command Prompt (cmd) or PowerShell
- Node.js 18+ (for the frontend)
- Python 3.9+ (only if you want to run the optional agent)

---

## Quick start: Frontend

1) Install dependencies

```bat
cd finwise-frontend
npm install
```

2) Add your Gemini key

Create `finwise-frontend/.env.local` with:

```
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-pro
```

3) Run the dev server

```bat
npm run dev
```

Open http://localhost:3000, drop a CSV, and start chatting. A detailed sample is included at `finwise-frontend/public/sample-transactions-detailed.csv`.

Frontend architecture:

- UI: `app/page.tsx` and styles in `app/page.module.css`
- Analytics: `lib/analysis.ts` (parsing, categorization, summaries, forecasts, alerts)
- AI: `app/api/ask/route.ts` using `@google/generative-ai` with your `GOOGLE_API_KEY`

### CSV format

Headers are flexible; these are recognized:

- `date` (YYYY-MM-DD preferred)
- `amount` (positive = income, negative = expense)
- `description` (free text, used for auto-categorization)
- `category` (optional; if missing, inferred)
- `type` (optional; if set to `income` it’s treated as income)

If `category` is missing, simple keyword rules infer categories like Transport, Dining, Rent, etc.

---

##  finwise Python Agent

The frontend does not require this. Run it if you want to explore the multi-tool agent and Dev UI.

1) Create and activate venv

```bat
python -m venv .venv
.venv\Scripts\activate
```

2) Install ADK

```bat
pip install google-adk
```

3) Configure model auth (choose one) in `finwise_agent/.env`

- Google AI Studio: set `GOOGLE_API_KEY`
- Vertex AI: set `GOOGLE_GENAI_USE_VERTEXAI=TRUE`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, then run:

```bat
gcloud auth application-default login
```

4) Launch Dev UI

```bat
adk web --no-reload
```

Open the printed URL and select `finwise_agent`. Tools include analysis, budgeting, forecasting, CSV ingestion, local notes memory, and goal planning.

---

## Security

- Keep your API keys in `.env.local` (ignored by Git). Never commit secrets.
- Data stays on your machine. There is no database or cloud storage.

## Troubleshooting

- 404 when browsing a folder on GitHub can happen if it was committed as a submodule. The repo is already fixed; commit folders as normal.
- If the frontend 500s on `/api/ask`, ensure `GOOGLE_API_KEY` is set and valid.
- If ADK shows credential errors, verify `finwise_agent/.env` and your auth method, then restart with `adk web --no-reload`.

## License

Private MVP. All rights reserved.
