const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");
const fs = require("fs");

const client = new Anthropic.default({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DATA_DIR = path.join(__dirname, "..", "data");
const programData = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, "program_requirements.json"), "utf8")
);

// Year 1 is fixed by the institution — students cannot reorder these.
// Server always injects this block; Claude never receives or produces Year 1.
const YEAR_1_COURSE_ORDER = {
  Fall:   ["MATH 275", "ENDG 233", "MATH 211", "ENGG 225", "ENGG 204"],
  Winter: ["MATH 277", "ENGG 202", "PHYS 259", "ENGG 212", "ENGG 200"],
};

// Build lookup from programData, remapping DIGE 233 → ENDG 233 (PDF artifact).
const _yr1Lookup = {};
for (const c of programData.year_1.required) {
  const code = c.code === "DIGE 233" ? "ENDG 233" : c.code;
  _yr1Lookup[code] = { ...c, code };
}

const YEAR_1_FIXED = ["Fall", "Winter"].map((term) => ({
  year: 1,
  term,
  courses: YEAR_1_COURSE_ORDER[term].map((code) => {
    const d = _yr1Lookup[code] ?? { code, title: "", units: 3, prerequisites: [] };
    return { code: d.code, title: d.title, units: d.units, category: "required", rationale: null, prerequisites: [] };
  }),
}));

// All codes in the required curriculum — used to gate elective eligibility.
// Year 1 codes use the corrected ENDG 233 key.
const REQUIRED_CODES = new Set([
  ...YEAR_1_FIXED.flatMap((sem) => sem.courses.map((c) => c.code)),
  ...programData.required.map((c) => c.code),
]);

// Only offer electives whose prerequisites are fully satisfied by the
// required curriculum. Prevents Claude from choosing untakeable courses.
const AVAILABLE_ELECTIVES = programData.technical_electives.pool.filter(
  (course) =>
    !course.prerequisites?.length ||
    course.prerequisites.every((p) => REQUIRED_CODES.has(p))
);

function buildSystemPrompt() {
  const required = programData.required.map(
    (c) =>
      `${c.code}: ${c.title} (${c.units}u)${c.prerequisites.length ? ` | prereqs: ${c.prerequisites.join(", ")}` : ""}`
  );

  const electivePool = AVAILABLE_ELECTIVES.map((c) => {
    const prereqNote = c.prerequisites?.length
      ? ` | prereqs: ${c.prerequisites.join(", ")}`
      : "";
    const desc = c.description.split("\n")[0].slice(0, 120);
    return `${c.code}: ${c.title}${prereqNote} — ${desc}`;
  });

  const compSpecified = programData.complementary_specified.required.map(
    (c) => `${c.code}: ${c.title} (${c.units}u)`
  );

  return `You are an academic advisor for the University of Calgary Software Engineering BSc program. Your job is to build a personalized Years 2–4 course plan based on a student's career goal.

PROGRAM: Bachelor of Science (BSc) in Software Engineering — UCalgary

NOTE: Year 1 is fixed by the institution and will be added automatically. Do NOT include any Year 1 courses or semesters in your output. Your plan starts at Year 2.

YEARS 2–4 REQUIRED COURSES (all must be scheduled):
${required.join("\n")}

REQUIRED CHOICES (pick one per group):
- Physics elective (3u): PHYS 365 or PHYS 369
- Capstone project (6u): ENEL 500  OR  ENGG 503+504  OR  ENGG 501+502

TECHNICAL ELECTIVE POOL — all prerequisites already met by the required curriculum (choose exactly 4, 12 units total):
${electivePool.join("\n")}

COMPLEMENTARY STUDIES — Specified (12u total):
${compSpecified.join("\n")}
- Plus ONE of: ENGG 213 or COMS 363

COMPLEMENTARY STUDIES — General (6u):
- 2 courses from approved non-Engineering list (use placeholder code GENL 1XX)

RULES:
- Output semesters for Years 2, 3, and 4 only
- Assign ALL required courses using prerequisite chains (take prereqs before the courses that need them)
- Each semester must have exactly 5 courses (15 units). Never exceed 5 courses in a single semester.
- Choose exactly 4 technical electives from the pool above that best align with the student's goal
- category values: "required" | "elective" | "capstone" | "complementary"
- rationale: null for required courses; a 1–2 sentence string for electives explaining why it fits the goal
- prerequisites: list of course codes (from this plan) that are direct prerequisites of each course

OUTPUT: valid JSON only — no markdown, no explanation outside the JSON object.`;
}

const SYSTEM_PROMPT = buildSystemPrompt();

const RESPONSE_SCHEMA = `{
  "goal_summary": "one-sentence restatement of the student's goal",
  "semesters": [
    {
      "year": 2,
      "term": "Fall",
      "courses": [
        {
          "code": "SUBJ NNN",
          "title": "Course Title",
          "units": 3,
          "category": "required",
          "rationale": null,
          "prerequisites": ["SUBJ NNN"]
        }
      ]
    }
  ],
  "electives_chosen": [
    {
      "code": "ENSF NNN",
      "title": "Course Title",
      "units": 3,
      "rationale": "Why this course fits the student's goal"
    }
  ]
}`;

/** Prepend the fixed Year 1 semesters; drop any Year 1 the model may have produced. */
function injectYear1(plan) {
  plan.semesters = [
    ...YEAR_1_FIXED,
    ...plan.semesters.filter((s) => s.year !== 1),
  ];
  return plan;
}

