# Project Brief — UCalgary Course Projection

> **Event slug:** 2026-05-replit-buildathon
> **Stage:** 02-build
> **Last updated:** 2026-05-02
>
> This file is the single source of truth for this project. Each stage appends its section before advancing. Do not re-derive what is already written here.
>
> **Project folder layout:**
> ```
> projects/2026-05-replit-buildathon/UCalgary-Course-Projection/
> ├── CLAUDE.md          ← this file (project brief, created Stage 01)
> ├── package.json
> ├── vite.config.js
> ├── vercel.json
> ├── index.html
> ├── api/               ← Vercel serverless functions
> ├── data/              ← pre-processed JSON (output of parse_program_data.py)
> ├── src/               ← Vite React source (conventional, source files only)
> └── pitch/             ← deck, script, writeup (Stage 03)
> ```

---

## Event

- **Hackathon:** Replit Buildathon
- **Theme:** Build anything. No requirements.
- **Deadline:** 2026-05-02 (today)
- **Judging criteria (ranked):**
  1. Not specified — default to: demo impact, originality, completeness

---

## Problem

UCalgary Engineering students have no tool to plan a personalized 4-year course sequence that accounts for their prerequisites, goals, and elective choices in one visual view.

---

## Target User

> **Who:** A first- or second-year UCalgary Software Engineering student
> **When:** Registration season, trying to map out the next 2–4 semesters
> **Frustration:** The course calendar is a wall of text. There's no way to see "if I want to work in robotics, which electives should I take, and in what order?" without manually cross-referencing the calendar, prerequisite chains, and program requirements.

---

## Wow Moment

User types "I want to specialize in AI/ML" → a full 4-year flowchart appears, organized by year and semester, with required courses locked in and electives specifically chosen and rationalized for that goal, hover cards explaining each one.

---

## Scope

### In scope
- Program: Software Engineering BSc (UCalgary)
- One-time data pipeline: Python scraper (pdfplumber) extracts program requirements from PDFs → structured JSON
- Course catalog: CSV (`courses-report.2026-05-02.csv`) used for descriptions and prerequisite text
- Agent pipeline:
  1. User inputs goal/specialization interest
  2. Load required courses from parsed program JSON
  3. LLM selects technical electives + complementary studies matching the user's goal, with rationale for each
  4. LLM sequences all courses into a year/semester plan using prerequisite chains from CSV
  5. Output rendered as React Flow chart
- Chart filters: toggle by year, semester, required vs. elective
- UI: UCalgary.ca visual design (via /ui-ux skill)
- Deployment: Vercel

### Explicitly out of scope
- Multiple programs (other Engineering disciplines, non-Engineering faculties)
- Live UCalgary API / real-time catalog sync
- Student login / saved plans
- Mobile optimization

### Feasibility check
- Buildable in time? Yes — scoped to one program, data is fully available, agent is linear
- Demoable live? Yes — type goal, chart renders in seconds
- Does someone clearly need this? Yes — every Engineering student at registration time

---

## Stack

| Layer | Choice | Reason for deviation (if any) |
|---|---|---|
| Frontend | React + Vite | Default |
| Backend | Vercel serverless functions (`/api`) | Default; one endpoint for agent pipeline |
| Data | Static JSON files (parsed from PDFs + CSV at build time) | No DB needed; data is pre-processed once |
| AI / LLM | Claude (Anthropic) | Elective selection, rationale, year/semester sequencing |
| Deployment | Vercel | Default |
| Chart | React Flow | Best-in-class flowchart library for React |
| Data pipeline | Python + pdfplumber | One-time scraper script; not a runtime dependency |

---

## Data Notes
*(recorded at Stage 01 for Stage 02 intake)*

**Source files (immutable, in `shared/sources/2026-05-replit-buildathon/`):**
- `program-ENSFBSC-2026-07-01.pdf` — Software Engineering BSc requirements (years 2–4)
- `program-1STYRENBCH-2022-09-01.pdf` — First Year Curriculum (common to all Engineering)
- `courses-report.2026-05-02.csv` — Full UCalgary course catalog; columns: Subject, Subject code, Catalog Number, Long Course Title, Description (includes prerequisite text inline), Units, Repeat for Credit, Signature Learning, Course Attributes, Instructional Components

**Known gaps:**
- "Untitled Requirement Set" in PDFs = web-linked content that didn't resolve in PDF export. Affects: General Complementary Studies elective pool. Handle by noting gap in UI or hardcoding a representative set.
- "First Year Curriculum" section in ENSF BSc PDF resolves to `program-1STYRENBCH-2022-09-01.pdf` (now available).
- Year/semester assignment for required courses is NOT in the PDFs — it's a flat list. The LLM agent must infer ordering from prerequisite chains in the CSV.

**Parsed program structure (Software Engineering BSc):**

Year 1 (common to all Engineering):
- ENGG 200, 202, 204, 212, 225
- DIGE 233
- MATH 275, 277, 211
- PHYS 259
- 3 units General Complementary Studies (English 200-level)

