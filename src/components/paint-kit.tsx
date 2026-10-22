import type { CSSProperties } from "react";
import { PAINT_COLORS, SHAPES, type ShapeId } from "@/lib/scenes";
import { Check, Plus } from "./pixel-icons";
import { PixelShape } from "./pixel-shape";
import { PixelToolIcon } from "./pixel-tool-icon";

const SHORT_NAMES: Record<ShapeId, string> = { goose: "Goose", cat: "Cat", carriage: "Train", soup: "Soup", speaker: "Speaker", star: "Star", heart: "Heart", flower: "Flower", note: "Music", frog: "Frog", sprout: "Sprout", pixel: "Pixel" };

export function PaintKit({ mode, onMode, shape, onShape, color, onColor }: {
  mode: "draw" | "shape"; onMode: (mode: "draw" | "shape") => void;
  shape: ShapeId; onShape: (shape: ShapeId) => void; color: string; onColor: (color: string) => void;
}) {
  const chosenColor = PAINT_COLORS.find(choice => choice.value.toLowerCase() === color.toLowerCase());
  const chosenStamp = SHAPES[shape];
  const count = chosenStamp.rows.join("").replaceAll(".", "").length;
  return <div className="paint-kit">
    <div className="paint-kit-modes" role="group" aria-label="Paint tool" data-mode={mode}>
      <span className="paint-kit-active" aria-hidden="true" />
      <button type="button" aria-label="Draw pixels" aria-pressed={mode === "draw"} onClick={() => onMode("draw")}><PixelToolIcon tool="paint" /><span>Draw</span></button>
      <button type="button" aria-label="Place a shape" aria-pressed={mode === "shape"} onClick={() => onMode("shape")}><PixelShape shape="goose" color="#F3617C" /><span>Stamps</span></button>
    </div>
    {mode === "shape" ? <>
      <div className="stamp-selection"><span className="stamp-selection-art" key={shape}><PixelShape shape={shape} color={color} /></span><div><strong>{chosenStamp.name}</strong><span>{count} {count === 1 ? "pixel" : "pixels"} · choose a spot next</span></div></div>
      <div className="stamp-shelf" role="group" aria-label="Pixel stamps">
        {(Object.keys(SHAPES) as ShapeId[]).map(key => <button type="button" key={key} aria-label={SHAPES[key].name} aria-pressed={shape === key} onClick={() => onShape(key)}>
          <span className="stamp-art" data-shape={key}><PixelShape shape={key} color={color} /></span><span>{SHORT_NAMES[key]}</span>{shape === key ? <Check className="stamp-check" size={12} /> : null}
        </button>)}
      </div>
    </> : null}
    <div className="paint-kit-colors">
      <div className="paint-kit-color-heading"><span>Color</span><strong><i style={{ background: color }} aria-hidden="true" />{chosenColor?.name ?? color.toUpperCase()}</strong></div>
      <div className="paint-kit-swatches" role="group" aria-label="Paint colors">
        {PAINT_COLORS.map(choice => <button type="button" className="paint-chip" style={{ "--pigment": choice.value } as CSSProperties} key={choice.value} aria-label={choice.name} aria-pressed={color.toLowerCase() === choice.value.toLowerCase()} onClick={() => onColor(choice.value)}><span aria-hidden="true" />{color.toLowerCase() === choice.value.toLowerCase() ? <Check size={16} /> : null}</button>)}
        <label className="paint-custom-color" title="Custom color"><Plus size={18} /><input type="color" value={color} onChange={event => onColor(event.target.value)} aria-label="Custom paint color" /></label>
      </div>
    </div>
  </div>;
}
