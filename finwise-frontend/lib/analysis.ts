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
  if (["uber", "ola", "taxi", "grab", "ride", "lyft", "transport"].some((k) => d.includes(k))) return "Transport";
  if (["restaurant", "dine", "cafe", "pizza", "dominos", "swiggy", "zomato", "food", "mcdonald"].some((k) => d.includes(k))) return "Dining";
  if (["salary", "pay", "invoice", "income", "bonus", "wage"].some((k) => d.includes(k))) return "Income";
  if (["rent", "house", "flat", "apartment", "lease"].some((k) => d.includes(k))) return "Rent";
  if (["amazon", "flipkart", "shopping", "store", "mall", "retail"].some((k) => d.includes(k))) return "Shopping";
  if (["electricity", "water", "gas", "utility", "bill", "internet", "phone"].some((k) => d.includes(k))) return "Utilities";
  if (["health", "medical", "doctor", "hospital", "pharmacy", "medicine"].some((k) => d.includes(k))) return "Healthcare";
  if (["gym", "fitness", "sport", "yoga", "netflix", "spotify", "subscription"].some((k) => d.includes(k))) return "Entertainment";
  if (["education", "course", "tuition", "school", "college", "book"].some((k) => d.includes(k))) return "Education";
  if (["insurance", "investment", "stock", "mutual", "fund"].some((k) => d.includes(k))) return "Investment";
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
  if (!txns || txns.length === 0) return ["📊 No transactions loaded. Upload your CSV to get started!"];

  const summary = analyzeTransactions(txns);
  if (summary.expenseTotal > summary.incomeTotal) {
    const deficit = summary.expenseTotal - summary.incomeTotal;
    alerts.push(`⚠️ Budget Alert: You're overspending by ${deficit.toFixed(2)}. Consider reducing discretionary spending by 10-15%.`);
  } else if (summary.incomeTotal > 0) {
    const savingsRate = ((summary.incomeTotal - summary.expenseTotal) / summary.incomeTotal * 100).toFixed(1);
    if (parseFloat(savingsRate) > 20) {
      alerts.push(`💰 Great job! You're saving ${savingsRate}% of your income. Keep up the excellent financial discipline!`);
    } else if (parseFloat(savingsRate) > 10) {
      alerts.push(`✅ Good progress! You're saving ${savingsRate}% of your income. Try to increase it to 20%+ for better financial health.`);
    } else {
      alerts.push(`📈 Your savings rate is ${savingsRate}%. Aim for at least 20% by cutting non-essential expenses.`);
    }
  }

  const monthly = groupByMonth(txns);
  if (monthly.length >= 2) {
    const last = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2];
    const deltaNet = last.net - prev.net;
    const dropPct = prev.net !== 0 ? (deltaNet / Math.abs(prev.net)) * 100 : 0;
    if (prev.net > 0 && last.net < prev.net * 0.8) {
      alerts.push(`📉 Net savings dropped by ${Math.abs(dropPct).toFixed(0)}% compared to ${prev.month}. Review your discretionary spending patterns.`);
    } else if (deltaNet > 0) {
      alerts.push(`📈 Positive trend! Your savings increased by ${Math.abs(dropPct).toFixed(0)}% vs last month. Excellent work!`);
    }
  }

  // Category spikes and trends
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
      if (vb > va * 1.3 && vb > 500) {
        alerts.push(`🔔 ${c} spending spiked by ${((vb - va) / (va || 1) * 100).toFixed(0)}% this month. Review if this was planned.`);
      } else if (va > 0 && vb < va * 0.7 && va > 500) {
        alerts.push(`✨ You reduced ${c} spending by ${((va - vb) / va * 100).toFixed(0)}%. Great cost control!`);
      }
    }
  }

  // High expense categories
  const categorySpending = Object.entries(summary.byCategory)
    .filter(([, v]) => v < 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3);
  
  if (categorySpending.length > 0 && Math.abs(categorySpending[0][1]) > 1000) {
    alerts.push(`💡 Top expense: ${categorySpending[0][0]} (${Math.abs(categorySpending[0][1]).toFixed(2)}). Consider budget limits for this category.`);
  }

  return alerts.length ? alerts : ["✅ All good! No alerts detected. Your finances are on track."];
}

export function suggestBudget(txns: Txn[], targetSavings: number = 0): {
  currentSavings: number;
  targetSavings: number;
  neededToSave: number;
  suggestions: Array<{ category: string; currentSpend: number; suggestedCut: number; newEstimatedSpend: number }>;
} {
  const summary = analyzeTransactions(txns);
  const currentSavings = Math.max(0, summary.incomeTotal - summary.expenseTotal);
  const needed = Math.max(0, targetSavings - currentSavings);

  const categorySpending = Object.entries(summary.byCategory)
    .filter(([, v]) => v < 0)
    .sort((a, b) => a[1] - b[1])
    .map(([cat, amt]) => ({ category: cat, spend: Math.abs(amt) }));

  const suggestions = [];
  let remain = needed;

  for (const { category, spend } of categorySpending) {
    if (remain <= 0) break;
    const reduction = Math.min(spend * 0.1, remain); // 10% cut suggestion
    suggestions.push({
      category,
      currentSpend: spend,
      suggestedCut: +reduction.toFixed(2),
      newEstimatedSpend: +(spend - reduction).toFixed(2),
    });
    remain -= reduction;
  }

  return {
    currentSavings: +currentSavings.toFixed(2),
    targetSavings: +targetSavings.toFixed(2),
    neededToSave: +needed.toFixed(2),
    suggestions,
  };
}

export function generateGoalPlan(txns: Txn[], goalAmount: number, months: number): {
  goalAmount: number;
  months: number;
  monthlyTarget: number;
  weeklyTarget: number;
  tips: Array<{ category: string; currentMonthly: number; suggestedMonthlyCut: number }>;
} {
  if (months <= 0 || goalAmount <= 0) {
    return {
      goalAmount: 0,
      months: 0,
      monthlyTarget: 0,
      weeklyTarget: 0,
      tips: [],
    };
  }

  const summary = analyzeTransactions(txns);
  const monthlyTarget = goalAmount / months;
  const weeklyTarget = goalAmount / (months * 4);

  const categorySpending = Object.entries(summary.byCategory)
    .filter(([, v]) => v < 0)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5);

  const tips = [];
  let remain = monthlyTarget;

  for (const [category, amt] of categorySpending) {
    if (remain <= 0) break;
    const absAmt = Math.abs(amt);
    const cut = Math.min(absAmt * 0.1, remain);
    if (cut > 0) {
      tips.push({
        category,
        currentMonthly: +absAmt.toFixed(2),
        suggestedMonthlyCut: +cut.toFixed(2),
      });
      remain -= cut;
    }
  }

  return {
    goalAmount: +goalAmount.toFixed(2),
    months,
    monthlyTarget: +monthlyTarget.toFixed(2),
    weeklyTarget: +weeklyTarget.toFixed(2),
    tips,
  };
}
