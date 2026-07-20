// Tamarack Process Survey — survey form logic.
// Depends on globals from supabase-config.js (SUPABASE_URL, SUPABASE_ANON_KEY,
// PROCESSES, ROLES, TIME_LOST_OPTIONS, TIME_LOST_LABELS) and the Supabase UMD client.

const form = document.getElementById("survey");
const errorEl = document.getElementById("error");
const submitBtn = document.getElementById("submit-btn");

// --- Populate the role dropdown ---------------------------------------------
// TODO: if the other Tamarack app later exposes a staff/cohort list (Supabase table,
// REST API, or export), populate ROLES from there instead of this hardcoded list.
const roleSelect = document.getElementById("role");
for (const r of ROLES) {
  const opt = document.createElement("option");
  opt.value = r;
  opt.textContent = r;
  roleSelect.appendChild(opt);
}

// --- Build a process card ----------------------------------------------------
function scaleMarkup(key) {
  let cells = "";
  for (let n = 1; n <= 5; n++) {
    cells +=
      `<input type="radio" id="sat_${key}_${n}" name="sat_${key}" value="${n}" />` +
      `<label for="sat_${key}_${n}">${n}</label>`;
  }
  return `<div class="scale">${cells}</div>` +
    `<div class="scale-ends"><span>Works terribly</span><span>Works great</span></div>`;
}

function timeMarkup(key) {
  let opts = `<option value="">Select…</option>`;
  for (const t of TIME_LOST_OPTIONS) {
    opts += `<option value="${t}">${TIME_LOST_LABELS[t]}</option>`;
  }
  return `<select name="time_${key}">${opts}</select>`;
}

const grid = document.getElementById("process-grid");
for (const p of PROCESSES) {
  const card = document.createElement("div");
  card.className = "process-card";
  card.innerHTML =
    `<h3>${p.label}</h3>` +
    `<span class="q-label">How well does it work?</span>` +
    scaleMarkup(p.key) +
    `<span class="q-label">Time lost to it per week</span>` +
    timeMarkup(p.key) +
    `<div class="followup" id="followup_${p.key}" hidden>` +
      `<div class="field">` +
        `<label class="block" for="pain_${p.key}">What's the main pain point? <span class="hint">(optional)</span></label>` +
        `<textarea id="pain_${p.key}" name="pain_${p.key}"></textarea>` +
      `</div>` +
      `<div class="field">` +
        `<label class="block" for="want_${p.key}">What change would help most? <span class="hint">(optional)</span></label>` +
        `<textarea id="want_${p.key}" name="want_${p.key}"></textarea>` +
      `</div>` +
    `</div>`;
  grid.appendChild(card);

  // Reveal follow-up fields when satisfaction <= 3.
  card.querySelectorAll(`input[name="sat_${p.key}"]`).forEach((radio) => {
    radio.addEventListener("change", () => {
      const low = Number(radio.value) <= 3;
      document.getElementById(`followup_${p.key}`).hidden = !low;
    });
  });
}

// --- Priority ranking dropdowns ---------------------------------------------
const rankSelects = [...document.querySelectorAll(".rank-select")];
for (const sel of rankSelects) {
  sel.innerHTML =
    `<option value="">Select a process…</option>` +
    PROCESSES.map((p) => `<option value="${p.key}">${p.label}</option>`).join("");
}

// --- Client-facing risk radios (styling + detail reveal) --------------------
const riskRow = document.getElementById("risk-row");
const riskDetailWrap = document.getElementById("risk-detail-wrap");
riskRow.querySelectorAll('input[name="risk"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    riskRow.querySelectorAll("label").forEach((l) => l.classList.remove("selected"));
    radio.closest("label").classList.add("selected");
    riskDetailWrap.hidden = radio.value !== "yes";
  });
});

// --- Validation + collect ----------------------------------------------------
function collect() {
  const role = roleSelect.value || null;

  // Per-process rows. Satisfaction + time lost required for each.
  const responseRows = [];
  for (const p of PROCESSES) {
    const sat = form.querySelector(`input[name="sat_${p.key}"]:checked`);
    const time = form.querySelector(`select[name="time_${p.key}"]`).value;
    if (!sat) return { error: `Please rate "${p.label}".` };
    if (!time) return { error: `Please pick time lost for "${p.label}".` };
    const satNum = Number(sat.value);
    const low = satNum <= 3;
    responseRows.push({
      role,
      process: p.key,
      satisfaction: satNum,
      time_lost: time,
      pain_point: low ? (form.querySelector(`#pain_${p.key}`).value.trim() || null) : null,
      desired_change: low ? (form.querySelector(`#want_${p.key}`).value.trim() || null) : null,
    });
  }

  // Priorities: three distinct, all filled.
  const ranks = rankSelects.map((s) => s.value);
  if (ranks.some((v) => !v)) return { error: "Please pick all three priorities." };
  if (new Set(ranks).size !== 3) return { error: "Your three priorities must be different." };
  const priorityRows = ranks.map((process, i) => ({ role, process, rank: i + 1 }));

  // Client-facing risk.
  const riskChoice = form.querySelector('input[name="risk"]:checked');
  if (!riskChoice) return { error: "Please answer the client-facing risk question." };
  const riskRow = {
    role,
    had_client_facing_issue: riskChoice.value === "yes",
    detail: riskChoice.value === "yes"
      ? (document.getElementById("risk-detail").value.trim() || null)
      : null,
  };

  return { responseRows, priorityRows, riskRow };
}

// --- Submit ------------------------------------------------------------------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.hidden = true;

  const data = collect();
  if (data.error) {
    errorEl.textContent = data.error;
    errorEl.hidden = false;
    errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  try {
    const results = await Promise.all([
      sb.from("survey_responses").insert(data.responseRows),
      sb.from("survey_priorities").insert(data.priorityRows),
      sb.from("survey_client_risk").insert(data.riskRow),
    ]);
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;

    form.hidden = true;
    document.getElementById("thanks").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Show the live current state so it's interesting to keep an eye on as
    // more people (and cohorts) submit.
    renderResults(document.getElementById("live-results"));
  } catch (err) {
    errorEl.textContent = "Submit failed — please try again. (" + (err.message || err) + ")";
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit survey";
  }
});
