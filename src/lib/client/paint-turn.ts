export interface PaintTurnTiming { serverTime: string; nextPaintAt: string; cooldownSeconds: number }

/** Display metadata only. Every new paint is still checked in the transaction. */
export function readPaintTurn(value: unknown): PaintTurnTiming | null {
  if (!value || typeof value !== "object") return null;
  const turn=value as Partial<PaintTurnTiming>;
  if(typeof turn.serverTime!=="string" || typeof turn.nextPaintAt!=="string" || turn.serverTime.length>40 || turn.nextPaintAt.length>40
    || !Number.isFinite(Date.parse(turn.serverTime)) || !Number.isFinite(Date.parse(turn.nextPaintAt))
    || typeof turn.cooldownSeconds!=="number" || !Number.isFinite(turn.cooldownSeconds) || turn.cooldownSeconds<=0 || turn.cooldownSeconds>60) return null;
  return {serverTime:turn.serverTime,nextPaintAt:turn.nextPaintAt,cooldownSeconds:turn.cooldownSeconds};
}

export function paintTurnDeadline(turn: PaintTurnTiming, monotonicNow: number): number {
  return monotonicNow+Math.max(0,Math.min(turn.cooldownSeconds*1000,Date.parse(turn.nextPaintAt)-Date.parse(turn.serverTime)));
}
export const paintTurnSeconds=(deadline:number,monotonicNow:number)=>Math.max(0,Math.ceil((deadline-monotonicNow)/1000));
