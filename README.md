# FinWise AI — Local MVP (No DB)

Local/dev-only MVP with a Python Agent (ADK) and a Next.js frontend. No persistence: all data is sent in-memory from the browser to the local agent.

## Contents

- `finwise_agent/` — Python agent with tools and `root_agent`
- `finwise-frontend/` — Next.js app (created later)

## Prereqs

- Python 3.9+
- Node.js 18+
- Windows: Command Prompt or PowerShell

## 1) Python venv and ADK

```bat
python -m venv .venv
.venv\Scripts\activate
pip install google-adk
```

## Local Dev – Agent (ADK)

This follows the official ADK "Build a multi-tool agent" quickstart, adapted to the FinWise agent.

### 1) Create & Activate a Virtual Environment (Windows)

Open a PowerShell terminal in the repo root:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

Upgrade pip and install the ADK:

```powershell
python -m pip install --upgrade pip
pip install google-adk
```

### 2) Configure Model Auth (choose ONE)

Edit `finwise_agent/.env` and set either:

- Google AI Studio:
  - Set `GOOGLE_API_KEY=your_gemini_api_key`
- Vertex AI (GCP):
  - Uncomment and set `GOOGLE_GENAI_USE_VERTEXAI=TRUE`
  - Set `GOOGLE_CLOUD_PROJECT=your-project-id`
  - Set `GOOGLE_CLOUD_LOCATION=us-central1` (or your region)
  - Then run once in a terminal: `gcloud auth application-default login`

### 3) Launch the Dev UI

From the repo root:

```bash
adk web --no-reload
```

Open the provided URL (e.g., <http://127.0.0.1:8000>). In the top-left dropdown, select `finwise_agent`.

### 4) Try it with sample data

Ask in chat:

- "Analyze the file at `finwise_agent/sample-transactions.csv`."
- "Suggest a budget to save 10000 using `finwise_agent/sample-transactions.csv`."
- Or paste CSV text and say "Analyze this CSV".

Built-in tools:

- `load_transactions(file_path=None, csv_text=None)`
- `analyze_file(file_path=None, csv_text=None)`
- `suggest_budget_from_file(file_path=None, target_savings=0.0, csv_text=None)`
- `forecast_savings_from_file(file_path=None, months=3, csv_text=None)`

### Troubleshooting

- If the UI shows credential errors like "Missing key inputs argument!", ensure `.env` is filled and restart `adk web --no-reload`.
- If the selected model isn’t available in your region/account, change `model=` in `finwise_agent/agent.py` to a supported one (e.g., `gemini-1.5-flash`).
- Windows tip: prefer `--no-reload` to avoid asyncio transport errors.

## 2) Configure provider env

Edit `finwise_agent/.env` with your provider keys.

- Vertex/Gemini: run `gcloud auth application-default login` beforehand (in a separate terminal) or set `GOOGLE_APPLICATION_CREDENTIALS`.
- OpenAI: set `OPENAI_API_KEY`.

## 3) Run the Agent

From the repo root (the folder containing `finwise_agent/`):

```bat
adk web
```

Open the printed URL and pick `finwise_agent`. For frontend integration, you can run an API server if available:

```bat
adk api_server --port 8001 --allow-cors
```

## 4) Frontend scaffolding (to be created)

From repo root:

```bash
npx create-next-app@latest finwise-frontend --use-npm --eslint
cd finwise-frontend
npm install axios papaparse recharts
npm run dev
```

Then implement a page that parses CSV and POSTs to `<http://localhost:8001/agent/finwise_agent/run>`.

## Additional Notes

- Nothing is stored. Keep secrets in `.env` on your machine.
- If CORS blocks browser → agent calls, add a small Next.js API proxy or start the ADK server with CORS enabled.
