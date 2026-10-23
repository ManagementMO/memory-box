import { z } from "zod";
import {DatabaseError,databaseDiagnostic} from "./database-error";

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

export const MAX_JSON_BYTES = 100_000;

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (Number(request.headers.get("content-length") || 0) > MAX_JSON_BYTES) {
    throw new ApiError(413, "This contribution is too large.", "request_too_large");
  }
  let body: unknown;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    reader = request.body?.getReader();
    if (!reader) throw new Error("missing_body");
    const decoder = new TextDecoder();
    let bytes = 0, text = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_JSON_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new ApiError(413, "This contribution is too large.", "request_too_large");
      }
      text += decoder.decode(value, { stream: true });
    }
    body = JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "The request could not be read. Try again.", "invalid_json");
  } finally {
    reader?.releaseLock();
  }
  return schema.parse(body);
}

export function json(data: unknown, status = 200) {
  return Response.json(data, {status, headers: {"Cache-Control": "no-store"}});
}

export interface RequestDiagnostic {
  requestId:string;
  scope:"memory_publish";
  phase:"origin"|"authorize"|"validate"|"image"|"create"|"index";
}

function failureDiagnostic(error:unknown,context?:RequestDiagnostic){
  return{...(error instanceof DatabaseError?databaseDiagnostic(error):{kind:error instanceof Error&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name)?error.name:"unknown"}),...context};
}

export function errorResponse(error: unknown, context?:RequestDiagnostic) {
  if (error instanceof ApiError) return json({error: error.message, code: error.code}, error.status);
  if (error instanceof z.ZodError) return json({
    error: error.issues[0]?.message || "Check the contribution and try again.",
    code: "invalid_input",
    fields: error.issues.map(issue => issue.path.join("."))
  }, 400);
  const message = error instanceof Error ? error.message : "";
  if(error instanceof DatabaseError&&(error.code==="PT401"&&message==="AUTH_REQUIRED"||error.code==="23503"&&message.includes('"profiles_id_fkey"'))){
    return json({error:"Your session expired. Reconnect to the box.",code:"invalid_session"},401);
  }
  if (message.includes("build_invitation_has_words")) return json({error:"Say what people can help make, or close the invitation before removing its words.",code:"invalid_input"},400);
  if (message === "ACCOUNT_SUSPENDED") return json({error: "This session cannot contribute right now.", code: "session_suspended"}, 403);
  if (/budget|rate.limit|too many|cooldown/i.test(message)) {
    return new Response(JSON.stringify({error: "A little pause helps everyone share the space. Try again shortly.", code: "rate_limited"}), {
      status: 429, headers: {"Content-Type": "application/json", "Cache-Control": "no-store", "Retry-After": "30"}
    });
  }
  if (/source_unavailable|asset_unavailable|not.found|not.available|not.published/i.test(message)) return json({error: "This memory is no longer available.", code: "not_found"}, 404);
  if (/not.owner|forbidden|permission|unauthorized/i.test(message)) return json({error: "Only the author can change this memory.", code: "forbidden"}, 403);
  if (/^(?:VERSION_CONFLICT|IDEMPOTENCY_CONFLICT|CLIENT_ID_REUSED)$/i.test(message)) {
    console.warn("Memory Box save conflict",{...failureDiagnostic(error,context),conflict:message.toUpperCase()});
    return json({error: "This memory changed. Open it again before saving.", code: "conflict"}, 409);
  }
  console.error("Memory Box request failed",failureDiagnostic(error,context));
  return json({error: "The box could not finish that request. Your draft is still here; try again.", code: "service_unavailable"}, 503);
}

export async function route(run: () => Promise<Response>, diagnostic?:()=>RequestDiagnostic) {
  try { return await run(); } catch (error) { return errorResponse(error,diagnostic?.()); }
}
