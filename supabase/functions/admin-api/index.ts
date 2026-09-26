import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed =
    origin === "https://horizon-planner.vercel.app" ||
    origin.startsWith("http://localhost:") ||
    origin.endsWith(".vercel.app");

  return {
    "Access-Control-Allow-Origin": allowed
      ? origin
      : "https://horizon-planner.vercel.app",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(
  req: Request,
  body: unknown,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

async function assertAdmin(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const token = authorization.slice("Bearer ".length);
  const authClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token);

  if (userError || !user) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const { data: profile, error: profileError } =
    await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

  if (profileError || profile?.role !== "admin") {
    throw new Response("Forbidden", { status: 403 });
  }

  return user;
}

async function assertUser(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const token = authorization.slice("Bearer ".length);
  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

async function writeAudit(actorUserId: string, action: string, targetUserId?: string, metadata: Record<string, unknown> = {}) {
  const { error } = await adminClient.from("admin_audit_log").insert({
    actor_user_id: actorUserId,
    action,
    target_user_id: targetUserId ?? null,
    metadata,
  });
  if (error) throw error;
}

async function countTable(table: string) {
  const { count, error } = await adminClient
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

async function countUserTable(
  table: string,
  userId: string,
  status?: string,
) {
  let query = adminClient
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (status) {
    query = query.eq("status", status);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders(req),
    });
  }

  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "delete_own_account" || action === "sign_out_all") {
      const user = await assertUser(req);

      if (action === "sign_out_all") {
        const { error } = await adminClient.auth.admin.signOut(user.id, "global");
        if (error) throw error;
        return json(req, { ok: true });
      }

      await writeAudit(user.id, "account.delete_self", user.id);
      const { error } = await adminClient.auth.admin.deleteUser(user.id);
      if (error) throw error;
      return json(req, { ok: true });
    }

    const admin = await assertAdmin(req);

    if (action === "list_users") {
      const page = Math.max(1, Number(body.page) || 1);
      const perPage = Math.min(
        100,
        Math.max(1, Number(body.perPage) || 50),
      );

      const {
        data,
        error,
      } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) throw error;

      const ids = data.users.map((user) => user.id);
      const { data: profiles, error: profilesError } =
        ids.length > 0
          ? await adminClient
              .from("profiles")
              .select(
                "id, display_name, role, timezone, created_at, updated_at",
              )
              .in("id", ids)
          : { data: [], error: null };

      if (profilesError) throw profilesError;

      const profileById = new Map(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile,
        ]),
      );

      return json(req, {
        page,
        perPage,
        users: data.users.map((user) => {
          const profile = profileById.get(user.id);

          return {
            id: user.id,
            email: user.email ?? null,
            createdAt: user.created_at,
            lastSignInAt: user.last_sign_in_at ?? null,
            emailConfirmedAt: user.email_confirmed_at ?? null,
            bannedUntil: user.banned_until ?? null,
            displayName:
              profile?.display_name ??
              user.user_metadata?.display_name ??
              null,
            role: profile?.role ?? "user",
            timezone: profile?.timezone ?? "UTC",
            isCurrentAdmin: user.id === admin.id,
          };
        }),
      });
    }

    if (action === "user_overview") {
      const targetUserId = String(
        body.userId ?? "",
      );

      if (!targetUserId) {
        return json(
          req,
          { error: "Utilisateur requis." },
          400,
        );
      }

      const [
        projects,
        tasks,
        openTasks,
        completedTasks,
        routines,
        calendarEvents,
        plannedSegments,
        recentTasksResult,
        recentProjectsResult,
      ] = await Promise.all([
        countUserTable("projects", targetUserId),
        countUserTable("tasks", targetUserId),
        countUserTable("tasks", targetUserId, "open"),
        countUserTable("tasks", targetUserId, "completed"),
        countUserTable("routines", targetUserId),
        countUserTable("calendar_events", targetUserId),
        countUserTable("planned_segments", targetUserId),
        adminClient
          .from("tasks")
          .select(
            "id,title,status,category,priority,updated_at",
          )
          .eq("user_id", targetUserId)
          .order("updated_at", {
            ascending: false,
          })
          .limit(8),
        adminClient
          .from("projects")
          .select(
            "id,name,archived,updated_at",
          )
          .eq("user_id", targetUserId)
          .order("updated_at", {
            ascending: false,
          })
          .limit(6),
      ]);

      if (recentTasksResult.error) {
        throw recentTasksResult.error;
      }
      if (recentProjectsResult.error) {
        throw recentProjectsResult.error;
      }

      return json(req, {
        userId: targetUserId,
        counts: {
          projects,
          tasks,
          openTasks,
          completedTasks,
          routines,
          calendarEvents,
          plannedSegments,
        },
        recentTasks:
          (recentTasksResult.data ?? []).map(
            (task) => ({
              id: task.id,
              title: task.title,
              status: task.status,
              category: task.category,
              priority: task.priority,
              updatedAt: task.updated_at,
            }),
          ),
        recentProjects:
          (recentProjectsResult.data ?? []).map(
            (project) => ({
              id: project.id,
              name: project.name,
              archived: project.archived,
              updatedAt: project.updated_at,
            }),
          ),
      });
    }

    if (action === "create_user") {
      const email = String(body.email ?? "").trim();
      const password = String(body.password ?? "");
      const displayName = String(
        body.displayName ?? "",
      ).trim();

      if (!email || password.length < 8) {
        return json(
          req,
          {
            error:
              "Email requis et mot de passe de 8 caractères minimum.",
          },
          400,
        );
      }

      const { data, error } =
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            display_name:
              displayName ||
              email.split("@")[0],
          },
        });

      if (error) throw error;

      await writeAudit(admin.id, "admin.create_user", data.user.id, { email });

      return json(req, {
        userId: data.user.id,
      });
    }

    if (action === "set_role") {
      const targetUserId = String(
        body.userId ?? "",
      );
      const role =
        body.role === "admin" ? "admin" : "user";

      if (!targetUserId) {
        return json(req, { error: "Utilisateur requis." }, 400);
      }

      if (
        targetUserId === admin.id &&
        role !== "admin"
      ) {
        return json(
          req,
          {
            error:
              "Tu ne peux pas retirer ton propre rôle administrateur.",
          },
          400,
        );
      }

      const { error } = await adminClient
        .from("profiles")
        .update({ role })
        .eq("id", targetUserId);

      if (error) throw error;
      await writeAudit(admin.id, "admin.set_role", targetUserId, { role });
      return json(req, { ok: true });
    }

    if (
      action === "ban_user" ||
      action === "unban_user"
    ) {
      const targetUserId = String(
        body.userId ?? "",
      );

      if (!targetUserId) {
        return json(req, { error: "Utilisateur requis." }, 400);
      }

      if (targetUserId === admin.id) {
        return json(
          req,
          {
            error:
              "Tu ne peux pas suspendre ton propre compte administrateur.",
          },
          400,
        );
      }

      const { error } =
        await adminClient.auth.admin.updateUserById(
          targetUserId,
          {
            ban_duration:
              action === "ban_user"
                ? "876000h"
                : "none",
          },
        );

      if (error) throw error;
      await writeAudit(admin.id, action === "ban_user" ? "admin.ban_user" : "admin.unban_user", targetUserId);
      return json(req, { ok: true });
    }

    if (action === "delete_user") {
      const targetUserId = String(
        body.userId ?? "",
      );

      if (!targetUserId) {
        return json(req, { error: "Utilisateur requis." }, 400);
      }

      if (targetUserId === admin.id) {
        return json(
          req,
          {
            error:
              "Tu ne peux pas supprimer ton propre compte administrateur.",
          },
          400,
        );
      }

      const { error } =
        await adminClient.auth.admin.deleteUser(
          targetUserId,
        );

      if (error) throw error;
      await writeAudit(admin.id, "admin.delete_user", targetUserId);
      return json(req, { ok: true });
    }

    if (action === "stats") {
      const [
        profiles,
        projects,
        tasks,
        routines,
        calendarEvents,
        plannedSegments,
      ] = await Promise.all([
        countTable("profiles"),
        countTable("projects"),
        countTable("tasks"),
        countTable("routines"),
        countTable("calendar_events"),
        countTable("planned_segments"),
      ]);

      return json(req, {
        profiles,
        projects,
        tasks,
        routines,
        calendarEvents,
        plannedSegments,
      });
    }

    if (action === "audit_log") {
      const { data, error } = await adminClient
        .from("admin_audit_log")
        .select("id,actor_user_id,action,target_user_id,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return json(req, { entries: data ?? [] });
    }

    return json(req, { error: "Action inconnue." }, 400);
  } catch (cause) {
    if (cause instanceof Response) {
      return new Response(
        await cause.text(),
        {
          status: cause.status,
          headers: corsHeaders(req),
        },
      );
    }

    const message =
      cause instanceof Error
        ? cause.message
        : "Erreur serveur.";

    return json(req, { error: message }, 500);
  }
});
