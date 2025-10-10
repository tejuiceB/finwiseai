# FinWise Frontend

Client-first Next.js app for uploading CSV transactions, rendering charts, and asking Gemini directly (no ADK required for the frontend path).

## Run (Windows cmd)

```bat
cd finwise-frontend
npm run dev
```

Then open <http://localhost:3000> and upload `public/sample-transactions.csv` or your own CSV.

By default, the page POSTs to a local Next.js API route `/api/ask` which calls Google Gemini directly using the key in `.env.local`.

## Environment

Create `finwise-frontend/.env.local` and set:

```bash
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-pro
```

Note: A legacy proxy to a local ADK agent can still be used via `app/api/agent`, controlled by:

```bash
ADK_UPSTREAM_URL=http://127.0.0.1:8001
ADK_RUN_PATH=/run
```

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, install dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file. The main API route for Gemini is `app/api/ask/route.ts`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
