import type { SceneId } from "./types";

/** Small navigation metadata for the client. The persisted seed originals and
 * pixel construction live separately in living-world.ts. */
export interface LivingLandmark { id: string; title: string; invitation: string; x: number; y: number; width: number; height: number; sceneId: SceneId }
export const LIVING_LANDMARKS: LivingLandmark[] = [
  { id: "night-train", title: "The night train", invitation: "A carriage for somewhere you miss. Help draw the next one.", x: 1320, y: 540, width: 720, height: 210, sceneId: "garden" },
  { id: "very-large-cat", title: "A cat of unreasonable size", invitation: "The internet made him this large. What does he need next?", x: -550, y: 240, width: 300, height: 210, sceneId: "pond" },
  { id: "bread-bus", title: "The bread bus", invitation: "It is still late. Draw a passenger, a stop, or a much worse vehicle.", x: 1450, y: -180, width: 390, height: 180, sceneId: "garden" },
  { id: "soup", title: "Waiting for soup", invitation: "A completely unofficial waiting room. Leave something while it cooks.", x: -600, y: 1000, width: 570, height: 140, sceneId: "pond" },
  { id: "tiny-goose", title: "An ordinary goose situation", invitation: "He has acquired a bag. Please give him a destination.", x: 730, y: -450, width: 220, height: 240, sceneId: "mixtape" },
];
