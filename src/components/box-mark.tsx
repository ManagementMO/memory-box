/** The product mark, with hover-only details. No idle animation. */
export function BoxMark() {
  return <svg className="box-mark" viewBox="0 0 32 32" width="48" height="48" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
    <path fill="#EBE7F3" d="M6 29h22v2H6z" />
    <g className="box-body">
      <path fill="#393246" d="M4 14h24v14h-2v2H6v-2H4z" />
      <path fill="#FFE29A" d="M6 16h20v12H6z" />
      <path fill="#F2C66A" d="M6 25h20v3H6z" />
      <path fill="#FFF1C6" d="M6 16h20v2H6z" />
      <path fill="#393246" d="M1 11h11v2h4v5H5v-2H1zm20 0h10v5h-4v2H16v-5h5z" />
      <path fill="#C8BBF3" d="M3 13h8v2h3v1H5v-2H3z" />
      <path fill="#D9D1FA" d="M22 13h7v1h-3v2h-8v-1h4z" />
      <path className="box-eyes" fill="#393246" d="M10 20h2v3h-2zm10 0h2v3h-2z" />
      <path fill="#393246" d="M14 24h4v2h-4z" />
      <path fill="#ED9BAD" d="M8 23h2v2H8zm14 0h2v2h-2z" />
    </g>
    <g className="box-treasures">
      <path fill="#F3617C" d="M13 1h3v2h2V1h3v4h-2v2h-2v2h-2V7h-2V5h-2V3h2z" />
      <path fill="#B5A4E4" d="M5 4h4v4H5z" />
      <path fill="#FFD56A" d="M25 5h2v2h2v2h-2v2h-2V9h-2V7h2z" />
    </g>
  </svg>;
}
