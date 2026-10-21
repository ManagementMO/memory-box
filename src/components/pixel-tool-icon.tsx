type PixelTool = "explore" | "paint" | "note" | "photo" | "browse";

const shapes: Record<PixelTool, string> = {
  explore: "M7 0h2v2h2v2H9v3h3V5h2v2h2v2h-2v2h-2V9H9v3h2v2H9v2H7v-2H5v-2h2V9H4v2H2V9H0V7h2V5h2v2h3V4H5V2h2z",
  paint: "M11 0h3v1h1v3h-1v2h-2v2h-2V7H9V6H8V4h2V2h1zM5 7h3v2h2v3H8v2H6v1H1v-2h2v-3h2z",
  note: "M2 0h8v2h2v2h2v12H2zm2 2v12h8V6H8V2zm1 6h5v2H5zm0 3h5v1H5z",
  photo: "M1 1h14v14H1zm2 2v10h10V3zm6 1h2v2H9zm-4 6V8h2v2h2V9h2v3H4v-2z",
  browse: "M1 1h6v6H1zm2 2v2h2V3zm6-2h6v6H9zm2 2v2h2V3zM1 9h6v6H1zm2 2v2h2v-2zm6-2h6v6H9zm2 2v2h2v-2z",
};

/** A shared pixel grid for the world's five persistent tools. */
export function PixelToolIcon({ tool }: { tool: PixelTool }) {
  return <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges" className="pixel-tool-icon"><path d={shapes[tool]} fill="currentColor" fillRule="evenodd" /></svg>;
}
