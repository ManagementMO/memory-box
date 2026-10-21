import sharp from "sharp";
import { adminClient, getAsset, markAssetReady } from "./database";
import { ApiError } from "./http";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 16_000_000;

export async function sanitizeImage(bytes: Uint8Array) {
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) throw new ApiError(413, "Choose an image smaller than 5 MB.", "image_too_large");
  try {
    const image = sharp(bytes, {limitInputPixels: MAX_IMAGE_PIXELS, animated: false, failOn: "warning"});
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || !["jpeg", "png", "webp", "gif"].includes(metadata.format || "")) {
      throw new ApiError(400, "Choose a PNG, JPEG, WebP, or GIF image.", "invalid_image");
    }
    const {data, info} = await image.rotate().resize({width: 1600, height: 1600, fit: "inside", withoutEnlargement: true}).webp({quality: 86}).toBuffer({resolveWithObject: true});
    return {bytes: data, width: info.width, height: info.height, size: data.byteLength, mime: "image/webp"};
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "This file could not be read as an image. Try another image.", "invalid_image");
  }
}

export async function finalizeImage(actorId: string, assetId: string) {
  const asset = await getAsset(assetId);
  if (!asset || asset.owner_id !== actorId) throw new ApiError(403, "Choose an image from your own upload.", "asset_not_owned");
  if (asset.status === "ready") return asset;
  if (asset.status !== "staging") throw new ApiError(400, "Choose the image again before publishing.", "asset_unavailable");
  const storage = adminClient().storage;
  const download = await storage.from("memory-staging").download(asset.staging_path);
  if (download.error || !download.data) throw new ApiError(400, "The image is still uploading. Wait a moment, then publish again.", "upload_incomplete");
  const sanitized = await sanitizeImage(new Uint8Array(await download.data.arrayBuffer()));
  const path = `${actorId}/${assetId}.webp`;
  const uploaded = await storage.from("memory-assets").upload(path, sanitized.bytes, {contentType: sanitized.mime, upsert: false});
  if (uploaded.error && !/already exists|duplicate/i.test(uploaded.error.message)) throw new ApiError(503, "The image could not be saved. Your draft is still here.", "upload_failed");
  try {
    await markAssetReady(actorId, assetId, {path, mime: sanitized.mime, width: sanitized.width, height: sanitized.height, size: sanitized.size});
  } catch (error) {
    // An old draft can be claimed for cleanup while decoding/uploading awaits.
    // Only a definitive deleted state permits removing this immutable path;
    // a transient failure may mean another finalizer successfully published it.
    try {
      const current = await getAsset(assetId);
      if (current?.status === "deleted") await storage.from("memory-assets").remove([path]);
    } catch { /* Preserve the readiness failure and the draft for the caller. */ }
    throw error;
  }
  await storage.from("memory-staging").remove([asset.staging_path]);
  return getAsset(assetId);
}
