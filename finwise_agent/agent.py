import statistics
from typing import List, Dict, Any, Optional
import csv
import io
import os

try:
    # Import Agent from google-adk if available
    from google.adk.agents import Agent  # type: ignore
except Exception:  # pragma: no cover - allow repo to exist without package installed
    # Lightweight shim so the file can be imported without google-adk installed.
    class Agent:  # type: ignore
        def __init__(self, **kwargs):
            self.kwargs = kwargs


def simple_categorize(description: str) -> str:
    """Very simple keyword-based categorization.
    Frontend may pass categories; this is a fallback.
    """
    d = (description or "").lower()
    if any(k in d for k in ["uber", "ola", "taxi", "grab", "ride"]):
        return "Transport"
    if any(k in d for k in ["restaurant", "dine", "cafe", "pizza", "dominos", "swiggy"]):
        return "Dining"
    if any(k in d for k in ["salary", "pay", "invoice"]):
        return "Income"
    if any(k in d for k in ["rent", "house", "flat"]):
        return "Rent"
    return "Other"


def analyze_transactions(transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze basic stats and category breakdown for transactions.

    Each txn ideally: {date, amount, description, category?, type?}
    Positive amounts = income; negative = expense.
    """
    if not transactions:
        return {"status": "error", "error_message": "No transactions provided."}

    amounts = [float(t.get("amount", 0) or 0) for t in transactions]
    total = sum(amounts)
    avg = statistics.mean(amounts) if amounts else 0.0

    incomes = sum(float(t.get("amount", 0) or 0) for t in transactions if (t.get("type") == "income") or (float(t.get("amount", 0) or 0) > 0))
    expenses = sum(-float(t.get("amount", 0) or 0) if float(t.get("amount", 0) or 0) < 0 else 0 for t in transactions)

    by_cat: Dict[str, float] = {}
    for t in transactions:
        amt = float(t.get("amount", 0) or 0)
        cat = t.get("category") or simple_categorize(t.get("description", ""))
        by_cat[cat] = by_cat.get(cat, 0.0) + amt

    return {
        "status": "success",
        "total_txns": len(transactions),
        "net_total": round(total, 2),
        "avg_amount": round(avg, 2),
        "income_total": round(incomes, 2),
        "expense_total": round(expenses, 2),
        "by_category": {k: round(v, 2) for k, v in by_cat.items()},
    }


def suggest_budget(transactions: List[Dict[str, Any]], target_savings: float = 0.0) -> Dict[str, Any]:
    """Return simple budget rules: reduce top-spend categories by 10% until target is met."""
    analysis = analyze_transactions(transactions)
    if analysis.get("status") != "success":
        return analysis

    by_cat = analysis["by_category"]
    # Sort categories by absolute spend descending
    sorted_cats = sorted(by_cat.items(), key=lambda kv: abs(kv[1]), reverse=True)
    suggestions = []

    current_savings_est = max(0.0, analysis["income_total"] - abs(analysis["expense_total"]))
    needed = max(0.0, float(target_savings or 0) - current_savings_est)

    remain = needed
    for cat, amt in sorted_cats:
        if amt <= 0 or remain <= 0:
            continue
        reduction = abs(amt) * 0.10  # 10% cut suggestion
        suggestions.append({
            "category": cat,
            "current_spend": round(amt, 2),
            "suggested_cut": round(reduction, 2),
            "new_estimated_spend": round(amt - reduction, 2),
        })
        remain -= reduction

    return {
        "status": "success",
        "current_savings_est": round(current_savings_est, 2),
        "target_savings": round(float(target_savings or 0), 2),
        "needed_to_save": round(needed, 2),
        "suggestions": suggestions,
    }


def generate_goal_plan(transactions: List[Dict[str, Any]], goal_amount: float, months: int) -> Dict[str, Any]:
    """Generate a simple savings plan for a given goal within N months.

    Returns monthly and weekly targets, and quick tips based on top spend categories.
    """
    if months <= 0 or goal_amount <= 0:
        return {"status": "error", "error_message": "Provide positive goal_amount and months."}

    analysis = analyze_transactions(transactions)
    if analysis.get("status") != "success":
        return analysis

    monthly_target = goal_amount / months
    weekly_target = goal_amount / (months * 4)

    # Use top spend categories to propose reductions
    by_cat = analysis["by_category"]
    top = sorted(by_cat.items(), key=lambda kv: abs(kv[1]), reverse=True)[:5]
    tips = []
    remain = monthly_target
    for cat, amt in top:
        if remain <= 0:
            break
        if amt <= 0:
            continue
        cut = min(abs(amt) * 0.10, remain)  # up to 10% reduction
        if cut > 0:
            tips.append({
                "category": cat,
                "current_monthly": round(amt, 2),
                "suggested_monthly_cut": round(cut, 2),
            })
            remain -= cut

    return {
        "status": "success",
        "goal_amount": round(goal_amount, 2),
        "months": months,
        "monthly_target": round(monthly_target, 2),
        "weekly_target": round(weekly_target, 2),
        "top_category_tips": tips,
    }


def forecast_savings(transactions: List[Dict[str, Any]], months: int = 3) -> Dict[str, Any]:
    """Naive forecast using average monthly net (assumes 1 month of data if not provided)."""
    if not transactions:
        return {"status": "error", "error_message": "No transactions provided."}

    total_net = sum(float(t.get("amount", 0) or 0) for t in transactions)
    months_present = 1  # MVP assumption
    avg_monthly_net = total_net / months_present if months_present else 0
    forecast = [{"month": i + 1, "estimated_savings": round((i + 1) * avg_monthly_net, 2)} for i in range(int(months or 0))]
    return {"status": "success", "avg_monthly_net": round(avg_monthly_net, 2), "forecast": forecast}


# -------------------------
# File & CSV helper tools
# -------------------------

# Simple process-local memory to keep context during a Dev UI session.
# This resets when the process restarts.
_MEMORY: Dict[str, Any] = {
    "last_file_path": None,           # str | None
    "last_csv_text": None,            # str | None
    "transactions": None,             # List[Dict[str, Any]] | None
    "notes": [],                      # List[str]
}

def _parse_amount(val: Any) -> float:
    try:
        return float(val)
    except Exception:
        return 0.0


def load_transactions(
    file_path: Optional[str] = None,
    csv_text: Optional[str] = None,
) -> Dict[str, Any]:
    """Load transactions from a CSV file path or from raw CSV text.

    CSV headers expected: date, description, amount, category, type
    - amount: positive=income, negative=expense (strings will be coerced)

    Args:
        file_path: Local path to CSV file (relative or absolute)
        csv_text: Raw CSV content as a string (alternative to file_path)

    Returns:
        dict with status and transactions or error_message
    """
    try:
        if not file_path and not csv_text:
            return {"status": "error", "error_message": "Provide file_path or csv_text."}

        if csv_text is not None:
            buf = io.StringIO(csv_text)
        else:
            # Normalize relative paths to workspace root
            normalized = os.path.expanduser(file_path or "")
            buf = open(normalized, "r", encoding="utf-8")

        with buf:
            reader = csv.DictReader(buf)
            txns: List[Dict[str, Any]] = []
            for row in reader:
                if not row:
                    continue
                amount = _parse_amount(row.get("amount"))
                txns.append(
                    {
                        "date": (row.get("date") or "").strip(),
                        "description": (row.get("description") or "").strip(),
                        "amount": amount,
                        "category": (row.get("category") or "").strip() or None,
                        "type": (row.get("type") or "").strip() or ("income" if amount > 0 else ("expense" if amount < 0 else None)),
                    }
                )

        if not txns:
            return {"status": "error", "error_message": "CSV contained no rows."}
        # Update memory
        _MEMORY["transactions"] = txns
        _MEMORY["last_file_path"] = file_path
        _MEMORY["last_csv_text"] = csv_text

        return {"status": "success", "transactions": txns, "count": len(txns)}
    except FileNotFoundError:
        return {"status": "error", "error_message": f"File not found: {file_path}"}
    except UnicodeDecodeError:
        return {"status": "error", "error_message": "Could not decode CSV as UTF-8."}
    except Exception as e:
        return {"status": "error", "error_message": f"Failed to load CSV: {e}"}


def analyze_file(file_path: Optional[str] = None, csv_text: Optional[str] = None) -> Dict[str, Any]:
    """Convenience tool: load from CSV then analyze."""
    if file_path or csv_text:
        loaded = load_transactions(file_path=file_path, csv_text=csv_text)
        if loaded.get("status") != "success":
            return loaded
        txns = loaded["transactions"]  # type: ignore[index]
    else:
        # Use memory if available
        txns = _MEMORY.get("transactions")
        if not txns:
            return {"status": "error", "error_message": "No transactions in memory. Provide file_path or csv_text first."}
    return analyze_transactions(txns)  # type: ignore[arg-type]


def suggest_budget_from_file(
    file_path: Optional[str] = None,
    target_savings: float = 0.0,
    csv_text: Optional[str] = None,
) -> Dict[str, Any]:
    """Convenience tool: load from CSV then suggest budget."""
    if file_path or csv_text:
        loaded = load_transactions(file_path=file_path, csv_text=csv_text)
        if loaded.get("status") != "success":
            return loaded
        txns = loaded["transactions"]  # type: ignore[index]
    else:
        txns = _MEMORY.get("transactions")
        if not txns:
            return {"status": "error", "error_message": "No transactions in memory. Provide file_path or csv_text first."}
    return suggest_budget(txns, target_savings=target_savings)  # type: ignore[arg-type]


def forecast_savings_from_file(
    file_path: Optional[str] = None,
    months: int = 3,
    csv_text: Optional[str] = None,
) -> Dict[str, Any]:
    """Convenience tool: load from CSV then forecast savings."""
    if file_path or csv_text:
        loaded = load_transactions(file_path=file_path, csv_text=csv_text)
        if loaded.get("status") != "success":
            return loaded
        txns = loaded["transactions"]  # type: ignore[index]
    else:
        txns = _MEMORY.get("transactions")
        if not txns:
            return {"status": "error", "error_message": "No transactions in memory. Provide file_path or csv_text first."}
    return forecast_savings(txns, months=months)  # type: ignore[arg-type]


# -------------------------
# Memory tools
# -------------------------
def memory_status() -> Dict[str, Any]:
    """Report what's currently stored in process-local memory."""
    txns = _MEMORY.get("transactions")
    return {
        "status": "success",
        "has_transactions": bool(txns),
        "count": len(txns) if txns else 0,
        "last_file_path": _MEMORY.get("last_file_path"),
        "has_csv_text": bool(_MEMORY.get("last_csv_text")),
        "notes_count": len(_MEMORY.get("notes", [])),
    }


def remember_note(note: str) -> Dict[str, Any]:
    """Append a short free-form note to memory (e.g., user preferences)."""
    if not note or not isinstance(note, str):
        return {"status": "error", "error_message": "Provide a non-empty note string."}
    _MEMORY.setdefault("notes", []).append(note.strip())
    return {"status": "success", "notes_count": len(_MEMORY["notes"]) }


def recall_notes() -> Dict[str, Any]:
    """Return all remembered notes."""
    return {"status": "success", "notes": list(_MEMORY.get("notes", []))}


def clear_memory() -> Dict[str, Any]:
    """Clear all in-memory state for this process/session."""
    _MEMORY["last_file_path"] = None
    _MEMORY["last_csv_text"] = None
    _MEMORY["transactions"] = None
    _MEMORY["notes"] = []
    return {"status": "success", "message": "Memory cleared."}


# Root Agent configured to use an LLM model id (update based on your provider)
root_agent = Agent(
    name="finwise_agent",
    model="gemini-2.5-pro",  # switched to Gemini 2.5 Pro per request; ensure your region supports this model
    description="Personalized financial coaching agent for FinWise MVP",
    instruction=(
        "You are a helpful financial coach. Use the provided analytical tool outputs "
        "to craft user-friendly advice, suggestions, and step-by-step actions."
    ),
    tools=[
        # Core analysis tools
        analyze_transactions,
        suggest_budget,
        forecast_savings,
        generate_goal_plan,
        # File helpers for user-uploaded CSVs
        load_transactions,
        analyze_file,
        suggest_budget_from_file,
        forecast_savings_from_file,
        # Memory helpers
        memory_status,
        remember_note,
        recall_notes,
        clear_memory,
    ],
)
