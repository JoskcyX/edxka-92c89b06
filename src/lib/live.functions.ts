import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// LiveKit Cloud (replaces Daily.co). Rooms auto-create when the first
// participant joins, so "starting a class" only records the room name/URL and
// mints an HS256 access token signed with the project's API secret.
// All env reads happen inside handler-reached functions, never at module scope.

const TTL_SECONDS = 60 * 60 * 6;

function b64url(input: Uint8Array): string {
  let s = "";
  for (let i = 0; i < input.length; i++) s += String.fromCharCode(input[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const head = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(new Uint8Array(sig))}`;
}

type LkEnv = { serverUrl: string; host: string; apiKey: string; apiSecret: string };

function lkEnv(): LkEnv {
  const raw = process.env["LIVEKIT_URL"];
  const apiKey = process.env["LIVEKIT_API_KEY"];
  const apiSecret = process.env["LIVEKIT_API_SECRET"];
  if (!raw || !apiKey || !apiSecret) throw new Error("Live video isn't connected yet");
  const host = raw.replace(/^wss?:\/\//, "").replace(/\/+$/, "");
  return { serverUrl: `wss://${host}`, host, apiKey, apiSecret };
}

async function participantToken(env: LkEnv, room: string, identity: string, name: string, owner: boolean) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    {
      iss: env.apiKey,
      sub: identity,
      jti: identity,
      name,
      nbf: now - 5,
      exp: now + TTL_SECONDS,
      video: {
        room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canUpdateMetadata: true,
      },
    },
    env.apiSecret,
  );
}

async function adminToken(env: LkEnv, room: string) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    { iss: env.apiKey, sub: "server-api", exp: now + 120, video: { room, roomAdmin: true } },
    env.apiSecret,
  );
}

async function deleteRoom(env: LkEnv, room: string): Promise<boolean> {
  try {
    const token = await adminToken(env, room);
    const res = await fetch(`https://${env.host}/twirp/livekit.RoomService/DeleteRoom`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ room }),
    });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

const classInput = (d: unknown) => z.object({ classId: z.string().uuid() }).parse(d);

export const startLiveClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(classInput)
  .handler(async ({ data, context }) => {
    const env = lkEnv();
    const { data: cls } = await context.supabase
      .from("classes")
      .select("id, title, tutor_id, live_room_name, live_room_url")
      .eq("id", data.classId)
      .maybeSingle();
    if (!cls || cls.tutor_id !== context.userId) throw new Error("Not your class");
    let name = cls.live_room_name;
    if (!name || !cls.live_room_url?.startsWith("wss:")) {
      // Fresh class or a stale pre-LiveKit room: record the deterministic LiveKit room.
      name = `class-${cls.id}`;
      const { error } = await context.supabase
        .from("classes")
        .update({ live_room_name: name, live_room_url: env.serverUrl, live_started_at: new Date().toISOString() })
        .eq("id", cls.id);
      if (error) throw error;
    }
    const { data: prof } = await context.supabase.from("profiles").select("display_name").eq("id", context.userId).maybeSingle();
    const token = await participantToken(env, name, context.userId, prof?.display_name || "Tutor", true);
    return { serverUrl: env.serverUrl, token };
  });

export const endLiveClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(classInput)
  .handler(async ({ data, context }) => {
    const env = lkEnv();
    const { data: cls } = await context.supabase
      .from("classes")
      .select("id, tutor_id, live_room_name")
      .eq("id", data.classId)
      .maybeSingle();
    if (!cls || cls.tutor_id !== context.userId) throw new Error("Not your class");
    if (cls.live_room_name) await deleteRoom(env, cls.live_room_name);
    await context.supabase
      .from("classes")
      .update({ live_room_name: null, live_room_url: null, live_started_at: null })
      .eq("id", cls.id);
    return { ok: true };
  });

// Students have no account: verify they're an approved member before handing out a join token.
export const getLiveStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin.from("class_members").select("class_id, status").eq("id", data.memberId).maybeSingle();
    if (!m || m.status !== "approved") return { live: false as const };
    const { data: c } = await supabaseAdmin.from("classes").select("live_room_name").eq("id", m.class_id).maybeSingle();
    return { live: !!c?.live_room_name };
  });

export const joinLiveClass = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ memberId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const env = lkEnv();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await supabaseAdmin.from("class_members").select("class_id, status, name").eq("id", data.memberId).maybeSingle();
    if (!m || m.status !== "approved") throw new Error("Not approved");
    const { data: c } = await supabaseAdmin.from("classes").select("live_room_name, live_room_url").eq("id", m.class_id).maybeSingle();
    if (!c?.live_room_name || !c.live_room_url) throw new Error("Class isn't live");
    const token = await participantToken(env, c.live_room_name, data.memberId, m.name, false);
    return { serverUrl: env.serverUrl, token };
  });

// One tap from inside the live window: approve everyone waiting in the join lobby.
export const allowEveryone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(classInput)
  .handler(async ({ data, context }) => {
    const { data: cls } = await context.supabase.from("classes").select("id, tutor_id").eq("id", data.classId).maybeSingle();
    if (!cls || cls.tutor_id !== context.userId) throw new Error("Not your class");
    const { data: rows, error } = await context.supabase
      .from("class_members")
      .update({ status: "approved" })
      .eq("class_id", cls.id)
      .eq("status", "pending")
      .select("id");
    if (error) throw error;
    return { count: rows?.length ?? 0 };
  });

// Open door: for the next N minutes anyone who requests to join gets in instantly.
// request_class_join checks auto_approve_until, so the tutor never leaves the live class.
export const setJoinWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid(), minutes: z.number().int().min(0).max(480) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cls } = await context.supabase.from("classes").select("id, tutor_id").eq("id", data.classId).maybeSingle();
    if (!cls || cls.tutor_id !== context.userId) throw new Error("Not your class");
    const until = data.minutes > 0 ? new Date(Date.now() + data.minutes * 60_000).toISOString() : null;
    const { error } = await context.supabase.from("classes").update({ auto_approve_until: until }).eq("id", cls.id);
    if (error) throw error;
    return { until };
  });
