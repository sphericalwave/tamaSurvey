# Tamarack Process Survey

Anonymous, single-page survey for Tamarack staff to rate internal operational processes
so leadership can prioritize fixes. Static site (no build step) + Supabase for storage.

- `index.html` — the survey. Shows the live aggregate state after submitting; you can
  submit again as a different cohort.
- `results.html` — standalone aggregate dashboard (project this during the meeting).
- Aggregates only ever expose grouped math. Raw written answers are never readable with
  the public anon key — pull those from the Supabase dashboard when prepping.

## 1. Create the Supabase project
1. supabase.com → New project. Wait for it to provision.
2. Project Settings → **API**. Copy the **Project URL** and the **anon / public** key.

## 2. Run the schema
Supabase → **SQL Editor** → New query → paste all of `supabase/schema.sql` → **Run**.
Creates 3 tables (RLS on, insert-only for anon) and 2 aggregate views granted to anon.

## 3. Add your keys
Edit `supabase-config.js` and replace the two placeholders:
```js
const SUPABASE_URL = "https://YOUR-PROJECT-ref.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-PUBLIC-KEY";
```
The anon key is safe to commit: RLS allows INSERT only, and reads are limited to the
aggregate views. **Never** put a service-role key in this repo.

## 4. Add the two images
Drop these files in the repo root (filenames must match exactly):
- `tamaTree.jpeg` — the Tamarack tree mark shown in each page header.
- `eel.jpg` — the footer image.

Both are optional at runtime (they hide themselves if missing), but expected for the
finished look.

## 5. Deploy to GitHub Pages
1. Create a GitHub repo and push these files to `main`.
2. Repo → Settings → **Pages** → Source: *Deploy from a branch* → Branch: `main`, folder
   `/ (root)` → Save.
3. Wait ~1 min. Survey is at `https://<user>.github.io/<repo>/` and results at
   `.../results.html`.

## Notes
- Cohort is required. Options (Project Manager, Project Associate, Director, Finance,
  Admin) live in `ROLES` in `supabase-config.js`; there's a `// TODO` for wiring these
  from the other Tamarack app later if it exposes a staff list.
- **Invoicing** and **Project budgets** only appear for the Finance, Project Manager, and
  Director cohorts (set via `roles` on those entries in `PROCESSES`). Other cohorts don't
  see or rate them, and they're excluded from that cohort's priority ranking.
- The **Travel planning** free-text suggestions land in `survey_travel_suggestions` (raw
  text, not shown on the results page — read it from the Supabase dashboard).
- Brand colors are `:root` CSS variables at the top of `style.css` — swap the four hex
  values when final brand colors are confirmed.

## Verify end-to-end
1. Run `schema.sql`; confirm 3 tables + 2 views exist and RLS is on.
2. Open `index.html`, submit a test response; confirm rows appear in the Supabase table
   editor across `survey_responses`, `survey_priorities`, `survey_client_risk`.
3. Confirm a satisfaction ≤ 3 reveals the pain-point / desired-change fields.
4. Confirm the thank-you screen shows live results, and "Submit another response" resets
   the form so you can submit as a different cohort.
5. Open `results.html`; confirm the aggregate tables render and update after submissions.
6. In the browser console, try `sb.from('survey_responses').select('*')` — it should
   return no rows (anon has no read access to raw data).
