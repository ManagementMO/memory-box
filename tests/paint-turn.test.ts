import { describe, expect, it } from "vitest";
import { paintTurnDeadline, paintTurnSeconds, readPaintTurn } from "../src/lib/client/paint-turn";

const turn={serverTime:"2026-10-22T04:00:00.000Z",nextPaintAt:"2026-10-22T04:00:15.000Z",cooldownSeconds:15};
describe("server paint turn timing",()=>{
  it("uses server-relative time on a monotonic clock, independent of the device calendar",()=>{
    const deadline=paintTurnDeadline(turn,2400);
    expect(deadline).toBe(17400);
    expect(paintTurnSeconds(deadline,2400)).toBe(15);
    expect(paintTurnSeconds(deadline,3401)).toBe(14);
    expect(paintTurnSeconds(deadline,17400)).toBe(0);
    expect(paintTurnSeconds(deadline,18400)).toBe(0);
  });
  it("accepts expired server deadlines as ready and handles fractional seconds",()=>{
    expect(paintTurnDeadline({...turn,nextPaintAt:"2026-10-22T03:59:59.000Z"},1000)).toBe(1000);
    expect(paintTurnSeconds(paintTurnDeadline({...turn,nextPaintAt:"2026-10-22T04:00:00.010Z"},1000),1000)).toBe(1);
    expect(readPaintTurn({...turn,serverTime:"2026-10-22T04:00:00+00:00"})).not.toBeNull();
  });
  it("rejects malformed metadata and bounds a future deadline to the declared turn",()=>{
    for(const input of [null,{},"15",{...turn,nextPaintAt:"not a date"},{...turn,cooldownSeconds:Infinity},{...turn,cooldownSeconds:0}]) expect(readPaintTurn(input)).toBeNull();
    expect(paintTurnDeadline({...turn,nextPaintAt:"2099-10-22T04:00:00.000Z"},1000)).toBe(16000);
  });
});
