// Tamarack Process Survey — aggregate rendering.
// Shared by results.html (standalone dashboard) and index.html (live state shown on
// the thank-you screen). Reads ONLY the two aggregate views — never raw responses.
// Depends on globals from supabase-config.js (sb, PROCESSES, TIME_LOST_LABELS).

const LABEL_BY_KEY = Object.fromEntries(PROCESSES.map((p) => [p.key, p.label]));

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Renders satisfaction + priority tables into `mount`. Safe to call repeatedly.
async function renderResults(mount) {
  if (!mount) return;
  mount.innerHTML = `<p class="res-empty">Loading current results…</p>`;

  const [aggRes, priRes] = await Promise.all([
    sb.from("survey_aggregates").select("*"),
    sb.from("survey_priority_scores").select("*"),
  ]);

  if (aggRes.error || priRes.error) {
    mount.innerHTML = `<p class="error-msg">Couldn't load results: ` +
      esc((aggRes.error || priRes.error).message) + `</p>`;
    return;
  }

  mount.innerHTML =
    satisfactionTable(aggRes.data || []) +
    priorityTable(priRes.data || []);
}

function satisfactionTable(rows) {
  if (!rows.length) return `<h2>Satisfaction by process</h2><p class="res-empty">No responses yet.</p>`;

  // Lowest average first — the most painful processes surface at the top.
  const sorted = [...rows].sort((a, b) => a.avg_satisfaction - b.avg_satisfaction);
  const body = sorted.map((r) => {
    const pct = (Number(r.avg_satisfaction) / 5) * 100;
    const time = TIME_LOST_LABELS[r.most_common_time_lost] || r.most_common_time_lost || "—";
    return `<tr>
      <td>${esc(LABEL_BY_KEY[r.process] || r.process)}</td>
      <td class="bar-cell">
        <div class="bar-track"><div class="bar-fill" style="width:${pct.toFixed(0)}%"></div></div>
      </td>
      <td class="num">${Number(r.avg_satisfaction).toFixed(2)}</td>
      <td class="num">${r.responses}</td>
      <td>${esc(time)}</td>
    </tr>`;
  }).join("");

  return `<h2>Satisfaction by process</h2>
    <p class="hint">Lowest average first (1 = worst, 5 = best).</p>
    <table class="res-table">
      <thead><tr><th>Process</th><th>Avg</th><th>Score</th><th>Responses</th><th>Typical time lost</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

function priorityTable(rows) {
  if (!rows.length) return `<h2>Top priorities</h2><p class="res-empty">No priority votes yet.</p>`;

  // Weighted: 3x #1 votes + 2x #2 + 1x #3.
  const scoreByProcess = {};
  for (const r of rows) {
    const w = r.rank === 1 ? 3 : r.rank === 2 ? 2 : 1;
    scoreByProcess[r.process] = (scoreByProcess[r.process] || 0) + w * Number(r.votes);
  }
  const sorted = Object.entries(scoreByProcess).sort((a, b) => b[1] - a[1]);
  const max = sorted[0][1] || 1;

  const body = sorted.map(([key, score]) => {
    const pct = (score / max) * 100;
    return `<tr>
      <td>${esc(LABEL_BY_KEY[key] || key)}</td>
      <td class="bar-cell">
        <div class="bar-track"><div class="bar-fill priority" style="width:${pct.toFixed(0)}%"></div></div>
      </td>
      <td class="num">${score}</td>
    </tr>`;
  }).join("");

  return `<h2>Top priorities to fix</h2>
    <p class="hint">Weighted vote: 3× first-choice + 2× second + 1× third.</p>
    <table class="res-table">
      <thead><tr><th>Process</th><th>Priority</th><th>Score</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`;
}

// Standalone dashboard auto-render (only on results.html).
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("results-root");
  if (root) renderResults(root);
});
