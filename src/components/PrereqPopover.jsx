import React, { useEffect } from "react";
import coursesData from "../../data/courses.json";
import "./PrereqPopover.css";

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

export default function PrereqPopover({ course, position, onClose, onNavigate }) {
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

  return (
    <>
      <div className="pp-backdrop" onClick={onClose} />
      <div
        className="pp-panel"
        style={{ top: position.y, left: position.x }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="pp-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="pp-header">
          <span className="pp-header-code">{course.code}</span>
          <span className="pp-header-title">{course.title}</span>
        </div>

        {years.length === 0 ? (
          <p className="pp-empty">No prerequisites found in catalog.</p>
        ) : (
          <div className="pp-chain">
            {years.map((year, yi) => (
              <React.Fragment key={year}>
                <div className="pp-year-row">
                  <div className="pp-year-box">
                    <div className="pp-courses-grid">
                      {byYear[year].map((c) => (
                        <button
                          key={c.code}
                          className={`pp-card${directPrereqs.has(c.code) ? " pp-card--direct" : ""}`}
                          onClick={() => onNavigate({ ...c })}
                        >
                          <span className="pp-card-code">{c.code}</span>
                          <span className="pp-card-title">{c.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pp-year-label">YEAR {year}</div>
                </div>
                {yi < years.length - 1 && (
                  <div className="pp-arrow-row">
                    <span className="pp-arrow">↓</span>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
