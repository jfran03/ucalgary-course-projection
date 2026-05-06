import React, { useEffect } from "react";
import coursesData from "../../data/courses.json";
import "./CourseModal.css";

const CATEGORY_LABEL = {
  required:      "Required",
  elective:      "Technical Elective",
  capstone:      "Capstone",
  complementary: "Complementary Studies",
};

function getYear(catalogNumber) {
  const n = parseInt(catalogNumber, 10);
  if (n < 300) return 1;
  if (n < 400) return 2;
  if (n < 500) return 3;
  return 4;
}

function collectAll(codes, result = new Map(), depth = 0) {
  if (depth > 10) return result;
  for (const code of codes) {
    if (result.has(code)) continue;
    const c = coursesData[code];
    if (!c) continue;
    result.set(code, c);
    collectAll(c.prerequisites || [], result, depth + 1);
  }
  return result;
}

export default function CourseModal({ course, onClose, onCourseClick }) {
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const directPrereqs = new Set(course.prerequisites || []);
  const allPrereqs = collectAll(course.prerequisites || []);

  const byYear = {};
  for (const [, c] of allPrereqs) {
    const year = getYear(c.catalog_number);
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(c);
  }
  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  const hasChain = years.length > 0;

  return (
    <div className="cm-backdrop" onClick={onClose}>
      <div
        className={`cm-panel${hasChain ? " cm-panel--wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="cm-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="cm-body">

          {/* ── Left: course detail ── */}
          <div className="cm-detail">
            <div className="cm-top">
              <span className="cm-code">{course.code}</span>
              {course.category && (
                <span className={`cm-badge cm-badge--${course.category}`}>
                  {CATEGORY_LABEL[course.category] ?? course.category}
                </span>
              )}
            </div>

            <h2 className="cm-title">{course.title}</h2>

            {course.units != null && (
              <p className="cm-units">{course.units} credit units</p>
            )}

            {course.description && (
              <div className="cm-section">
                <div className="cm-section-label">Description</div>
                <p className="cm-description">{course.description}</p>
              </div>
            )}

            {!hasChain && course.prerequisites?.length > 0 && (
              <div className="cm-section">
                <div className="cm-section-label">Prerequisites</div>
                <div className="cm-prereqs">
                  {course.prerequisites.map((p) => {
                    const detail = coursesData[p];
                    return detail ? (
                      <button
                        key={p}
                        className="cm-prereq-pill cm-prereq-pill--link"
                        onClick={() => onCourseClick?.({ ...detail })}
                      >
                        {p}
                      </button>
                    ) : (
                      <span key={p} className="cm-prereq-pill">{p}</span>
                    );
                  })}
                </div>
              </div>
            )}

            {!course.description && !course.prerequisites?.length && (
              <p className="cm-no-data">No additional details available for this course.</p>
            )}
          </div>

          {/* ── Right: prereq chain ── */}
          {hasChain && (
            <div className="cm-chain">
              <div className="cm-chain-heading">Prerequisite Chain</div>
              <div className="cm-chain-flow">
                {years.map((year, yi) => (
                  <React.Fragment key={year}>
                    <div className="cm-chain-year-row">
                      <div className="cm-chain-year-box">
                        <div className="cm-chain-grid">
                          {byYear[year].map((c) => (
                            <button
                              key={c.code}
                              className={`cm-chain-card${directPrereqs.has(c.code) ? " cm-chain-card--direct" : ""}`}
                              onClick={() => onCourseClick?.({ ...c })}
                            >
                              <span className="cm-chain-code">{c.code}</span>
                              <span className="cm-chain-title">{c.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="cm-chain-year-label">YEAR {year}</div>
                    </div>
                    {yi < years.length - 1 && (
                      <div className="cm-chain-arrow-row">
                        <span className="cm-chain-arrow">↓</span>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
