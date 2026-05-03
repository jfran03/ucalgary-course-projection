import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./MermaidChart.css";

/** Scales content to fit the container, centered horizontally. No interactive zoom or pan. */
export default function ZoomPanShell({ children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [transform, setTransform] = useState({ scale: 1, x: 0 });

  const fitContent = () => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const cr = outer.getBoundingClientRect();
    if (!cr.width || !cr.height) return;
    const iw = inner.scrollWidth;
    const ih = inner.scrollHeight;
    if (!iw || !ih) return;
    const pad = 40;
    const scale = Math.max(0.2, Math.min((cr.width - pad) / iw, (cr.height - pad) / ih, 1));
    const x = Math.max((cr.width - iw * scale) / 2, 16);
    setTransform({ scale, x });
  };

  useLayoutEffect(() => { fitContent(); }, []);

  useEffect(() => {
    const ro = new ResizeObserver(fitContent);
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="mc-outer">
      <div
        className="mc-viewport"
        style={{
          transform: `translateX(${transform.x}px) scale(${transform.scale})`,
          transformOrigin: "top left",
        }}
      >
        <div ref={innerRef} className="mc-diagram mc-diagram--grid">
          {children}
        </div>
      </div>
    </div>
  );
}
