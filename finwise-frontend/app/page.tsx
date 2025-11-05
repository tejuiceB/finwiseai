/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import styles from "./page.module.css";
import { analyzeTransactions, groupByMonth, forecastSavings, computeAlerts, buildSummaryContext, suggestBudget, generateGoalPlan } from "@/lib/analysis";
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
  const [activeTab, setActiveTab] = useState<"overview" | "budget" | "goals">("overview");
  const [goalAmount, setGoalAmount] = useState<string>("");
  const [goalMonths, setGoalMonths] = useState<string>("6");
  const [targetSavings, setTargetSavings] = useState<string>("");
  

  const previewRows = useMemo(() => transactions.slice(0, 10), [transactions]);
  const summary = useMemo(() => analyzeTransactions(transactions), [transactions]);
  const mood = useMemo(() => {
    if (!transactions.length) return "😃 Ready";
    const savingsRate = summary.incomeTotal > 0 ? ((summary.incomeTotal - summary.expenseTotal) / summary.incomeTotal * 100) : 0;
    if (summary.expenseTotal > summary.incomeTotal) return "⚠️ Alert";
    if (savingsRate > 20) return "🎉 Excellent";
    if (savingsRate > 10) return "💰 Good";
    if (summary.netTotal > 0) return "✅ Stable";
    return "😃 Neutral";
  }, [transactions, summary]);
  const riskStatus = useMemo(() => {
    if (!transactions.length) return "🟢 Ready";
    if (summary.expenseTotal > summary.incomeTotal) return "🔴 High";
    const savingsRate = summary.incomeTotal > 0 ? ((summary.incomeTotal - summary.expenseTotal) / summary.incomeTotal * 100) : 0;
    if (savingsRate > 15) return "🟢 Low";
    if (savingsRate > 5) return "🟡 Medium";
    return "🟠 Watch";
  }, [transactions, summary]);

  const budgetPlan = useMemo(() => {
    const target = parseFloat(targetSavings) || 0;
    if (target <= 0 || !transactions.length) return null;
    return suggestBudget(transactions, target);
  }, [targetSavings, transactions]);

  const goalPlan = useMemo(() => {
    const amount = parseFloat(goalAmount) || 0;
    const months = parseInt(goalMonths) || 0;
    if (amount <= 0 || months <= 0 || !transactions.length) return null;
    return generateGoalPlan(transactions, amount, months);
  }, [goalAmount, goalMonths, transactions]);

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
    <div className={`${styles.container} ${light ? styles.lightMode : styles.darkMode}`}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandTitle}>FinWise AI — Your Financial Coach</span>
          <span className={styles.brandSub}>Understand. Plan. Grow smarter with AI.</span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.toggleBtn} onClick={() => setLight((v) => !v)}>
            {light ? '🌙 Dark' : '☀️ Light'}
          </button>
          <span className={styles.mood}>{mood}</span>
        </div>
      </header>

      <div className={styles.splitMain}>
        <div className={styles.leftPane}>
          <div className={styles.section}>
            <div className={styles.dropZone} onDrop={handleDrop} onDragOver={handleDragOver}>
              📂 Drag & drop your CSV file here
              <div className={styles.dropZoneHint}>
                or click below to browse
              </div>
            </div>
            <label htmlFor="csvFile" className={styles.label}>📊 Upload Financial Data</label>
            <input id="csvFile" name="csvFile" type="file" accept=".csv" onChange={handleFile} className={styles.fileInput} />
          </div>
          <div className={styles.section}>
            <h2 className={styles.subtitle}>💬 AI Financial Coach</h2>
            <div className={styles.hint}>Ask questions, get insights, and receive personalized financial advice</div>
            <label className={styles.row}>
              <input
                type="checkbox"
                checked={reuseSession}
                onChange={(e) => setReuseSession(e.target.checked)}
              />
              Keep conversation memory
            </label>
            <div className={styles.chat}>
              {messages.length === 0 && (
                <div className={styles.muted}>
                  💬 Welcome to FinWise AI! Ask me anything about your finances:
                  <ul>
                    <li>What are my top spending categories?</li>
                    <li>How can I save more money?</li>
                    <li>Analyze my spending trends</li>
                    <li>Give me budget recommendations</li>
                  </ul>
                </div>
              )}
              {messages.map((m, i) => (
                <div className={styles.bubbleRow} key={i}>
                  <div className={m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant}>{m.text}</div>
                </div>
              ))}
              {loading && <div className={styles.typing}>🤖 AI is analyzing your data…</div>}
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
              <div className={styles.tabs}>
                <button 
                  className={`${styles.tab} ${activeTab === "overview" ? styles.tabActive : ""}`}
                  onClick={() => setActiveTab("overview")}
                >
                  📊 Overview
                </button>
                <button 
                  className={`${styles.tab} ${activeTab === "budget" ? styles.tabActive : ""}`}
                  onClick={() => setActiveTab("budget")}
                >
                  💰 Budget Planner
                </button>
                <button 
                  className={`${styles.tab} ${activeTab === "goals" ? styles.tabActive : ""}`}
                  onClick={() => setActiveTab("goals")}
                >
                  🎯 Goal Planner
                </button>
              </div>

              {activeTab === "overview" && (
                <>
                  <div className={styles.section}>
                    <h2 className={styles.subtitle}>📊 Financial Overview</h2>
                    <div className={styles.cards}>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>💵 Total Income</div>
                    <div className={styles.cardValue}>${summary.incomeTotal.toFixed(2)}</div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>💸 Total Expense</div>
                    <div className={styles.cardValue}>${summary.expenseTotal.toFixed(2)}</div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>💰 Net Savings</div>
                    <div className={styles.cardValue}>${summary.netTotal.toFixed(2)}</div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>📈 Savings Rate</div>
                    <div className={styles.cardValue}>
                      {summary.incomeTotal > 0 
                        ? `${((summary.incomeTotal - summary.expenseTotal) / summary.incomeTotal * 100).toFixed(1)}%`
                        : '0%'}
                    </div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>⚡ Risk Status</div>
                    <div className={styles.cardValue}>{riskStatus}</div>
                  </div>
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>📊 Transactions</div>
                    <div className={styles.cardValue}>{summary.totalTxns}</div>
                  </div>
                </div>
              </div>
              <div className={styles.section}>
                <h2 className={styles.subtitle}>🔍 Transaction Preview</h2>
                <div className={styles.hint}>Showing first {previewRows.length} of {transactions.length} transactions</div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>📅 Date</th>
                        <th>📝 Description</th>
                        <th>🏷️ Category</th>
                        <th>📊 Type</th>
                        <th className={styles.right}>💵 Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r, i) => (
                        <tr key={i}>
                          <td>{r.date || '-'}</td>
                          <td>{r.description || '-'}</td>
                          <td>{r.category || '-'}</td>
                          <td>{r.type || (r.amount >= 0 ? '💰 income' : '💸 expense')}</td>
                          <td className={`${styles.right} ${r.amount >= 0 ? styles.amountPositive : styles.amountNegative}`}>
                            ${Math.abs(r.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
                </>
              )}

              {activeTab === "budget" && (
                <div className={styles.section}>
                  <h2 className={styles.subtitle}>💰 Smart Budget Planner</h2>
                  <div className={styles.hint}>Get personalized budget recommendations based on your spending patterns</div>
                  
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Target Monthly Savings ($)</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={targetSavings}
                      onChange={(e) => setTargetSavings(e.target.value)}
                      placeholder="e.g., 1000"
                    />
                  </div>
                  
                  <button 
                    className={styles.button}
                    onClick={() => {
                      const target = parseFloat(targetSavings) || 0;
                      if (target > 0) {
                        const budgetPlan = suggestBudget(transactions, target);
                        const msg = `Based on your spending, you need to save $${budgetPlan.neededToSave.toFixed(2)} more to reach your target. Here are my suggestions:\n\n${budgetPlan.suggestions.map(s => `• Reduce ${s.category} by $${s.suggestedCut.toFixed(2)} (from $${s.currentSpend.toFixed(2)} to $${s.newEstimatedSpend.toFixed(2)})`).join('\n')}`;
                        setMessages(prev => [...prev, { role: "user", text: `Create a budget plan to save $${target}/month` }, { role: "assistant", text: msg }]);
                      }
                    }}
                  >
                    Generate Budget Plan
                  </button>

                  {budgetPlan && (
                    <div className={styles.mt20}>
                      <div className={styles.goalMetric}>
                        <div className={styles.goalMetricLabel}>Current Savings</div>
                        <div className={styles.goalMetricValue}>${budgetPlan.currentSavings.toFixed(2)}</div>
                      </div>
                      <div className={styles.goalMetric}>
                        <div className={styles.goalMetricLabel}>Need to Save</div>
                        <div className={styles.goalMetricValue}>${budgetPlan.neededToSave.toFixed(2)}</div>
                      </div>
                      
                      {budgetPlan.suggestions.length > 0 && (
                        <>
                          <h3 className={`${styles.subtitle} ${styles.mt20}`}>💡 Budget Recommendations</h3>
                          {budgetPlan.suggestions.map((s, i) => (
                            <div key={i} className={styles.suggestionCard}>
                              <div className={styles.suggestionHeader}>
                                <span>{s.category}</span>
                                <span className={styles.cutAmount}>-${s.suggestedCut.toFixed(2)}</span>
                              </div>
                              <div className={styles.suggestionDetails}>
                                Current: ${s.currentSpend.toFixed(2)} → Target: ${s.newEstimatedSpend.toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "goals" && (
                <div className={styles.section}>
                  <h2 className={styles.subtitle}>🎯 Financial Goal Planner</h2>
                  <div className={styles.hint}>Plan and achieve your financial goals with personalized strategies</div>
                  
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Goal Amount ($)</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={goalAmount}
                      onChange={(e) => setGoalAmount(e.target.value)}
                      placeholder="e.g., 10000"
                    />
                  </div>
                  
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Timeframe (Months)</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={goalMonths}
                      onChange={(e) => setGoalMonths(e.target.value)}
                      placeholder="e.g., 12"
                    />
                  </div>
                  
                  <button 
                    className={styles.button}
                    onClick={() => {
                      const amount = parseFloat(goalAmount) || 0;
                      const months = parseInt(goalMonths) || 0;
                      if (amount > 0 && months > 0) {
                        const goalPlan = generateGoalPlan(transactions, amount, months);
                        const msg = `To save $${amount} in ${months} months:\n\n💵 Monthly Target: $${goalPlan.monthlyTarget.toFixed(2)}\n💰 Weekly Target: $${goalPlan.weeklyTarget.toFixed(2)}\n\n📊 Top Category Adjustments:\n${goalPlan.tips.map(t => `• ${t.category}: Reduce by $${t.suggestedMonthlyCut.toFixed(2)}/month (currently $${t.currentMonthly.toFixed(2)})`).join('\n')}`;
                        setMessages(prev => [...prev, { role: "user", text: `Help me save $${amount} in ${months} months` }, { role: "assistant", text: msg }]);
                      }
                    }}
                  >
                    Create Goal Plan
                  </button>

                  {goalPlan && (
                    <div className={styles.mt20}>
                      <div className={styles.cards}>
                        <div className={styles.goalMetric}>
                          <div className={styles.goalMetricLabel}>💵 Monthly Target</div>
                          <div className={styles.goalMetricValue}>${goalPlan.monthlyTarget.toFixed(2)}</div>
                        </div>
                        <div className={styles.goalMetric}>
                          <div className={styles.goalMetricLabel}>💰 Weekly Target</div>
                          <div className={styles.goalMetricValue}>${goalPlan.weeklyTarget.toFixed(2)}</div>
                        </div>
                      </div>
                      
                      {goalPlan.tips.length > 0 && (
                        <>
                          <h3 className={`${styles.subtitle} ${styles.mt20}`}>🎯 Action Plan</h3>
                          {goalPlan.tips.map((t, i) => (
                            <div key={i} className={styles.suggestionCard}>
                              <div className={styles.suggestionHeader}>
                                <span>{t.category}</span>
                                <span className={styles.reduceAmount}>-${t.suggestedMonthlyCut.toFixed(2)}/mo</span>
                              </div>
                              <div className={styles.suggestionDetails}>
                                Current Monthly: ${t.currentMonthly.toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
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
            <h2 className={styles.subtitle}>📈 Spending by Category</h2>
            <div className={styles.hint}>Visual breakdown of your spending across different categories</div>
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
            <h2 className={styles.subtitle}>📊 Monthly Trends</h2>
            <div className={styles.hint}>Track your income, expenses, and net savings over time</div>
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
            <h2 className={styles.subtitle}>🔮 Savings Forecast (Next 6 Months)</h2>
            <div className={styles.hint}>📊 Average monthly net baseline: ${avgMonthlyNet.toFixed(2)}</div>
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
            <h2 className={styles.subtitle}>🔔 Smart Insights & Alerts</h2>
            <div className={styles.hint}>AI-powered recommendations to improve your financial health</div>
            <ul>
              {alerts.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        );
      }, [transactions])}

      <footer className={styles.footerBar}>
        <button className={styles.footerBtn} onClick={() => setMessages([])}>🗑️ Clear Chat</button>
        <button className={styles.footerBtn} onClick={() => { setMessages([]); setSessionId(`web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`); }}>🔄 Reset Session</button>
        <label className={styles.footerBtn} htmlFor="csvFile">📤 Upload New Data</label>
        <button className={styles.footerBtn} onClick={() => alert('Thank you for using FinWise AI! Your feedback helps us improve. 🌟')}>⭐ Give Feedback</button>
        {transactions.length > 0 && (
          <button className={styles.footerBtn} onClick={() => {
            const csvContent = [
              ['Date', 'Description', 'Category', 'Type', 'Amount'].join(','),
              ...transactions.map(t => [
                t.date || '',
                `"${(t.description || '').replace(/"/g, '""')}"`,
                t.category || '',
                t.type || (t.amount >= 0 ? 'income' : 'expense'),
                t.amount
              ].join(','))
            ].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `finwise-export-${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}>📥 Export Data</button>
        )}
      </footer>
    </div>
  );
}
