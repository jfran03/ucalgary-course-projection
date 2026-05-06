# UCalgary Course Projection

## Motivation

Two things pushed me to build this:

1. **UCalgary doesn't show you when courses will actually be taken.** The course calendar is a wall of text — prerequisites are buried in descriptions, and there's no way to see a full 4-year sequence at a glance. As a student, you're left manually cross-referencing PDFs and hoping you haven't missed a dependency that delays your graduation.

2. **I wanted to learn how the AI SDK works in practice.** I'd read the docs but hadn't built something end-to-end with it. This project forced me to work through prompt caching, structured JSON output, and wiring a real Claude API call into a serverless backend.

---

## What It Does

You type in a career goal (e.g. "I want to work in AI/ML") and the app generates a personalized 4-year course plan for UCalgary Software Engineering. Required courses are locked in; technical electives and complementary studies are chosen and rationalized by Claude to match your goal. The result renders as a grid organized by year and semester.

Clicking any course opens a modal with the course description, units, and a full prerequisite chain grouped by year level.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite |
| Backend | Vercel serverless functions (`/api`) |
| AI | Claude (`claude-haiku-4-5`) via Anthropic SDK |
| Data | Static JSON pre-processed from UCalgary PDFs + course catalog CSV |
| Deployment | Vercel |

---

## How It Works

1. A Python script (`shared/scripts/parse_program_data.py`) scrapes program requirement PDFs and the UCalgary course catalog CSV into two static JSON files: `data/courses.json` and `data/program_requirements.json`. This runs once at build time — it's not a runtime dependency.

2. On submit, the frontend POSTs the user's goal to `/api/plan`. The handler builds a system prompt containing the full ENSF BSc course catalog (prompt-cached so only the goal is re-sent each request), calls Claude, and returns a structured JSON plan.

3. Year 1 is injected server-side from a fixed constant — it's always the same two semesters regardless of what Claude produces. Semester load is capped at 5 courses, with overflow cascading forward.

4. The frontend renders the plan as a CSS grid: program header → year sections → Fall/Winter term rows → course cards styled by category.

---

## Running Locally

```bash
npm install
```

Create a `.env` file:

```
ANTHROPIC_API_KEY=your_key_here
```

To skip API calls during development:

```
MOCK_PLAN=1
```

Then:

```bash
npm run dev
```

The Vercel dev server proxies `/api` automatically via `vercel.json`.
