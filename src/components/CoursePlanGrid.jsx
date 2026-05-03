import { useMemo } from "react";
import coursesData from "../../data/courses.json";
import "./CoursePlanGrid.css";

const TERM_ORDER = ["Fall", "Winter", "Spring", "Summer"];

const CAT_CLASS = {
  required: "cpg-course--required",
  elective: "cpg-course--elective",
  capstone: "cpg-course--capstone",
  complementary: "cpg-course--complementary",
};

function safeLabel(str) {
  return str
    .replace(/"/g, "'")
    .replace(/:/g, " -")
    .replace(/[<>]/g, "")
    .slice(0, 42);
}

/** Strict wireframe layout: Program → Year blocks → Fall/Winter rows → fixed column grid. */
export default function CoursePlanGrid({ plan, activeFilters, onCourseClick }) {
  const { yearsSorted, colCount, yearTerms } = useMemo(() => {
    const byYearTerm = {};
    for (const sem of plan.semesters) {
      if (!byYearTerm[sem.year]) byYearTerm[sem.year] = {};
      if (!byYearTerm[sem.year][sem.term]) byYearTerm[sem.year][sem.term] = [];
      for (const c of sem.courses) {
        byYearTerm[sem.year][sem.term].push(c);
      }
    }

    const yearsSorted = Object.keys(byYearTerm)
      .map((y) => Number(y))
      .sort((a, b) => a - b);

    let maxRow = 0;
    const yearTerms = {};

    for (const year of yearsSorted) {
      const rows = [];
      for (const term of TERM_ORDER) {
        const raw = byYearTerm[year]?.[term] || [];
        const courses = raw.filter((c) => activeFilters.has(c.category));
        if (!courses.length) continue;
        maxRow = Math.max(maxRow, courses.length);
        rows.push({ term, courses });
      }
      if (rows.length) yearTerms[year] = rows;
    }

    const colCount = Math.max(4, maxRow);

    return { yearsSorted: yearsSorted.filter((y) => yearTerms[y]?.length), colCount, yearTerms };
  }, [plan, activeFilters]);

  if (!yearsSorted.length) {
    return (
      <div className="cpg-root cpg-root--empty">
        <p>No courses match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="cpg-root">
      <header className="cpg-program">Software Engineering</header>

      {yearsSorted.map((year) => (
        <section key={year} className="cpg-year">
          <div className="cpg-year-label">Year {year}</div>
          <div className="cpg-year-body">
            {yearTerms[year].map(({ term, courses }) => (
              <div key={`${year}-${term}`} className="cpg-term-row">
                <div className="cpg-term-label">{term}</div>
                <div
                  className="cpg-term-grid"
                  style={{
                    gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: colCount }, (_, i) => {
                    const course = courses[i];
                    if (!course) {
                      return <div key={`e-${i}`} className="cpg-slot cpg-slot--empty" aria-hidden />;
                    }
                    const cat = CAT_CLASS[course.category] ?? CAT_CLASS.required;
                    const title =
                      course.title.length > 40
                        ? `${course.title.slice(0, 38)}…`
                        : course.title;
                    const detail = coursesData[course.code];
                    return (
                      <article
                        key={course.code}
                        className={`cpg-course ${cat}`}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          onCourseClick?.({ ...course, ...detail, category: course.category }, rect);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="cpg-course-code">{course.code}</div>
                        <div className="cpg-course-title">{safeLabel(title)}</div>
                        {course.units != null && (
                          <div className="cpg-course-units">{course.units} units</div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
