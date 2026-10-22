import type { CSSProperties } from "react";
import type { ContributionMark } from "@/lib/client/contribution-feedback";
import { Check } from "./pixel-icons";

const RAYS = [[0, -28], [20, -20], [28, 0], [20, 20], [0, 28], [-20, 20], [-28, 0], [-20, -20]] as const;

/** Lives in world coordinates; CSS counter-scales through --camera-zoom. */
export function ContributionMarkView({ mark }: { mark: ContributionMark }) {
  return (
    <div className={`contribution-mark contribution-mark--${mark.kind}`} aria-hidden="true" style={{ left: mark.x, top: mark.y, pointerEvents: "none" }}>
      <div className="contribution-mark-content">
        {RAYS.map(([x, y], index) => (
          <span key={index} className="contribution-mark-ray" style={{ "--ray-x": `${x}px`, "--ray-y": `${y}px` } as CSSProperties} />
        ))}
        <span className="contribution-mark-label"><Check size={16} />{mark.label}</span>
      </div>
    </div>
  );
}
