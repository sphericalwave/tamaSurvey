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
    priorityPie(priRes.data || []) +
    satisfactionTable(aggRes.data || []) +
    priorityTable(priRes.data || []);
}

// Weighted priority score per process: 3x #1 votes + 2x #2 + 1x #3. Sorted desc.
function weightedScores(rows) {
  const score = {};
  for (const r of rows) {
    const w = r.rank === 1 ? 3 : r.rank === 2 ? 2 : 1;
    score[r.process] = (score[r.process] || 0) + w * Number(r.votes);
  }
  return Object.entries(score).sort((a, b) => b[1] - a[1]);
}

const PIE_COLORS = ["#2F4F3E", "#4a7a5f", "#6f9e83", "#D8C9A3", "#b99a5b", "#8a6d3b"];

function priorityPie(rows) {
  const scored = weightedScores(rows);
  if (!scored.length) {
    return `<h2>Top priorities — share of votes</h2><p class="res-empty">No priority votes yet.</p>`;
  }

  // Top 5 as their own slices, everything else grouped.
  const top = scored.slice(0, 5);
  const restSum = scored.slice(5).reduce((s, [, v]) => s + v, 0);
  const slices = restSum > 0 ? [...top, ["__other", restSum]] : [...top];
  const total = slices.reduce((s, [, v]) => s + v, 0);

  let acc = 0;
  const stops = [];
  const legend = [];
  slices.forEach(([key, val], i) => {
    const start = (acc / total) * 360;
    acc += val;
    const end = (acc / total) * 360;
    const color = PIE_COLORS[i % PIE_COLORS.length];
    stops.push(`${color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`);
    const label = key === "__other" ? "Everything else" : (LABEL_BY_KEY[key] || key);
    const pct = Math.round((val / total) * 100);
    legend.push(
      `<li><span class="swatch" style="background:${color}"></span>${esc(label)} — ${pct}%</li>`
    );
  });

  return `<h2>Top priorities — share of votes</h2>
    <p class="hint">Weighted vote share: 3× first-choice + 2× second + 1× third.</p>
    <div class="pie-wrap">
      <div class="pie" style="background:conic-gradient(${stops.join(", ")})" aria-hidden="true"></div>
      <ul class="legend">${legend.join("")}</ul>
    </div>`;
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

  const sorted = weightedScores(rows);
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

// --- Demo mode ---------------------------------------------------------------
// results.html?demo=1 renders sample data through the same pie/tables so it can be
// shared for feedback before any real responses exist. Writes nothing to the DB.
const DEMO_AGGREGATES = [
  { process: "invoicing", responses: 9, avg_satisfaction: 2.1, most_common_time_lost: "1-3hrs" },
  { process: "taxes", responses: 3, avg_satisfaction: 2.3, most_common_time_lost: "5+hrs" },
  { process: "equipment_log", responses: 12, avg_satisfaction: 2.4, most_common_time_lost: "3-5hrs" },
  { process: "business_development", responses: 5, avg_satisfaction: 2.5, most_common_time_lost: "3-5hrs" },
  { process: "gantt_charts", responses: 11, avg_satisfaction: 2.6, most_common_time_lost: "1-3hrs" },
  { process: "project_budgets", responses: 9, avg_satisfaction: 2.8, most_common_time_lost: "1-3hrs" },
  { process: "etransfers", responses: 3, avg_satisfaction: 3.0, most_common_time_lost: "<1hr" },
  { process: "project_management", responses: 14, avg_satisfaction: 3.1, most_common_time_lost: "1-3hrs" },
  { process: "expense_input", responses: 14, avg_satisfaction: 3.4, most_common_time_lost: "<1hr" },
  { process: "payroll", responses: 3, avg_satisfaction: 3.7, most_common_time_lost: "none" },
  { process: "file_collaboration", responses: 14, avg_satisfaction: 3.9, most_common_time_lost: "<1hr" },
  { process: "general_collaboration", responses: 14, avg_satisfaction: 4.2, most_common_time_lost: "none" },
];
const DEMO_PRIORITY_SCORES = [
  { process: "invoicing", rank: 1, votes: 8 }, { process: "invoicing", rank: 2, votes: 2 }, { process: "invoicing", rank: 3, votes: 2 },
  { process: "equipment_log", rank: 1, votes: 5 }, { process: "equipment_log", rank: 2, votes: 4 }, { process: "equipment_log", rank: 3, votes: 2 },
  { process: "gantt_charts", rank: 1, votes: 3 }, { process: "gantt_charts", rank: 2, votes: 4 }, { process: "gantt_charts", rank: 3, votes: 5 },
  { process: "project_budgets", rank: 1, votes: 2 }, { process: "project_budgets", rank: 2, votes: 3 }, { process: "project_budgets", rank: 3, votes: 4 },
  { process: "project_management", rank: 1, votes: 1 }, { process: "project_management", rank: 2, votes: 2 }, { process: "project_management", rank: 3, votes: 3 },
  { process: "business_development", rank: 1, votes: 1 }, { process: "business_development", rank: 2, votes: 1 }, { process: "business_development", rank: 3, votes: 2 },
  { process: "expense_input", rank: 2, votes: 1 }, { process: "expense_input", rank: 3, votes: 3 },
  { process: "file_collaboration", rank: 3, votes: 2 },
  { process: "general_collaboration", rank: 3, votes: 1 },
];

function renderDemo(mount) {
  mount.innerHTML =
    `<div class="demo-banner">Sample data for preview — these are not real responses yet.</div>` +
    priorityPie(DEMO_PRIORITY_SCORES) +
    satisfactionTable(DEMO_AGGREGATES) +
    priorityTable(DEMO_PRIORITY_SCORES);
}

// Standalone dashboard auto-render (only on results.html).
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("results-root");
  if (!root) return;
  if (new URLSearchParams(location.search).get("demo")) renderDemo(root);
  else renderResults(root);
});
