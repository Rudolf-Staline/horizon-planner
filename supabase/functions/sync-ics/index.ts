import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": origin.endsWith(".vercel.app") || origin.startsWith("http://localhost:") ? origin : "https://horizon-planner.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function respond(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}

async function userFromRequest(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) throw new Response("Unauthorized", { status: 401 });
  const token = header.slice(7);
  const client = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

function unfold(content: string) { return content.replace(/\r?\n[ \t]/g, "").split(/\r?\n/); }
function unescape(value: string) { return value.replace(/\\n/gi, "\n").replace(/\\([\\;,])/g, "$1"); }
function zoneParts(value: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value).reduce<Record<string, number>>((parts, part) => {
      if (["year", "month", "day", "hour", "minute"].includes(part.type)) parts[part.type] = Number(part.value);
      return parts;
    }, {});
  } catch {
    if (timeZone !== "UTC") return zoneParts(value, "UTC");
    return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate(), hour: value.getUTCHours(), minute: value.getUTCMinutes() };
  }
}
function localDateTimeToIso(raw: string, timeZone: string) {
  const target = Date.UTC(Number(raw.slice(0, 4)), Number(raw.slice(4, 6)) - 1, Number(raw.slice(6, 8)), Number(raw.slice(9, 11)), Number(raw.slice(11, 13)), Number(raw.slice(13, 15)));
  let guess = target;
  for (let index = 0; index < 3; index += 1) {
    const parts = zoneParts(new Date(guess), timeZone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    guess += target - represented;
  }
  return new Date(guess).toISOString();
}
function parseDate(value: string) {
  const [keyPart, ...rest] = value.split(":");
  const raw = rest.join(":");
  if (/^\d{8}$/.test(raw)) return null;
  if (!/^\d{8}T\d{6}Z?$/.test(raw)) return null;
  if (raw.endsWith("Z")) {
    return new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}Z`).toISOString();
  }
  const tzid = keyPart.split(";").find((parameter) => parameter.toUpperCase().startsWith("TZID="))?.slice(5);
  return tzid ? localDateTimeToIso(raw, tzid) : new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}Z`).toISOString();
}
function parseEvents(content: string) {
  const events: Array<{ externalId: string; title: string; startsAt: string; endsAt: string }> = [];
  let current: Record<string, string> | null = null;
  for (const line of unfold(content)) {
    if (line === "BEGIN:VEVENT") current = {};
    else if (line === "END:VEVENT") {
      if (current?.externalId && current.title && current.startsAt && current.endsAt) events.push(current as typeof events[number]);
      current = null;
    } else if (current) {
      const [keyPart, ...rest] = line.split(":");
      const key = keyPart.split(";")[0];
      const value = unescape(rest.join(":"));
      if (key === "UID") current.externalId = value;
      if (key === "SUMMARY") current.title = value;
      if (key === "DTSTART") { const parsed = parseDate(line); if (parsed) current.startsAt = parsed; }
      if (key === "DTEND") { const parsed = parseDate(line); if (parsed) current.endsAt = parsed; }
    }
  }
  return events;
}

function assertPublicFeed(value: string) {
  const feed = new URL(value);
  if (feed.protocol !== "https:") throw new Error("Le flux doit utiliser HTTPS.");
  const host = feed.hostname.toLowerCase();
  if (host === "localhost" || host === "[::1]" || host === "::1" || host === "0.0.0.0" || host.endsWith(".local")) throw new Error("Hôte de flux interdit.");
  if (/^(10|127)\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) throw new Error("Adresse réseau privée interdite.");
  const match = host.match(/^172\.(\d{1,3})\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) throw new Error("Adresse réseau privée interdite.");
  return feed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  try {
    if (req.method !== "POST") return respond(req, { error: "Method not allowed" }, 405);
    const user = await userFromRequest(req);
    const { sourceId } = await req.json().catch(() => ({}));
    const { data: source, error: sourceError } = await admin.from("calendar_sources").select("id,provider,feed_url,name,enabled").eq("id", sourceId).eq("user_id", user.id).single();
    if (sourceError || !source) return respond(req, { error: "Source introuvable." }, 404);
    if (!source.enabled) return respond(req, { error: "Cette source est désactivée." }, 409);
    const feedUrl = assertPublicFeed(source.feed_url);
    const response = await fetch(feedUrl, { headers: { Accept: "text/calendar,text/plain;q=0.9" } });
    if (!response.ok) throw new Error(`Le flux a répondu ${response.status}.`);
    const imported = parseEvents(await response.text());
    const rows = imported.map((event) => ({ user_id: user.id, title: event.title.slice(0, 300), category: 'neutral', starts_at: event.startsAt, ends_at: event.endsAt, locked: true, source: source.provider, external_id: `${source.id}:${event.externalId}` }));
    if (rows.length > 0) {
      const { error } = await admin.from("calendar_events").upsert(rows, { onConflict: "user_id,source,external_id" });
      if (error) throw error;
    }
    const { data: existing, error: existingError } = await admin.from("calendar_events").select("id,external_id").eq("user_id", user.id).eq("source", source.provider).like("external_id", `${source.id}:%`);
    if (existingError) throw existingError;
    const importedIds = new Set(rows.map((row) => row.external_id));
    const staleIds = (existing ?? []).filter((event) => !event.external_id || !importedIds.has(event.external_id)).map((event) => event.id);
    const deletedExternalIds = (existing ?? []).filter((event) => event.external_id && !importedIds.has(event.external_id)).map((event) => event.external_id as string);
    if (staleIds.length > 0) {
      const { error } = await admin.from("calendar_events").delete().eq("user_id", user.id).in("id", staleIds);
      if (error) throw error;
    }
    await admin.from("calendar_sources").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", source.id).eq("user_id", user.id);
    return respond(req, { imported: rows.length, deletedExternalIds });
  } catch (cause) {
    if (cause instanceof Response) return new Response(await cause.text(), { status: cause.status, headers: cors(req) });
    return respond(req, { error: cause instanceof Error ? cause.message : "Synchronisation impossible." }, 500);
  }
});
