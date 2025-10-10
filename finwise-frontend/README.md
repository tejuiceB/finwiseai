# FinWise Frontend

Next.js app with a WhatsApp-style chat and a right-side insights panel. Upload a CSV to get smart summaries, charts, forecasts, and proactive alerts. The app calls Google Gemini directly via a local API route — no backend required.

## Quick start (Windows cmd)

```bat
cd finwise-frontend
npm install
npm run dev
```

Open http://localhost:3000 and drop a CSV. A detailed sample is included at `public/sample-transactions-detailed.csv`.

## Environment

Create `.env.local` in this folder:

```
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-pro
```

The page posts to `/api/ask` which uses `@google/generative-ai` with your key.

Legacy (optional): an ADK proxy exists at `/api/agent` if you want to point to a local ADK server via:

```
ADK_UPSTREAM_URL=http://127.0.0.1:8001
ADK_RUN_PATH=/run
```

## What’s inside

- `app/page.tsx` — Chat UI + split dashboard (cards, table, charts, alerts)
- `app/page.module.css` — Styles for the professional layout
- `app/api/ask/route.ts` — Gemini handler using your `GOOGLE_API_KEY`
- `lib/analysis.ts` — CSV parsing, categorization, summaries, MoM groups, savings forecast, alerts
- `public/sample-transactions-detailed.csv` — Realistic multi‑month sample

## CSV format

Supported columns (flexible):

- `date` — YYYY-MM-DD preferred
- `amount` — positive = income, negative = expense
- `description` — free text used for auto-categorization
- `category` — optional; auto-inferred if missing
- `type` — optional; if `income`, treated as income even if amount is positive already

## Notes

- No data is stored; everything stays in your browser/session.
- Keep your `GOOGLE_API_KEY` private. `.env.local` is git‑ignored.
