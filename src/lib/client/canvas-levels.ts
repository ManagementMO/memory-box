import type { Memory } from "../types";
import { campusArrival } from "./campus-arrival";
import { screenToWorld, type Camera } from "./canvas-geometry";

export type CanvasLevel = "whole" | "wander" | "close";
export const CANVAS_LEVELS = [
  {id:"whole",label:"World",description:"World view"},
  {id:"wander",label:"Nearby",description:"Nearby view"},
  {id:"close",label:"Close-up",description:"Close-up view"},
] as const;

export function canvasLevel(zoom: number): CanvasLevel {
  return zoom < .52 ? "whole" : zoom < 1.25 ? "wander" : "close";
}

/** A change in distance never teleports someone to a different contribution. */
export function presetCamera(camera: Camera, viewport: {width:number;height:number}, level: CanvasLevel): Camera {
  const middle={x:viewport.width/2,y:viewport.height/2};
  const center=screenToWorld(camera,middle);
  const compact=viewport.width<=700;
  const z={whole:compact?.4:.45,wander:compact?.74:.88,close:1.7}[level];
  return {x:middle.x-center.x*z,y:middle.y-center.y*z,z};
}

/** The campus is a real persisted place; an absent starter never creates art. */
export function initialCampusCamera(memories: Pick<Memory,"id"|"isSeed">[], viewport:{width:number;height:number}): Camera|null {
  if(!campusArrival(memories))return null;
  const z=viewport.width<=700?.4:.45;
  return {x:viewport.width/2-4300*z,y:viewport.height/2-240*z,z};
}
