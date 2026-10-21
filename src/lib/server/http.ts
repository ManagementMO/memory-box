import { z } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "request_failed") {
    super(message);
  }
}

export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next's dev server can construct Request.url with its bind address
  // (0.0.0.0), while the browser correctly uses localhost. The actual Host
  // header identifies the same requested origin without accepting arbitrary
  // cross-origin submissions.
  const host = request.headers.get("host");
  const requestedOrigin = host ? new URL(`${url.protocol}//${host}`).origin : url.origin;
  if (origin && origin !== url.origin && origin !== requestedOrigin) {
    throw new ApiError(403, "Open Memory Box directly before making a change.", "invalid_origin");
  }
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (Number(request.headers.get("content-length") || 0) > 100_000) {
    throw new ApiError(413, "This contribution is too large.", "request_too_large");
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { throw new ApiError(400, "The request could not be read. Try again.", "invalid_json"); }
  return schema.parse(body);
}

export function json(data: unknown, status = 200) {
  return Response.json(data, {status, headers: {"Cache-Control": "no-store"}});
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) return json({error: error.message, code: error.code}, error.status);
  if (error instanceof z.ZodError) return json({
    error: error.issues[0]?.message || "Check the contribution and try again.",
    code: "invalid_input",
    fields: error.issues.map(issue => issue.path.join("."))
  }, 400);
  const message = error instanceof Error ? error.message : "";
  if (/budget|rate.limit|too many|cooldown/i.test(message)) {
    return new Response(JSON.stringify({error: "A little pause helps everyone share the space. Try again shortly.", code: "rate_limited"}), {
      status: 429, headers: {"Content-Type": "application/json", "Cache-Control": "no-store", "Retry-After": "30"}
    });
  }
  if (/source_unavailable|asset_unavailable|not.found|not.available|not.published/i.test(message)) return json({error: "This memory is no longer available.", code: "not_found"}, 404);
  if (/not.owner|forbidden|permission|unauthorized/i.test(message)) return json({error: "Only the author can change this memory.", code: "forbidden"}, 403);
  if (/version|conflict|changed.since|client_id_reused/i.test(message)) return json({error: "This memory changed. Open it again before saving.", code: "conflict"}, 409);
  console.error("Memory Box request failed", {kind: error instanceof Error ? error.name : "unknown"});
  return json({error: "The box could not finish that request. Your draft is still here; try again.", code: "service_unavailable"}, 503);
}

export async function route(run: () => Promise<Response>) {
  try { return await run(); } catch (error) { return errorResponse(error); }
}