const TERM_ORDER = ["Fall", "Winter", "Spring", "Summer"];
const MAX_COURSES_PER_SEMESTER = 5;

/**
 * Cap each semester at 5 courses. Overflow spills forward to the next
 * semester in chronological order; if none exists, a new one is created.
 * Year 1 semesters are skipped — they are already fixed.
 */
function enforceLoadLimits(plan) {
  plan.semesters.sort((a, b) =>
    a.year !== b.year ? a.year - b.year : TERM_ORDER.indexOf(a.term) - TERM_ORDER.indexOf(b.term)
  );

  for (let i = 0; i < plan.semesters.length; i++) {
    const sem = plan.semesters[i];
    if (sem.year === 1) continue; // Year 1 is fixed and already exactly 5+5

    if (sem.courses.length <= MAX_COURSES_PER_SEMESTER) continue;

    const overflow = sem.courses.splice(MAX_COURSES_PER_SEMESTER);
    const next = plan.semesters[i + 1];
    if (next && next.year !== 1) {
      next.courses.unshift(...overflow);
    } else {
      // Create a new semester after this one to absorb overflow
      const nextTerm = TERM_ORDER[(TERM_ORDER.indexOf(sem.term) + 1) % 2]; // Fall↔Winter
      const nextYear = nextTerm === "Fall" ? sem.year + 1 : sem.year;
      plan.semesters.splice(i + 1, 0, { year: nextYear, term: nextTerm, courses: overflow });
    }
  }

  return plan;
}

/** Deterministic plan from program JSON — no LLM. For local UI / Mermaid testing. */
function buildMockPlan(goal) {
  const rows = [];
  const seen = new Set();

  function pushRow(course, category) {
    if (!course?.code || seen.has(course.code)) return;
    seen.add(course.code);
    rows.push({ course, category });
  }

  for (const sem of YEAR_1_FIXED) {
    for (const c of sem.courses) pushRow(c, "required");
  }
  for (const c of programData.required) pushRow(c, "required");

  const physOptions = programData.required_choice?.[0]?.options;
  if (physOptions?.[0]) pushRow(physOptions[0], "required");

  const capOptions = programData.required_choice?.[1]?.options?.[0]?.[0];
  if (capOptions) pushRow(capOptions, "capstone");

  const electivesPicked = AVAILABLE_ELECTIVES.slice(0, 4);
  for (const c of electivesPicked) pushRow(c, "elective");

  for (const c of programData.complementary_specified.required) {
    pushRow(c, "complementary");
  }
  const compPick = programData.complementary_specified.choice?.[0]?.options?.[0];
  if (compPick) pushRow(compPick, "complementary");

  pushRow(
    {
      code: "GENL 1XX",
      title: "General Complementary (placeholder)",
      units: 3,
      prerequisites: [],
    },
    "complementary"
  );
  pushRow(
    {
      code: "GENL 2XX",
      title: "General Complementary (placeholder)",
      units: 3,
      prerequisites: [],
    },
    "complementary"
  );

  const allCodes = new Set(rows.map((r) => r.course.code));
  const TERMS = ["Fall", "Winter"];
  const semesters = [];
  let year = 1;
  let termIdx = 0;

  for (let i = 0; i < rows.length; i += 5) {
    const chunk = rows.slice(i, i + 5);
    const courses = chunk.map(({ course, category }) => ({
      code: course.code,
      title: course.title,
      units: course.units,
      category,
      rationale:
        category === "elective"
          ? "Mock technical elective for offline UI testing."
          : null,
      prerequisites: (course.prerequisites || []).filter((p) =>
        allCodes.has(p)
      ),
    }));
    semesters.push({
      year,
      term: TERMS[termIdx % 2],
      courses,
    });
    termIdx += 1;
    if (termIdx % 2 === 0) year += 1;
  }

  return {
    goal_summary: `Offline mock plan (no API): ${goal.slice(0, 140)}`,
    semesters,
    electives_chosen: rows
      .filter((r) => r.category === "elective")
      .map((r) => ({
        code: r.course.code,
        title: r.course.title,
        units: r.course.units,
        rationale: "Picked for local testing without Anthropic.",
      })),
  };
}

const SKIP_LLM =
  process.env.MOCK_PLAN === "1" || process.env.UCALGARY_MOCK_PLAN === "1";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { goal } = req.body ?? {};
  if (!goal?.trim()) {
    return res.status(400).json({ error: "goal is required" });
  }

  if (SKIP_LLM) {
    console.warn("[api/plan] MOCK_PLAN active — skipping Anthropic (buildMockPlan)");
    return res.status(200).json({ plan: enforceLoadLimits(injectYear1(buildMockPlan(goal.trim()))) });
  }

  const userMessage = `Student goal: ${goal.trim()}

Build a complete 4-year Software Engineering course plan for this student.
Return ONLY a JSON object matching this schema:
${RESPONSE_SCHEMA}`;

  let text;
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    text = response.content.find((b) => b.type === "text")?.text ?? "";
  } catch (err) {
    console.error("Anthropic error:", err.message);
    return res
      .status(502)
      .json({ error: "Failed to generate plan. Please try again." });
  }

  let plan;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    plan = JSON.parse(match ? match[0] : text);
  } catch {
    console.error("JSON parse error. Raw response:", text.slice(0, 500));
    return res
      .status(500)
      .json({ error: "Invalid response from model. Please try again." });
  }

  return res.status(200).json({ plan: enforceLoadLimits(injectYear1(plan)) });
};
