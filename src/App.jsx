import { useState } from "react";
import GoalInput from "./components/GoalInput";
import CourseFlow from "./components/CourseFlow";
import "./App.css";

export default function App() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(goal) {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }
      const { plan } = await res.json();
      setPlan(plan);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="header-logo">UCalgary</span>
        <h1 className="header-title">Course Projection</h1>
        <p className="header-subtitle">Software Engineering BSc</p>
      </header>

      {plan ? (
        <CourseFlow
          plan={plan}
          onSearch={handleSubmit}
          loading={loading}
          error={error}
        />
      ) : (
        <main className="app-landing">
          <div className="landing-inner">
            <GoalInput onSubmit={handleSubmit} loading={loading} />
            {error && <div className="error-banner">{error}</div>}
            {loading && (
              <div className="loading-state">
                <div className="spinner" />
                <p>Building your 4-year plan…</p>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
