export type Txn = {
  date?: string;
  amount: number;
  description?: string;
  category?: string;
  type?: string;
};

export function parseAmount(v: unknown): number {
  const n = parseFloat(String((v as string | number | undefined) ?? "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function categorize(description?: string): string {
  const d = (description || "").toLowerCase();
  if (["uber", "ola", "taxi", "grab", "ride"].some((k) => d.includes(k))) return "Transport";
  if (["restaurant", "dine", "cafe", "pizza", "dominos", "swiggy"].some((k) => d.includes(k))) return "Dining";
  if (["salary", "pay", "invoice"].some((k) => d.includes(k))) return "Income";
  if (["rent", "house", "flat"].some((k) => d.includes(k))) return "Rent";
  return "Other";
}

export function analyzeTransactions(txns: Txn[]) {
  if (!txns || txns.length === 0) {
    return {
      totalTxns: 0,
      netTotal: 0,
      avgAmount: 0,
      incomeTotal: 0,
      expenseTotal: 0,
      byCategory: {} as Record<string, number>,
    };
  }
  const amounts = txns.map((t) => t.amount || 0);
  const netTotal = amounts.reduce((a, b) => a + b, 0);
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / (amounts.length || 1);
  const incomeTotal = txns.reduce((s, t) => s + ((t.type === "income" || t.amount > 0) ? t.amount : 0), 0);
  const expenseTotal = txns.reduce((s, t) => s + (t.amount < 0 ? -t.amount : 0), 0);

  const byCategory: Record<string, number> = {};
  for (const t of txns) {
    const cat = t.category || categorize(t.description);
    byCategory[cat] = (byCategory[cat] ?? 0) + (t.amount || 0);
  }

  return {
    totalTxns: txns.length,
    netTotal,
    avgAmount,
    incomeTotal,
    expenseTotal,
    byCategory,
  };
}

export function groupByMonth(txns: Txn[]) {
  const byMonth: Record<string, { income: number; expense: number; net: number }> = {};
  for (const t of txns) {
    const d = t.date ? new Date(t.date) : undefined;
    if (!d || isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = (byMonth[key] = byMonth[key] || { income: 0, expense: 0, net: 0 });
    if (t.amount >= 0) entry.income += t.amount; else entry.expense += -t.amount;
    entry.net += t.amount;
  }
  return Object.entries(byMonth)
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function forecastSavings(txns: Txn[], months = 3) {
  const net = txns.reduce((s, t) => s + (t.amount || 0), 0);
  // naive: assume 1 month present
  const avgMonthlyNet = net;
  const forecast = Array.from({ length: months }, (_, i) => ({
    month: i + 1,
    estimatedSavings: +(avgMonthlyNet * (i + 1)).toFixed(2),
  }));
  return { avgMonthlyNet, forecast };
}

export function buildSummaryContext(txns: Txn[]) {
  const summary = analyzeTransactions(txns);
  const monthly = groupByMonth(txns);
  const { forecast } = forecastSavings(txns, 3);
  const topSamples = txns.slice(0, 50);
  return {
    meta: {
      totalTxns: summary.totalTxns,
      netTotal: +summary.netTotal.toFixed(2),
      avgAmount: +summary.avgAmount.toFixed(2),
      incomeTotal: +summary.incomeTotal.toFixed(2),
      expenseTotal: +summary.expenseTotal.toFixed(2),
    },
    byCategory: Object.fromEntries(
      Object.entries(summary.byCategory).map(([k, v]) => [k, +v.toFixed(2)])
    ),
    byMonth: monthly,
    forecast,
    samples: topSamples,
    guidance: "Offer practical, data-grounded suggestions. If unsure, ask a clarifying question.",
  };
}

export function computeAlerts(txns: Txn[]): string[] {
  const alerts: string[] = [];
  if (!txns || txns.length === 0) return ["No transactions loaded."];

  const summary = analyzeTransactions(txns);
  if (summary.expenseTotal > summary.incomeTotal) {
    alerts.push("You spent more than you earned overall. Consider reducing top categories by 5-10%.");
  }

  const monthly = groupByMonth(txns);
  if (monthly.length >= 2) {
    const last = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2];
    const deltaNet = last.net - prev.net;
    const dropPct = prev.net !== 0 ? (deltaNet / Math.abs(prev.net)) * 100 : 0;
    if (prev.net > 0 && last.net < prev.net * 0.8) {
      alerts.push(`Net savings dropped by ${Math.abs(dropPct).toFixed(0)}% vs ${prev.month}. Review discretionary spend.`);
    }
  }

  // Category spikes (very simple: compare sums in last vs prev month)
  const byMonthCat: Record<string, Record<string, number>> = {};
  for (const t of txns) {
    const d = t.date ? new Date(t.date) : undefined;
    if (!d || isNaN(d.getTime())) continue;
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const cat = t.category || categorize(t.description);
    byMonthCat[m] = byMonthCat[m] || {};
    byMonthCat[m][cat] = (byMonthCat[m][cat] ?? 0) + (t.amount || 0);
  }
  const months = Object.keys(byMonthCat).sort();
  if (months.length >= 2) {
    const a = months[months.length - 2];
    const b = months[months.length - 1];
    const cats = new Set([...Object.keys(byMonthCat[a] || {}), ...Object.keys(byMonthCat[b] || {})]);
    for (const c of cats) {
      const va = Math.abs(byMonthCat[a]?.[c] ?? 0);
      const vb = Math.abs(byMonthCat[b]?.[c] ?? 0);
      if (vb > va * 1.3 && vb > 1000) {
        alerts.push(`Spike in ${c}: up ${((vb - va) / (va || 1) * 100).toFixed(0)}% month-over-month.`);
      }
    }
  }

  return alerts.length ? alerts : ["No notable alerts detected."];
}
