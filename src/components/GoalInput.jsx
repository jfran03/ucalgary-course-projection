import { useState } from "react";
import "./GoalInput.css";

const EXAMPLES = [
  "I want to work in AI and machine learning",
  "I want to build mobile and web apps",
  "I want to work in embedded systems and robotics",
  "I want to do cybersecurity and systems programming",
];

export default function GoalInput({ onSubmit, loading, compact = false }) {
  const [goal, setGoal] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = goal.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  }

  if (compact) {
    return (
      <form className="goal-compact" onSubmit={handleSubmit}>
        <label className="compact-label">Change goal</label>
        <textarea
          className="goal-input goal-input--compact"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Describe your career goal…"
          rows={3}
          disabled={loading}
        />
        <button
          className="goal-submit goal-submit--compact"
          type="submit"
          disabled={!goal.trim() || loading}
        >
          {loading ? "Generating…" : "Rebuild Plan →"}
        </button>
      </form>
    );
  }

  return (
    <section className="goal-section">
      <h2 className="goal-heading">What do you want to be good at when you graduate?</h2>
      <p className="goal-hint">
        Describe your career goal or area of interest — we'll build a personalized
        4-year course plan for Software Engineering at UCalgary.
      </p>

      <form className="goal-form" onSubmit={handleSubmit}>
        <textarea
          className="goal-input"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. I want to work in AI/ML and build intelligent systems…"
          rows={3}
          disabled={loading}
        />
        <button
          className="goal-submit"
          type="submit"
          disabled={!goal.trim() || loading}
        >
          {loading ? "Generating…" : "Build My Plan →"}
        </button>
      </form>

      <div className="examples">
        <span className="examples-label">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            className="example-chip"
            onClick={() => setGoal(ex)}
            disabled={loading}
          >
            {ex}
          </button>
        ))}
      </div>
    </section>
  );
}
