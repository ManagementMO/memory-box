import type { LivingLandmark } from "./living-landmarks";

/** Navigation only. The operator persists the separately authored starter data. */
export const WATERLOO_ARRIVAL = {
  anchorMemoryId: "20000000-0000-4000-8000-000000000001",
  x: 3222, y: -570, width: 2430, height: 1980,
} as const;

export const WATERLOO_LANDMARKS: LivingLandmark[] = [
  { id: "goose-committee", title: "The goose committee", invitation: "The goose has a co-op interview. Finish the tie, change the sign, or make this significantly worse.", x: 4002, y: 120, width: 420, height: 492, sceneId: "garden" },
  { id: "pink-tie", title: "Keep the tie pink", invitation: "A very pink campus tradition, now made of very replaceable pixels. Finish the missing tail or give it a neighbour.", x: 3354, y: -120, width: 288, height: 396, sceneId: "garden" },
  { id: "mc-maze", title: "MC, allegedly", invitation: "A completely unusable concrete maze. Add a wrong turn, a room, or the exit nobody can find.", x: 4710, y: -252, width: 540, height: 300, sceneId: "garden" },
  { id: "sauce-lines", title: "The sauce-line debate", invitation: "Draw your completely unreasonable sauce order. Leave room for the next person's worse opinion.", x: 4650, y: 726, width: 432, height: 288, sceneId: "garden" },
  { id: "ion-to-somewhere", title: "ION to somewhere", invitation: "The last carriage is missing. Draw yourself a seat, a goose passenger, or somewhere you wish this went.", x: 3348, y: 906, width: 786, height: 174, sceneId: "garden" },
];
