import { Image, List, Maximize2, Paintbrush, StickyNote } from "./pixel-icons";
type PixelTool = "explore" | "paint" | "note" | "photo" | "browse";
const tools = { explore: Maximize2, paint: Paintbrush, note: StickyNote, photo: Image, browse: List };

/** Tools use the same 24px family as every other application control. */
export function PixelToolIcon({ tool }: { tool: PixelTool }) {
  const Icon=tools[tool];
  return <Icon size={24} className="pixel-tool-icon" />;
}