Years 2–4 Required:
- DIGE 319
- ENSF 300, 337, 338, 380, 381, 400, 444, 460, 461, 462, 480, 555
- ENEL 353
- ENEL 500 OR (ENGG 503 + 504) OR (ENGG 501 + 502) — capstone
- ENCM 369
- ENSF 401, 438, 533
- MATH 271, 375
- PHYS 365 or 369 (3 units)

Electives:
- Technical Electives: 12 units from ENSF Technical Electives list
- Complementary Studies Specified: ENGG 209, ENGG 213 or COMS 363, ENGG 481, ENGG 513 (12 units)
- Complementary Studies General: 6 units

---

## Build Notes
*(appended at Stage 02 gate)*

### Happy path
1. User enters a career goal in `GoalInput` and submits
2. `POST /api/plan` loads `program_requirements.json` from disk, builds a cached system prompt (~2500 tokens) containing the full ENSF BSc course catalog, and sends `claude-haiku-4-5` only the goal as the user message
3. Claude returns a JSON plan: `{goal_summary, semesters[], electives_chosen[]}` — semesters ordered by year/term; only electives whose prerequisites are satisfied by the required curriculum are offered
4. `CourseFlow` generates a Mermaid `flowchart TD` string with subgraphs per year (Year 1–4 as outline boxes), passes it to `MermaidChart` for SVG rendering
5. Sidebar shows: goal summary, compact re-search input, category filters, elective rationale panel

### Key decisions made during build
- **Data pipeline is pre-build, not runtime.** `shared/scripts/parse_program_data.py` produces `data/program_requirements.json` and `data/courses.json`. API reads from disk — no DB.
- **Prompt caching on system message.** Full program data embedded once, cached with `cache_control: {type: "ephemeral"}`. Only goal is volatile per request.
- **CommonJS for `api/plan.js`** — no `"type": "module"` in package.json; Vercel bundles it separately from the Vite ESM frontend.
- **Model changed to `claude-haiku-4-5`** at user request. Prerequisite-gating applied to elective pool so Claude can't choose untakeable courses.
- **Switched from React Flow to Mermaid.** User requested more aesthetic chart + year boxes as outline subgraphs. Mermaid native subgraphs handle year grouping cleanly.
- **Vertical tree, year = depth.** Year 1–4 map to depth levels 1–4. Prerequisite edges flow top-to-bottom. Root node at top.
- **Full-screen sidebar layout.** Sidebar (272px) + canvas (flex:1). GoalInput moves into sidebar after first plan renders.
- **`ENDG` subject code for Digital Engineering** — PDF says "Digital Engineering" but CSV uses `ENDG`. Parser maps correctly.

### What's mocked or fragile
- **Complementary general electives** use placeholder `GENL 1XX` — "Untitled Requirement Set" in PDF didn't resolve.
- **JSON parse from model** — regex extraction before `JSON.parse`; fails gracefully with 500.
- **Prerequisite edges** — parsed from CSV description text via regex; OR-chains and conditional prereqs may be missing or wrong.
- **UCalgary.ca design pass not applied** — brand tokens set, full design pending.
- **`MOCK_PLAN=1` env flag** — set in `.env` to skip Anthropic API calls during dev; `buildMockPlan()` in `api/plan.js`.

### Architecture update (2026-05-02 session 2)
- **Mermaid dropped entirely.** `mermaid` package removed from `package.json`; `MermaidChart.jsx` deleted.
- **`CoursePlanGrid.jsx` + `CoursePlanGrid.css`** — strict wireframe grid: Program header → Year section boxes → Fall/Winter term rows → CSS `grid` with `max(4, maxRowCount)` equal columns; empty slots shown as dashed placeholders; courses styled by category.
- **`ZoomPanShell.jsx`** — extracted reusable zoom/pan wrapper (pointer capture, wheel zoom-to-cursor, fit-to-canvas via `ResizeObserver` on both outer and inner). Replaces the pan/zoom logic that was baked into `MermaidChart.jsx`.
- **`CourseFlow.jsx`** rewritten to import `ZoomPanShell` + `CoursePlanGrid`; `buildDiagram` removed. `zoomFitKey` derived from plan + active filters so fit triggers on data or filter changes.
- Build passes clean: `vite build` → 152 kB JS bundle, no errors, no lints.

### Architecture update (2026-05-02 session 3)
- **Drag and zoom removed from `ZoomPanShell`.** All pointer event listeners, wheel handler, zoom state, pan state, and controls (buttons, hint) stripped out. `ZoomPanShell` is now a read-only auto-fit wrapper.
- **Auto-fit with centering.** `fitContent` (called once on mount + `ResizeObserver`) computes a scale to fill the container and a `translateX` offset to center the grid horizontally. `transform: translateX(${x}px) scale(${scale})` applied to `mc-viewport`. Capped at 1× (never upscales).
- **`zoomFitKey` + `useMemo` removed from `CourseFlow`.** No longer needed without interactive zoom.
- **Leftover drag CSS removed** from `MermaidChart.css` (`cursor: grab`, `cursor: grabbing`, `user-select`, `touch-action`).

---

## Pitch Angle
*(appended at Stage 03 gate)*

### Hook (one sentence)


### Before / After framing


### 60-second version outline


### 3-minute version outline
