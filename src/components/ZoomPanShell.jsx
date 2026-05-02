import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import "./MermaidChart.css";

function eventTargetElement(target) {
  if (!target) return null;
  if (target.nodeType === Node.TEXT_NODE) return target.parentElement;
  return target;
}

/** Zoom / pan wrapper — reuse with any scroll-sized content (CSS grid, SVG, etc.). */
export default function ZoomPanShell({ children, fitKey }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const lastPos = useRef({ x: 0, y: 0 });

  const fitContent = useCallback(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const cr = outer.getBoundingClientRect();
    if (!cr.width || !cr.height) return;
    const iw = inner.scrollWidth;
    const ih = inner.scrollHeight;
    if (!iw || !ih) return;
    const pad = 40;
    const z = Math.min((cr.width - pad) / iw, (cr.height - pad) / ih, 1.35);
    const clamped = Math.max(0.2, Math.min(3, z));
    setZoom(clamped);
    setPan({
      x: Math.max((cr.width - iw * clamped) / 2, 16),
      y: 24,
    });
  }, []);

  useLayoutEffect(() => {
    fitContent();
  }, [fitKey, fitContent]);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer) return;
    const ro = new ResizeObserver(() => fitContent());
    ro.observe(outer);
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [fitContent]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.92 : 1.09;

    setZoom((z0) => {
      const z1 = Math.max(0.15, Math.min(3, z0 * factor));
      if (Math.abs(z1 - z0) < 1e-9) return z0;
      setPan((p) => ({
        x: mx - ((mx - p.x) * z1) / z0,
        y: my - ((my - p.y) * z1) / z0,
      }));
      return z1;
    });
  }, []);

  useEffect(() => {
    const root = outerRef.current;
    if (!root) return;

    let activePid = null;

    const releaseCapture = (pointerId) => {
      try {
        if (pointerId != null && root.hasPointerCapture?.(pointerId)) {
          root.releasePointerCapture(pointerId);
        }
      } catch {
        /* ignore */
      }
      activePid = null;
    };

    const onPointerDown = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const el = eventTargetElement(e.target);
      if (el?.closest?.(".mc-controls")) return;

      activePid = e.pointerId;
      lastPos.current = { x: e.clientX, y: e.clientY };
      try {
        root.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onPointerMove = (e) => {
      if (activePid == null || e.pointerId !== activePid) return;
      if (e.pointerType === "mouse" && (e.buttons & 1) === 0) {
        releaseCapture(e.pointerId);
        return;
      }

      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      if (dx !== 0 || dy !== 0) {
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
      e.preventDefault();
    };

    const onPointerUp = (e) => {
      if (activePid == null || e.pointerId !== activePid) return;
      releaseCapture(e.pointerId);
    };

    const onLostCapture = () => {
      activePid = null;
    };

    root.addEventListener("pointerdown", onPointerDown, { capture: true });
    root.addEventListener("pointermove", onPointerMove, { passive: false });
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("pointercancel", onPointerUp);
    root.addEventListener("lostpointercapture", onLostCapture);

    return () => {
      root.removeEventListener("pointerdown", onPointerDown, { capture: true });
      root.removeEventListener("pointermove", onPointerMove, { passive: false });
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerUp);
      root.removeEventListener("lostpointercapture", onLostCapture);
      if (activePid != null) releaseCapture(activePid);
    };
  }, []);

  return (
    <div ref={outerRef} className="mc-outer" onWheel={onWheel}>
      <div
        className="mc-viewport"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "top left",
        }}
      >
        <div ref={innerRef} className="mc-diagram mc-diagram--grid">
          {children}
        </div>
      </div>

      <div className="mc-controls">
        <button
          type="button"
          className="mc-btn"
          onClick={() => setZoom((z) => Math.min(3, z * 1.15))}
        >
          +
        </button>
        <button type="button" className="mc-btn" onClick={fitContent}>
          ⟳
        </button>
        <button
          type="button"
          className="mc-btn"
          onClick={() => setZoom((z) => Math.max(0.15, z * 0.87))}
        >
          −
        </button>
      </div>

      <div className="mc-hint">Scroll to zoom · Drag to pan</div>
    </div>
  );
}
