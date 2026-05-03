import { useState } from "react";
import ZoomPanShell from "./ZoomPanShell";
import CoursePlanGrid from "./CoursePlanGrid";
import CourseModal from "./CourseModal";
import GoalInput from "./GoalInput";
import "./CourseFlow.css";

const FILTER_CATEGORIES = ["required", "elective", "capstone", "complementary"];

export default function CourseFlow({ plan, onSearch, loading, error }) {
  const [activeFilters, setActiveFilters] = useState(new Set(FILTER_CATEGORIES));
  const [selectedCourse, setSelectedCourse] = useState(null);

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

        <div className="sidebar-disclaimer">
          Results are prospective only. Please do your own research and consult with an academic advisor before making enrollment decisions.
        </div>
      </aside>

      <div className="flow-canvas">
        <ZoomPanShell>
          <CoursePlanGrid
            plan={plan}
            activeFilters={activeFilters}
            onCourseClick={(course) => setSelectedCourse(course)}
          />
        </ZoomPanShell>
      </div>

      {selectedCourse && (
        <CourseModal
          course={selectedCourse}
          onClose={() => setSelectedCourse(null)}
          onCourseClick={setSelectedCourse}
        />
      )}
    </div>
  );
}
