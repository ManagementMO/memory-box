import { adminClient, getProfile } from "./database";
import { ApiError } from "./http";

export async function requireActor(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new ApiError(401, "Join the live box to continue.", "sign_in_required");
  const token = authorization.slice(7);
  if (token.length > 8192) throw new ApiError(401, "Your session needs to reconnect.", "invalid_session");
  const {data, error} = await adminClient().auth.getUser(token);
  if (error || !data.user) throw new ApiError(401, "Your session expired. Reconnect to the box.", "invalid_session");
  const profile = await getProfile(data.user.id);
  if (profile?.suspended) throw new ApiError(403, "This session cannot contribute right now.", "session_suspended");
  return {id: data.user.id, user: data.user, profile};
}
