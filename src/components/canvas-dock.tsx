"use client";

import { useEffect, useRef, type ReactNode, type PointerEvent } from "react";

/** Inspired by the distance falloff in 21st/Motion Primitives' Dock.
 * Only the artwork moves: labels, focus rings and hit targets stay put.
 */
export function CanvasDock({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useRef(true);
  const reset = () => root.current?.querySelectorAll<HTMLElement>(".tool-art").forEach(icon => {
    icon.style.removeProperty("--tool-lift");
    icon.style.removeProperty("--tool-scale");
  });
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reduced.current = preference.matches; if (preference.matches) reset(); };
    update(); preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  const reactToPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (reduced.current || event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    root.current?.querySelectorAll<HTMLButtonElement>(":scope > button").forEach(button => {
      const rect = button.getBoundingClientRect();
      const proximity = Math.max(0, 1 - Math.abs(event.clientX - rect.x - rect.width / 2) / 95);
      const icon = button.querySelector<HTMLElement>(".tool-art");
      icon?.style.setProperty("--tool-lift", `${-5 * proximity}px`);
      icon?.style.setProperty("--tool-scale", String(1 + .12 * proximity));
    });
  };
  return <div ref={root} className="canvas-dock canvas-overlay" role="group" aria-label="Canvas tools" onPointerMove={reactToPointer} onPointerLeave={reset} onPointerCancel={reset}>{children}</div>;
}
