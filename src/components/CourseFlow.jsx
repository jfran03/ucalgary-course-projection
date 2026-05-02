import { useMemo, useState } from "react";
import MermaidChart from "./MermaidChart";
import GoalInput from "./GoalInput";
import "./CourseFlow.css";

const TERM_ORDER = ["Fall", "Winter", "Spring", "Summer"];
const CAT_CLASS  = {
  required: "required",
  elective: "elective",
  capstone: "capstone",
  complementary: "comp",
};

// Strip characters that confuse Mermaid's parser inside node labels
function safeLabel(str) {
  return str
    .replace(/"/g, "'")   // no double-quotes inside labels
    .replace(/:/g, " -")  // colons break the parser
    .replace(/[<>]/g, "") // angle brackets break htmlLabels
    .slice(0, 36);
}

// ── Diagram builder ────────────────────────────────────────────
function buildDiagram(plan, activeFilters) {
  const lines = [
    "flowchart TD",
    // Stripped-down classDef — only fill/stroke; font-* and color are unreliable
    "  classDef required    fill:#fff0f0,stroke:#cc0000,stroke-width:2px",
    "  classDef elective    fill:#eff6ff,stroke:#2563eb,stroke-width:2px",
    "  classDef capstone    fill:#f5f3ff,stroke:#7c3aed,stroke-width:2px",
    "  classDef comp        fill:#ecfdf5,stroke:#059669,stroke-width:2px",
    "  classDef root        fill:#cc0000,stroke:#990000,stroke-width:2px",
    // Root — plain rectangle, no special shape characters
    '  ROOT["Software Engineering BSc"]',
    "  class ROOT root",
  ];

  // Group by year → term
  const byYear = {};
  const inPlan = new Set();
  for (const sem of plan.semesters) {
    if (!byYear[sem.year]) byYear[sem.year] = {};
    byYear[sem.year][sem.term] = sem.courses;
    for (const c of sem.courses) inPlan.add(c.code);
  }

  const codeToId     = {};
  const classAssigns = [];
  const edgeLines    = [];
  const addedEdges   = new Set();

  // Subgraph per year — space before [ is required by Mermaid parser
  for (const year of Object.keys(byYear).sort()) {
    lines.push(`  subgraph Y${year} ["Year ${year}"]`);

    for (const term of TERM_ORDER) {
      const courses = byYear[year][term] || [];
      for (const course of courses) {
        if (!activeFilters.has(course.category)) continue;

        const id    = `N${course.code.replace(/\s+/g, "")}`;
        codeToId[course.code] = id;

        const title = safeLabel(
          course.title.length > 30 ? course.title.slice(0, 28) + "..." : course.title
        );

        lines.push(`    ${id}["${course.code} - ${title}"]`);
        classAssigns.push(`  class ${id} ${CAT_CLASS[course.category] ?? "required"}`);
      }
    }

    lines.push("  end");
  }

  lines.push(...classAssigns);

  // Edges
  for (const sem of plan.semesters) {
    for (const course of sem.courses) {
      if (!activeFilters.has(course.category)) continue;
      const targetId = codeToId[course.code];
      if (!targetId) continue;

      const prereqs = (course.prerequisites || []).filter(
        (p) => inPlan.has(p) && codeToId[p]
      );

      if (prereqs.length === 0 && sem.year === 1) {
        const e = `ROOT --> ${targetId}`;
        if (!addedEdges.has(e)) { addedEdges.add(e); edgeLines.push(`  ${e}`); }
      }

      for (const prereq of prereqs) {
        const sourceId = codeToId[prereq];
        if (!sourceId) continue;
        const e = `${sourceId} --> ${targetId}`;
        if (!addedEdges.has(e)) { addedEdges.add(e); edgeLines.push(`  ${e}`); }
      }
    }
  }

  lines.push(...edgeLines);
  return lines.join("\n");
}

// ── Component ──────────────────────────────────────────────────
const FILTER_CATEGORIES = ["required", "elective", "capstone", "complementary"];

export default function CourseFlow({ plan, onSearch, loading, error }) {
  const [activeFilters, setActiveFilters] = useState(new Set(FILTER_CATEGORIES));

  const diagram = useMemo(
    () => buildDiagram(plan, activeFilters),
    [plan, activeFilters]
  );

  function toggleFilter(cat) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  return (
    <div className="flow-layout">
      <aside className="flow-sidebar">
        <div className="sidebar-section sidebar-section--goal">
          <div className="sidebar-goal-summary">{plan.goal_summary}</div>
          <GoalInput onSubmit={onSearch} loading={loading} compact />
          {error && <div className="sidebar-error">{error}</div>}
          {loading && (
            <div className="sidebar-loading">
              <div className="spinner spinner--sm" />
              <span>Rebuilding…</span>
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Show</div>
          <div className="sidebar-filters">
            {FILTER_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`filter-btn filter-btn--${cat} ${activeFilters.has(cat) ? "active" : ""}`}
                onClick={() => toggleFilter(cat)}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {plan.electives_chosen?.length > 0 && (
          <div className="sidebar-section">
            <div className="sidebar-label">Chosen Electives</div>
            <div className="electives-list">
              {plan.electives_chosen.map((e) => (
                <div key={e.code} className="elective-item">
                  <div className="elective-code">{e.code}</div>
                  <div className="elective-title">{e.title}</div>
                  <div className="elective-rationale">{e.rationale}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className="flow-canvas">
        <MermaidChart diagram={diagram} />
      </div>
    </div>
  );
}
