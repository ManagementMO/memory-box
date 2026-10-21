import { z } from "zod";

export const sceneId = z.enum(["mixtape", "pond", "garden"]);
export const identifier = z.uuid();
export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a valid color.");
const safeUrl = z.url().max(2048).refine(value => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Use a complete http or https link.");

export const paintInput = z.object({
  opId: identifier,
  sceneId: sceneId.optional(),
  cells: z.array(z.object({x: z.int().min(0).max(199), y: z.int().min(0).max(119), color: hexColor})).min(1).max(144)
}).refine(input => new Set(input.cells.map(cell => `${cell.x},${cell.y}`)).size === input.cells.length, "Each pixel can appear once in a change.");

export const newMemoryInput = z.object({
  clientId: identifier,
  type: z.enum(["text", "image", "link"]),
  title: z.string().trim().max(80).optional(),
  body: z.string().trim().max(2000),
  url: safeUrl.optional(),
  assetId: identifier.optional(),
  color: hexColor,
  x: z.int().min(0).max(1199),
  y: z.int().min(0).max(719),
  sceneId,
  inspiredBy: identifier.optional(),
  paintOperationId: identifier.optional()
}).superRefine((input, ctx) => {
  if (input.type === "text" && !input.body) ctx.addIssue({code: "custom", path: ["body"], message: "Leave a few words before publishing."});
  if (input.type === "image" && !input.assetId) ctx.addIssue({code: "custom", path: ["assetId"], message: "Choose an image first."});
  if (input.type === "link" && !input.url) ctx.addIssue({code: "custom", path: ["url"], message: "Add a complete link first."});
  if (!input.title && !input.body && input.type !== "image") ctx.addIssue({code: "custom", message: "Give this contribution a little context."});
});

export const editMemoryInput = z.object({
  expectedVersion: z.int().min(1),
  title: z.string().trim().max(80),
  body: z.string().trim().max(2000),
  url: safeUrl.nullable().optional(),
  color: hexColor.optional()
});

export const queryInput = z.object({query: z.string().trim().min(2, "Try a few more words.").max(400), sceneId: sceneId.optional()});
export const uploadInput = z.object({
  name: z.string().min(1).max(180),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  size: z.int().min(1).max(5 * 1024 * 1024, "Choose an image smaller than 5 MB.")
});
export const profileInput = z.object({name: z.string().trim().min(2).max(24).regex(/^[\p{L}\p{N} _.-]+$/u, "Use letters, numbers, spaces, dots, or dashes.")});
export const reportInput = z.object({
  memoryId: identifier.optional(),
  bounds: z.object({x: z.int().min(0).max(199),y: z.int().min(0).max(119),width: z.int().min(1).max(200),height: z.int().min(1).max(120)}).optional(),
  reason: z.string().trim().min(5).max(500)
}).refine(input => input.memoryId || input.bounds, "Choose a memory or an area to report.");
