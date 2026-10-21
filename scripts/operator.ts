import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { adminClient, DatabaseError, listReports, moderate } from "../src/lib/server/database";
import { reportInput } from "../src/lib/server/validation";

const help = `Memory Box pilot operator

Run from the app directory. Loads .env.local without replacing existing environment values.
All commands need local Supabase server credentials; --help needs no credentials.

  npm run operator -- profiles [--limit 50]
  npm run operator -- reports
  npm run operator -- grant <existing-profile-uuid>
  npm run operator -- revoke <existing-profile-uuid>
  npm run operator -- hide <memory-uuid> --actor <operator-profile-uuid>
  npm run operator -- restore <memory-uuid> --actor <operator-profile-uuid>
  npm run operator -- pause --actor <operator-profile-uuid>
  npm run operator -- resume --actor <operator-profile-uuid>
  npm run operator -- clear <x> <y> <width> <height> --actor <operator-profile-uuid>
  npm run operator -- suspend <profile-uuid> --actor <operator-profile-uuid>
  npm run operator -- unsuspend <profile-uuid> --actor <operator-profile-uuid>

MEMORY_BOX_OPERATOR_ID may supply the actor instead of --actor. Moderation requires an
existing, unsuspended operator profile and uses the audited database moderation RPC.
Grant/revoke bootstrap access by changing only an exact, existing profile UUID.
Clear erases paint in grid cells (200 columns x 120 rows), advances the world epoch,
and invalidates old undo operations. It does not remove memories. No prompt is shown.
Profiles lists the newest 50 profiles (limit 1..200); reports lists up to 100 open reports.
Keys, sessions, email addresses, and auth metadata are never printed.
`;

class CliError extends Error {}
const uuid = z.string().uuid("Use a complete profile or memory UUID.").transform(value => value.toLowerCase());
const integer = (label: string) => z.string().regex(/^\d+$/, `${label} must be a whole number.`).transform(Number).pipe(z.int());
const boundsSchema = reportInput.shape.bounds.unwrap().refine(
  bounds => bounds.x + bounds.width <= 200 && bounds.y + bounds.height <= 120,
  "The entire clear rectangle must fit inside the 200 x 120 cell grid.",
);
type ModerationAction = Parameters<typeof moderate>[1];
type Command =
  | { action: "help" }
  | { action: "profiles"; limit: number }
  | { action: "reports" }
  | { action: "grant"; target: string }
  | { action: "revoke"; target: string }
  | { action: ModerationAction; target?: string; actor?: string; bounds?: z.infer<typeof boundsSchema> };

function parseCommand(args: string[]): Command {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({ args, allowPositionals: true, strict: true, options: {
      help: { type: "boolean", short: "h" }, actor: { type: "string" }, limit: { type: "string" },
    } });
  } catch {
    throw new CliError("Invalid command or option. Run npm run operator -- --help.");
  }
  const { values, positionals } = parsed;
  if (values.help || positionals[0] === "help" || !positionals.length) return { action: "help" };
  const [action, ...rest] = positionals;
  const arity = (expected: number) => {
    if (rest.length !== expected) throw new CliError(`The ${action} command expects ${expected} positional argument${expected === 1 ? "" : "s"}. See --help.`);
  };
  if (action !== "profiles" && values.limit !== undefined) throw new CliError("--limit is supported only by profiles.");
  if (["profiles", "reports", "grant", "revoke"].includes(action) && values.actor !== undefined) throw new CliError("--actor is supported only by moderation commands.");
  if (action === "profiles") {
    arity(0);
    const limit = integer("Limit").pipe(z.number().min(1).max(200)).parse(values.limit ?? "50");
    return { action, limit };
  }
  if (action === "reports") { arity(0); return { action }; }
  if (action === "grant" || action === "revoke") { arity(1); return { action, target: uuid.parse(rest[0]) }; }
  const actor = values.actor === undefined ? undefined : uuid.parse(values.actor);
  if (action === "pause" || action === "resume") { arity(0); return { action, actor }; }
  if (action === "hide" || action === "restore" || action === "suspend" || action === "unsuspend") {
    arity(1); return { action, actor, target: uuid.parse(rest[0]) };
  }
  if (action === "clear") {
    arity(4);
    const [x, y, width, height] = rest.map((value, index) => integer(["x", "y", "width", "height"][index]).parse(value));
    return { action, actor, bounds: boundsSchema.parse({ x, y, width, height }) };
  }
  throw new CliError("Unknown command. Run npm run operator -- --help.");
}

async function existingProfile(id: string) {
  const { data, error } = await adminClient().from("profiles").select("id,name,is_operator,suspended,created_at").eq("id", id).maybeSingle();
  if (error) throw new DatabaseError("Profile lookup failed", error.code);
  if (!data) throw new CliError("No existing profile matches that UUID. List profiles first; this command never creates one.");
  return data;
}

async function main() {
  // Parse and validate every command argument before constructing a database client.
  const command = parseCommand(process.argv.slice(2));
  if (command.action === "help") { console.log(help); return; }
  const envPath = resolve(".env.local");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    throw new CliError("Local Supabase server configuration is missing. Set the project URL and server secret in .env.local; never paste credentials into command arguments.");
  }
  const db = adminClient();
  if (command.action === "profiles") {
    const { data, error } = await db.from("profiles").select("id,name,is_operator,suspended,created_at").order("created_at", { ascending: false }).limit(command.limit);
    if (error) throw new DatabaseError("Profile list failed", error.code);
    console.log(JSON.stringify({ profiles: data }, null, 2)); return;
  }
  if (command.action === "reports") {
    console.log(JSON.stringify({ reports: await listReports() }, null, 2)); return;
  }
  if (command.action === "grant" || command.action === "revoke") {
    await existingProfile(command.target);
    const { data, error } = await db.from("profiles").update({ is_operator: command.action === "grant" }).eq("id", command.target).select("id,name,is_operator,suspended").single();
    if (error) throw new DatabaseError("Operator role change failed", error.code);
    console.log(JSON.stringify({ action: command.action, profile: data }, null, 2)); return;
  }
  const actorInput = command.actor ?? process.env.MEMORY_BOX_OPERATOR_ID;
  if (!actorInput) throw new CliError("Moderation needs --actor <operator-profile-uuid> or MEMORY_BOX_OPERATOR_ID.");
  const actor = uuid.parse(actorInput);
  const profile = await existingProfile(actor);
  if (!profile.is_operator || profile.suspended) throw new CliError("The actor must be an existing, unsuspended operator. Grant the intended profile first.");
  if (command.action === "suspend" || command.action === "unsuspend") await existingProfile(command.target!);
  const result = await moderate(actor, command.action, {
    memoryId: command.action === "hide" || command.action === "restore" ? command.target : undefined,
    targetActorId: command.action === "suspend" || command.action === "unsuspend" ? command.target : undefined,
    bounds: command.bounds,
  });
  console.log(JSON.stringify({ action: command.action, actor, ...result }, null, 2));
}

main().catch((error: unknown) => {
  if (error instanceof CliError) console.error(error.message);
  else if (error instanceof z.ZodError) console.error(error.issues.map(issue => issue.message).join(" "));
  else if (error instanceof DatabaseError) {
    const message = /SOURCE_UNAVAILABLE/.test(error.message) ? "That memory is unavailable." : /OPERATOR_REQUIRED|ACCOUNT_SUSPENDED/.test(error.message) ? "The database rejected this operator's permission." : "The database command failed. Check the local project configuration and try again.";
    console.error(message);
  } else console.error("The operator command failed. Check .env.local and the command syntax; credentials were not printed.");
  process.exitCode = 1;
});
