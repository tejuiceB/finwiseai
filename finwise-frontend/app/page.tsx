/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import styles from "./page.module.css";
import { analyzeTransactions, groupByMonth, forecastSavings, computeAlerts, buildSummaryContext } from "@/lib/analysis";
import axios from "axios";
import type { Txn as FinTxn } from "@/lib/analysis";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line, PieChart, Pie, Cell } from "recharts";

export default function Home() {
  const [transactions, setTransactions] = useState<FinTxn[]>([]);
  const [prompt, setPrompt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [reuseSession, setReuseSession] = useState(true);
  const [sessionId, setSessionId] = useState<string>(() => `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [light, setLight] = useState(false);
  

  const previewRows = useMemo(() => transactions.slice(0, 5), [transactions]);
  const summary = useMemo(() => analyzeTransactions(transactions), [transactions]);
  const mood = useMemo(() => {
    if (!transactions.length) return "😃 Neutral";
    if (summary.expenseTotal > summary.incomeTotal) return "⚠️ Overspending";
    if (summary.netTotal > 0) return "💰 On Track";
    return "😃 Neutral";
  }, [transactions, summary]);
  const riskStatus = summary.expenseTotal > summary.incomeTotal ? "🟠 High" : (summary.netTotal > 0 ? "🟢 Low" : "🟡 Moderate");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
  const txns: FinTxn[] = (results.data as any[]).map((r) => ({
          date: r.date || r.Date,
          amount: parseFloat(r.amount || r.Amount || r.AMOUNT || "0"),
          description: r.description || r.Description || "",
          category: r.category || r.Category || undefined,
          type: (r.type || r.Type || "").toLowerCase() === "income" ? "income" : undefined,
        }));
        setTransactions(txns);
      },
      error: (err) => setError((err as any)?.message || "Parse failed"),
    });
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const ev = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleFile(ev);
  }
  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  async function sendMessage() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = "/api/ask";
      const sid = reuseSession ? sessionId : `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (!reuseSession) setSessionId(sid);
      const context = buildSummaryContext(transactions);
      const res = await axios.post(endpoint, { prompt, transactions: transactions.slice(0, 200), context, messages }, { timeout: 60000 });
      const answer = String(res.data?.text || "");
      setMessages((prev) => [...prev, { role: "user", text: prompt.trim() }, { role: "assistant", text: answer }]);
      setPrompt("");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${styles.container} ${light ? styles.pageRootLight : ''}`}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandTitle}>FinWise AI — Your Financial Coach</span>
          <span className={styles.brandSub}>Understand. Plan. Grow smarter with AI.</span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.toggleBtn} onClick={() => setLight((v) => !v)}>{light ? 'Dark' : 'Light'} mode</button>
          <span className={styles.mood}>{mood}</span>
        </div>
      </header>

      <div className={styles.splitMain}>
        <div className={styles.leftPane}>
          <div className={styles.section}>
            <div className={styles.dropZone} onDrop={handleDrop} onDragOver={handleDragOver}>
              Drag & drop CSV here or use the input below
            </div>
            <label htmlFor="csvFile" className={styles.label}>Upload CSV</label>
            <input id="csvFile" name="csvFile" type="file" accept=".csv" onChange={handleFile} />
          </div>
          <div className={styles.section}>
            <label className={styles.row}>
              <input
                type="checkbox"
                checked={reuseSession}
                onChange={(e) => setReuseSession(e.target.checked)}
              />
              Keep conversation memory (session: {sessionId})
            </label>
            <div className={styles.chat}>
              {messages.length === 0 && <div className={styles.muted}>Start chatting with your financial coach…</div>}
              {messages.map((m, i) => (
                <div className={styles.bubbleRow} key={i}>
                  <div className={m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant}>{m.text}</div>
                </div>
              ))}
              {loading && <div className={styles.typing}>AI is analyzing your data…</div>}
            </div>
            <div className={styles.chatInputRow}>
              <input
                className={styles.chatInput}
                placeholder="Type a message, like WhatsApp…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
              />
              <button onClick={sendMessage} disabled={loading} className={styles.button}>{loading ? "Sending…" : "Send"}</button>
            </div>
          </div>
        </div>
        <div className={styles.rightPane}>
          {transactions.length > 0 && (
            <>
              <div className={styles.section}>
                <div className={styles.cards}>
                  <div className={styles.card}><div className={styles.cardLabel}>Total Income</div><div className={styles.cardValue}>{summary.incomeTotal.toFixed(2)}</div></div>
                  <div className={styles.card}><div className={styles.cardLabel}>Total Expense</div><div className={styles.cardValue}>{summary.expenseTotal.toFixed(2)}</div></div>
                  <div className={styles.card}><div className={styles.cardLabel}>Net Savings</div><div className={styles.cardValue}>{summary.netTotal.toFixed(2)}</div></div>
                  <div className={styles.card}><div className={styles.cardLabel}>Risk Status</div><div className={styles.cardValue}>{riskStatus}</div></div>
                </div>
              </div>
              <div className={styles.section}>
                <h2 className={styles.subtitle}>Preview</h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Type</th>
                        <th className={styles.right}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, i) => (
                        <tr key={i}>
                          <td>{r.date || '-'}</td>
                          <td>{r.description || '-'}</td>
                          <td>{r.category || '-'}</td>
                          <td>{r.type || (r.amount >= 0 ? 'income' : 'expense')}</td>
                          <td className={styles.right}>{r.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {error && <div className={styles.error}>Error: {error}</div>}

      

      {useMemo(() => {
        const byCategory = analyzeTransactions(transactions).byCategory as Record<string, number>;
        const entries = Object.entries(byCategory)
          .map(([name, value]) => ({ name, value: +Number(value).toFixed(2) }))
          .filter((d) => Math.abs(d.value) > 0.01);
        if (entries.length === 0) return null;
        return (
          <div className={styles.section}>
            <h2 className={styles.subtitle}>By Category</h2>
            <div className={styles.split}>
              <div className={styles.flexItem}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={entries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" name="Amount" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.flexItem}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={entries} dataKey="value" nameKey="name" outerRadius={100} label>
                      {entries.map((_, idx) => (
                        <Cell key={idx} fill={["#8884d8","#82ca9d","#ffc658","#ff8042","#8dd1e1","#a4de6c","#d0ed57"][idx % 7]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      }, [transactions])}
      {useMemo(() => {
        const m = groupByMonth(transactions);
        if (m.length === 0) return null;
        return (
          <div className={styles.section}>
            <h2 className={styles.subtitle}>Monthly Net</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={m}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#4caf50" />
                <Line type="monotone" dataKey="expense" stroke="#f44336" />
                <Line type="monotone" dataKey="net" stroke="#2196f3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      }, [transactions])}

      {useMemo(() => {
        const { forecast, avgMonthlyNet } = forecastSavings(transactions, 6);
        if (forecast.length === 0) return null;
        return (
          <div className={styles.section}>
            <h2 className={styles.subtitle}>Savings Forecast (next 6 months)</h2>
            <div className={styles.hint}>Avg monthly net baseline: {avgMonthlyNet.toFixed(2)}</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={forecast.map(f => ({ month: `M+${f.month}`, savings: f.estimatedSavings }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="savings" name="Estimated Savings" stroke="#673ab7" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      }, [transactions])}

      {useMemo(() => {
        const alerts = computeAlerts(transactions);
        if (!alerts.length) return null;
        return (
          <div className={styles.section}>
            <h2 className={styles.subtitle}>Proactive Alerts</h2>
            <ul>
              {alerts.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        );
      }, [transactions])}

      <footer className={styles.footerBar}>
        <button className={styles.footerBtn} onClick={() => setMessages([])}>Clear chat</button>
        <button className={styles.footerBtn} onClick={() => { setMessages([]); setSessionId(`web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`); }}>Reset session</button>
        <label className={styles.footerBtn} htmlFor="csvFile">Upload new data</label>
        <button className={styles.footerBtn} onClick={() => alert('Thanks for your feedback!')}>Feedback / Rate advice</button>
      </footer>
    </div>
  );
}
