import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizedText(value, maximumLength) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Use POST to send a team invitation." }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return response({ error: "Sign in with an Admin Manager account and try again." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return response({ error: "Team invitations are not configured on the server yet." }, 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return response({ error: "Your session is invalid or expired. Sign in again." }, 401);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return response({ error: "The invitation details are invalid." }, 400);
  }

  const firstName = normalizedText(payload.firstName, 80);
  const lastName = normalizedText(payload.lastName, 80);
  const email = normalizedText(payload.email, 254).toLowerCase();
  const role = payload.role;
  if (!firstName || !lastName || !email || !["clinic_staff", "optometrist"].includes(String(role))) {
    return response({ error: "Enter a first name, last name, valid email, and approved team role." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response({ error: "Enter a valid email address." }, 400);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [roleResult, profileResult] = await Promise.all([
    adminClient.from("user_roles").select("user_id").eq("user_id", authData.user.id).eq("role", "admin").maybeSingle(),
    adminClient.from("staff_profiles").select("user_id")
      .eq("user_id", authData.user.id).eq("employment_status", "active")
      .eq("can_manage_admins", true).maybeSingle(),
  ]);
  if (roleResult.error || profileResult.error) {
    return response({ error: "Admin permissions could not be checked. Try again later." }, 500);
  }
  if (!roleResult.data || !profileResult.data) {
    return response({ error: "Only an active Admin Manager can invite team members." }, 403);
  }

  const origin = request.headers.get("Origin");
  let redirectTo;
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const secureOrigin = originUrl.protocol === "https:" ||
        (originUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(originUrl.hostname));
      if (!secureOrigin || originUrl.username || originUrl.password) {
        return response({ error: "The invitation link destination is not allowed." }, 400);
      }
      redirectTo = new URL("/accept-invite", originUrl.origin).toString();
    } catch {
      return response({ error: "The invitation link destination is invalid." }, 400);
    }
  }

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { first_name: firstName, last_name: lastName },
    ...(redirectTo ? { redirectTo } : {}),
  });
  if (inviteError || !inviteData.user) {
    const duplicateEmail = /already|registered|exists/i.test(inviteError?.message ?? "");
    return response({
      error: duplicateEmail
        ? "An account already uses this email. Use a new email address for the team invitation."
        : "The invitation email could not be sent. Check the email settings and try again.",
    }, duplicateEmail ? 409 : 502);
  }

  const { error: provisionError } = await adminClient.rpc("provision_invited_staff_account", {
    p_user_id: inviteData.user.id,
    p_role: String(role),
    p_first_name: firstName,
    p_last_name: lastName,
    p_inviter_id: authData.user.id,
    p_phone_number: null,
  });

  if (provisionError) {
    // The Auth invite sends an email before database provisioning. Remove this
    // newly created account on failure so it cannot remain a customer account.
    await adminClient.auth.admin.deleteUser(inviteData.user.id);
    return response({ error: "The account could not be provisioned. The invitation was cancelled; try again." }, 500);
  }

  return response({ success: true, role: String(role) }, 200);
});
