import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
  const { prompt, transactions, context, messages } = await req.json();

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GOOGLE_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

  const modelId = process.env.GEMINI_MODEL || "gemini-2.5-pro";
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId });

    const system =
      "You are FinWise, a helpful financial assistant. You analyze user spending, explain category trends, and provide actionable budgeting tips.";

    const parts: Array<{ text: string }> = [];
    parts.push({ text: system });
    if (Array.isArray(messages) && messages.length) {
      type ChatMsg = { role: "user" | "assistant"; text: string };
      const safe: ChatMsg[] = messages
        .filter((m: unknown): m is ChatMsg => {
          if (typeof m !== "object" || m === null) return false;
          const obj = m as Record<string, unknown>;
          const textOk = typeof obj["text"] === "string" && (obj["text"] as string).length > 0;
          const roleOk = obj["role"] === "user" || obj["role"] === "assistant";
          return textOk && roleOk;
        })
        .slice(-12);
      const lines = safe
        .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.text}`)
        .join("\n");
      parts.push({ text: `Chat so far:\n${lines}` });
    }
    parts.push({ text: `User prompt: ${prompt || "Analyze my spending."}` });
    parts.push({ text: `Context JSON (analysis, byCategory, byMonth, forecast):\n${JSON.stringify(context || {}, null, 2)}` });
    parts.push({ text: `Raw transactions JSON (sample or full):\n${JSON.stringify(transactions || [], null, 2)}` });

    const result = await model.generateContent({ contents: [{ role: "user", parts }] });
    const out = result.response?.text?.() ?? "";
    return new Response(JSON.stringify({ text: out }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ask failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
