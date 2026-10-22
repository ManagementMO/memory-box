import type { SVGProps } from "react";

export type PixelTool = "explore" | "wander" | "together" | "paint" | "note" | "photo" | "browse";

/** Original 32px pixel objects. Utility icons keep the smaller Pixelarticons family. */
export function PixelToolIcon({ tool, ...props }: { tool: PixelTool } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 32 32" width="32" height="32" className="pixel-tool-icon tool-art" aria-hidden="true" focusable="false" shapeRendering="crispEdges" {...props}>
    {tool === "explore" ? <>
      <path fill="#51445F" d="M11 2h4v7h1V1h4v8h1V4h4v8h1V9h4v13h-2v4h-3v5H11v-5H8v-4H5v-4H2v-7h4v3h3V5h2z" />
      <path fill="#FFFDF6" d="M12 4h1v12h3V3h2v13h3V6h2v11h3v-6h2v10h-2v4h-3v3H13v-3h-3v-4H7v-4H4v-4h1v3h6V6h1z" />
      <path fill="#D9D0F5" d="M13 27h10v2H13zM11 20h2v4h8v2H11z" />
      <path fill="#F2ADB8" d="M16 19h2v2h-2zM22 19h2v2h-2z" />
    </> : tool === "wander" ? <>
      <path fill="#7A4F60" d="M8 3h17v3h3v20h-3v3H5v-3H2V9h3V6h3z" />
      <path fill="#FFB58E" d="M8 6h17v3h1v16h-3v2H5V10h3z" />
      <path fill="#FFD6B5" d="M8 6h15v3H8zm-3 4h3v15H5z" />
      <path fill="#FFF9EA" d="M10 10h4v4h-4zm8 8h4v4h-4zm-8 0h4v4h-4zm8-8h4v4h-4z" />
      <path fill="#7A4F60" d="M15 15h3v3h-3z" />
      <path fill="#E68B72" d="M5 25h18v2H5z" />
    </> : tool === "together" ? <>
      <path fill="#58466D" d="M6 4h8v2h2v10h-2v2h2v2h2v9H2v-9h2v-2h2v-2H4V6h2zm14 2h6v2h2v10h-2v2h2v2h2v7H18V19h2v-1h-2V8h2z" />
      <path fill="#C3ABF3" d="M6 6h8v10H6zM4 20h10v7H4z" />
      <path fill="#FFD399" d="M20 8h6v10h-6zm0 14h8v5h-8z" />
      <path fill="#FFFDF6" d="M7 9h2v2H7zm4 0h2v2h-2zm9 2h2v2h-2zm4 0h2v2h-2z" />
      <path fill="#6C5181" d="M8 13h4v1H8zm13 2h4v1h-4z" />
      <path fill="#E09BAC" d="M17 1h2v2h2v2h-2v2h-2V5h-2V3h2z" />
    </> : tool === "paint" ? <>
      <path fill="#60465C" d="M21 2h5v2h3v5h-2v3h-3v3h-3v3h-3v3h-3v5h-3v3H2v-3h2v-7h3v-3h6v-3h3v-3h3V7h2z" />
      <path fill="#F28B9E" d="M22 4h3v2h2v3h-3v3h-3v3h-3v3h-3v-3h2v-3h3V9h2z" />
      <path fill="#FFD8DA" d="M22 4h2v5h-2zm-3 6h2v3h-2zm-3 3h2v3h-2z" />
      <path fill="#EADBF6" d="M10 18h4v3h-4zM7 20h3v3H7z" />
      <path fill="#9E7AD6" d="M6 23h7v2h-3v2H4v-2h2z" />
      <path fill="#FBC66A" d="M25 23h2v2h2v2h-2v2h-2v-2h-2v-2h2z" />
    </> : tool === "note" || tool === "browse" ? <>
      <path fill="#79613F" d="M5 3h22v22h-3v3H5z" />
      <path fill="#FFE39B" d="M7 5h18v18h-4v3H7z" />
      <path fill="#FFF1BD" d="M7 5h18v3H7z" />
      <path fill="#DBAF5F" d="M21 23h4v2h-2v1h-2z" />
      <path fill="#AD7F4D" d="M10 12h12v2H10zm0 5h9v2h-9z" />
      <path fill="#F6BCBF" d="M12 1h8v5h-8z" />
      <path fill="#FFF8DF" d="M7 8h2v16H7z" />
    </> : <>
      <path fill="#4F597A" d="M3 4h26v25H3z" />
      <path fill="#FFFDFA" d="M5 6h22v21H5z" />
      <path fill="#B7D8F3" d="M7 8h18v13H7z" />
      <path fill="#F1A9BA" d="M20 10h3v3h-3z" />
      <path fill="#8B86C1" d="M7 18h3v-3h3v-3h3v3h3v3h3v3H7z" />
      <path fill="#B6A4D9" d="M16 20h3v-3h3v2h3v2h-9z" />
      <path fill="#C4BCDC" d="M11 24h10v1H11z" />
      <path fill="#F4D286" d="M10 2h12v4H10z" />
    </>}
  </svg>;
}
