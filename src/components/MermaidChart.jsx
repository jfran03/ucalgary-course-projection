import { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";
import "./MermaidChart.css";

mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  flowchart: { curve: "monotoneX", padding: 20 },
  themeVariables: {
    fontFamily: "Roboto, sans-serif",
    fontSize: "12px",
    lineColor: "#c4c4c4",
  },
});

export default function MermaidChart({ diagram }) {
  const elRef  = useRef(null);
  const [err,  setErr]  = useState(null);
  const [zoom, setZoom] = useState(0.8);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos  = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!diagram || !elRef.current) return;
    setErr(null);
    console.log("[Mermaid] diagram:\n", diagram);

    const el = elRef.current;
    el.removeAttribute("data-processed");
    el.textContent = diagram;

    mermaid.run({ nodes: [el], suppressErrors: false })
      .then(() => {
        // mermaid.run replaces textContent with SVG in-place
        const svg = el.querySelector("svg");
        if (svg) {
          svg.removeAttribute("width");
          svg.removeAttribute("height");
          svg.style.maxWidth = "none";
        }
      })
      .catch((e) => {
        // Mermaid parse errors are objects with a .str property
        const msg = e?.str || e?.message || JSON.stringify(e) || String(e);
        console.error("[Mermaid] render error:", msg);
        setErr(msg);
      });
  }, [diagram]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.15, Math.min(3, z * (e.deltaY > 0 ? 0.92 : 1.09))));
  }, []);

  const onMouseDown = useCallback((e) => {
    dragging.current = true;
    lastPos.current  = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    setPan((p) => ({
      x: p.x + e.clientX - lastPos.current.x,
      y: p.y + e.clientY - lastPos.current.y,
    }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const stopDrag = useCallback(() => { dragging.current = false; }, []);

  if (err) {
    return (
      <div className="mc-error">
        <p>Diagram error — see browser console for the diagram string.</p>
        <pre>{err}</pre>
      </div>
    );
  }

  return (
    <div
      className="mc-outer"
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={stopDrag}
      onMouseLeave={stopDrag}
    >
      <div
        className="mc-viewport"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "top left",
        }}
      >
        {/* mermaid.run() replaces this element's content in-place */}
        <div ref={elRef} className="mc-diagram" />
      </div>

      <div className="mc-controls">
        <button className="mc-btn" onClick={() => setZoom((z) => Math.min(3, z * 1.15))}>+</button>
        <button className="mc-btn" onClick={() => { setZoom(0.8); setPan({ x: 0, y: 0 }); }}>⟳</button>
        <button className="mc-btn" onClick={() => setZoom((z) => Math.max(0.15, z * 0.87))}>−</button>
      </div>

      <div className="mc-hint">Scroll to zoom · Drag to pan</div>
    </div>
  );
}
