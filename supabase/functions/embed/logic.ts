export const MODEL_DIMENSIONS = 384;
export const MAX_INPUT_CHARACTERS = 4800;
export const CHUNK_CHARACTERS = 1200;

export function splitEmbeddingInput(text: string): string[] {
  const characters = Array.from(text.trim());
  if (!characters.length || characters.length > MAX_INPUT_CHARACTERS) throw new Error("invalid_input");
  const chunks: string[] = [];
  for (let start = 0; start < characters.length; start += CHUNK_CHARACTERS) {
    const chunk = characters.slice(start, start + CHUNK_CHARACTERS).join("").trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

/** Length-weighted mean of bounded chunks, normalized once after pooling. */
export function poolEmbeddings(vectors: readonly (readonly number[])[], weights: readonly number[]): number[] {
  if (!vectors.length || vectors.length !== weights.length || vectors.length > 4) throw new Error("invalid_embedding");
  const pooled = Array(MODEL_DIMENSIONS).fill(0) as number[];
  let totalWeight = 0;
  vectors.forEach((vector, index) => {
    const weight = weights[index];
    if (vector.length !== MODEL_DIMENSIONS || !Number.isFinite(weight) || weight <= 0) throw new Error("invalid_embedding");
    totalWeight += weight;
    vector.forEach((value, coordinate) => {
      if (!Number.isFinite(value)) throw new Error("invalid_embedding");
      pooled[coordinate] += value * weight;
    });
  });
  for (let i = 0; i < pooled.length; i++) pooled[i] /= totalWeight;
  const magnitude = Math.sqrt(pooled.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(magnitude) || magnitude <= 1e-12) throw new Error("invalid_embedding");
  return pooled.map((value) => value / magnitude);
}
