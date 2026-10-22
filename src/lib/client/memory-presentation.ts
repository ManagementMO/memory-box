import type { Memory } from "../types";

/** Material is stable across people, devices, edits and viewport distances. */
export function memoryMaterial(memory: Pick<Memory,"id"|"type"> & Partial<Pick<Memory,"title"|"body">>) {
  if(memory.type==="image")return "photo";
  if(memory.type==="link")return "link";
  let hash=0;for(const character of memory.id)hash=(hash*31+character.charCodeAt(0))>>>0;
  return (["scrap","caption","ticket"] as const)[hash%3];
}

export function overviewLabel(memory: Pick<Memory,"title"|"body">) {
  const title=memory.title.trim();if(title)return title;
  const body=memory.body.replace(/\s+/g," ").trim();
  return body.length>56?body.slice(0,54)+"…":body;
}

export function originalLabel(memory: Pick<Memory,"title"|"body"|"type"|"authorName">) {
  const kind = memory.type === "image" ? "Photo" : memory.type === "link" ? "Link" : "Memory";
  return overviewLabel(memory) || `${kind} by @${memory.authorName}`;
}
