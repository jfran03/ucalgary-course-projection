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

// All codes in the required curriculum — used to gate elective eligibility.
const REQUIRED_CODES = new Set([
  ...programData.year_1.required.map((c) => c.code),
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

  const yr1 = programData.year_1.required.map(
    (c) => `${c.code}: ${c.title} (${c.units}u)`
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

  return `You are an academic advisor for the University of Calgary Software Engineering BSc program. Your job is to build a personalized 4-year course plan based on a student's career goal.

PROGRAM: Bachelor of Science (BSc) in Software Engineering — UCalgary

YEAR 1 REQUIRED COURSES (common to all Engineering):
${yr1.join("\n")}
Plus: 3 units General Complementary Studies (200-level English)

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
- Assign ALL required courses to semesters using prerequisite chains (take prereqs before courses that need them)
- Year 1 courses fill Year 1 Fall + Winter (5 courses per term, 15u)
- Typical load: 5 courses / 15 units per semester
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
      "year": 1,
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

/** Deterministic plan from program JSON — no LLM. For local UI / Mermaid testing. */
function buildMockPlan(goal) {
  const rows = [];
  const seen = new Set();

  function pushRow(course, category) {
    if (!course?.code || seen.has(course.code)) return;
    seen.add(course.code);
    rows.push({ course, category });
  }

  for (const c of programData.year_1.required) pushRow(c, "required");
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
    return res.status(200).json({ plan: buildMockPlan(goal.trim()) });
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

  return res.status(200).json({ plan });
};
