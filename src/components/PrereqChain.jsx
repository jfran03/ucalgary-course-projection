import React from "react";
import coursesData from "../../data/courses.json";
import "./PrereqChain.css";

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

export default function PrereqChain({ rootCourse, onCourseClick }) {
  // Collect all prereqs AND the root course itself
  const allCourses = collectAll(rootCourse.prerequisites || []);

  if (allCourses.size === 0) {
    return (
      <div className="prc-empty">
        <p>No prerequisite data found.</p>
      </div>
    );
  }

  // Add the root course to the chain (shown highlighted on the right)
  const rootDetail = coursesData[rootCourse.code];
  if (rootDetail) allCourses.set(rootCourse.code, rootDetail);

  // Group by year
  const byYear = {};
  for (const [, course] of allCourses) {
    const year = getYear(course.catalog_number);
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(course);
  }

  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);

  return (
    <div className="prc-root">
      <div className="prc-heading">Prerequisite Chain</div>
      <div className="prc-columns">
        {years.map((year, yi) => (
          <React.Fragment key={year}>
            <div className="prc-year-col">
              <div className="prc-year-label">Year {year}</div>
              <div className="prc-nodes">
                {byYear[year].map((course) => {
                  const isRoot = course.code === rootCourse.code;
                  return (
                    <button
                      key={course.code}
                      className={`prc-node${isRoot ? " prc-node--root" : ""}`}
                      onClick={() => !isRoot && onCourseClick?.({ ...course })}
                      style={isRoot ? { cursor: "default" } : undefined}
                    >
                      <span className="prc-node-code">{course.code}</span>
                      <span className="prc-node-title">{course.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {yi < years.length - 1 && (
              <div className="prc-arrow" aria-hidden>→</div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
