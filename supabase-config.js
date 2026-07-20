// Supabase connection + shared survey constants.
// The anon key is SAFE to expose client-side: RLS allows INSERT only, and reads are
// restricted to aggregate views (see supabase/schema.sql). No service-role key here.
// TODO: replace the two placeholders below with your project's values (Supabase
// dashboard -> Project Settings -> API).
const SUPABASE_URL = "https://obioljjwzvjydulynhuy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Z2YQhzZn06YZIQOF8a85aw_igliR3P3";

// Single source of truth for process keys + display labels. Keys must match the DB.
// `roles`, when present, restricts a process card to those cohorts only.
const PROCESSES = [
  { key: "invoicing", label: "Invoicing", roles: ["Finance", "Project Manager", "Director"] },
  { key: "project_budgets", label: "Project budgets", roles: ["Finance", "Project Manager", "Director"] },
  { key: "etransfers", label: "E-transfers", roles: ["Director"] },
  { key: "payroll", label: "Payroll", roles: ["Director"] },
  { key: "taxes", label: "Taxes", roles: ["Director"] },
  { key: "expense_input", label: "Expense input / entry" },
  { key: "equipment_log", label: "Equipment log" },
  { key: "file_collaboration", label: "File collaboration / sharing" },
  { key: "project_management", label: "Project management" },
  { key: "gantt_charts", label: "Gantt charts / scheduling" },
  { key: "general_collaboration", label: "General team collaboration" },
];

const ROLES = ["Project Manager", "Project Associate", "Director", "Finance", "Admin"];

const TIME_LOST_OPTIONS = ["none", "<1hr", "1-3hrs", "3-5hrs", "5+hrs"];

const TIME_LOST_LABELS = {
  none: "None",
  "<1hr": "Less than 1 hr",
  "1-3hrs": "1–3 hrs",
  "3-5hrs": "3–5 hrs",
  "5+hrs": "5+ hrs",
};

// Single shared client (the CDN UMD build exposes `supabase.createClient`).
// Load order in every page: supabase CDN -> this file -> app.js / results.js.
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
