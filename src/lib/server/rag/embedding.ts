export const NATIVE_EMBEDDING_DIMENSIONS = 384;
export const INDEX_EMBEDDING_DIMENSIONS = 1536;
export const NATIVE_EMBEDDING_MODEL = "supabase/gte-small:padded1536";

/** Zero padding preserves cosine distance; it does not make models compatible. */
export function normalizeAndPadEmbedding(vector: readonly number[]): number[] {
  if (vector.length !== NATIVE_EMBEDDING_DIMENSIONS || vector.some((value) => !Number.isFinite(value))) {
    throw new Error("invalid_embedding");
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude <= 1e-12) throw new Error("invalid_embedding");
  return [
    ...vector.map((value) => value / magnitude),
    ...Array(INDEX_EMBEDDING_DIMENSIONS - NATIVE_EMBEDDING_DIMENSIONS).fill(0),
  ];
}
