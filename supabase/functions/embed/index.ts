import { poolEmbeddings, splitEmbeddingInput } from "./logic.ts";

// These APIs are built into the hosted Supabase Edge Runtime. No model key or
// external dependency is needed; standard Next.js code never imports this file.
declare const Supabase: {
  ai: { Session: new (model: "gte-small") => {
    run(input: string, options: { mean_pool: true; normalize: true }): Promise<ArrayLike<number>>;
  } };
};
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

let session: InstanceType<typeof Supabase.ai.Session> | undefined;
const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const failure = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers });

function matchesSecret(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return failure(405, "method_not_allowed");
  const expected = Deno.env.get("EMBEDDING_SECRET");
  if (!expected) return failure(503, "embedding_not_configured");
  if (!matchesSecret(request.headers.get("x-memory-box-key") || "", expected)) return failure(401, "unauthorized");
  if (Number(request.headers.get("content-length") || 0) > 22000) return failure(413, "input_too_large");
  let chunks: string[];
  try {
    const body = await request.text();
    if (body.length > 22000) return failure(413, "input_too_large");
    const data = JSON.parse(body) as { input?: unknown };
    if (typeof data.input !== "string") return failure(400, "invalid_input");
    chunks = splitEmbeddingInput(data.input);
  } catch {
    return failure(400, "invalid_input");
  }
  try {
    session ??= new Supabase.ai.Session("gte-small");
    const vectors: number[][] = [];
    for (const chunk of chunks) {
      vectors.push(Array.from(await session.run(chunk, { mean_pool: true, normalize: true })));
    }
    const embedding = poolEmbeddings(vectors, chunks.map((chunk) => Array.from(chunk).length));
    return new Response(JSON.stringify({
      embedding,
      model: "supabase/gte-small",
      dimensions: 384,
      chunks: chunks.length,
    }), { headers });
  } catch {
    return failure(503, "embedding_unavailable");
  }
});
