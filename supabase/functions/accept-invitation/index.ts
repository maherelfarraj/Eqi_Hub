import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const email = user.email!;
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Invitation token is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Fetch the invitation
    const { data: invitation, error: invError } = await admin
      .from("invitations")
      .select("id, email, role_id, branch_id, invited_by, expires_at, accepted_at")
      .eq("token", token)
      .is("accepted_at", null)
      .is("deleted_at", null)
      .maybeSingle();

    if (invError || !invitation) {
      return new Response(JSON.stringify({ error: "Invalid or expired invitation token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This invitation has expired" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return new Response(JSON.stringify({ error: "This invitation was sent to a different email address" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Assign the role
    const { error: roleError } = await admin
      .from("user_roles")
      .insert({
        user_id: user.id,
        role_id: invitation.role_id,
        branch_id: invitation.branch_id,
        created_by: invitation.invited_by,
      });

    if (roleError && roleError.code !== "23505") {
      return new Response(JSON.stringify({ error: "Failed to assign role" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Mark invitation as accepted
    await admin.from("invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invitation.id);

    // 4. Update profile with branch if the invitation specifies one
    if (invitation.branch_id) {
      await admin.from("profiles").update({ branch_id: invitation.branch_id }).eq("id", user.id).is("branch_id", null);
    }

    // 5. Auto-link: if a member record exists with the same email and no
    // profile_id yet, connect it so guardian_riders rows resolve to this user.
    const { data: memberToLink } = await admin
      .from("members")
      .select("id")
      .ilike("email", email)
      .is("profile_id", null)
      .is("deleted_at", null)
      .maybeSingle();

    if (memberToLink) {
      await admin.from("members").update({ profile_id: user.id, updated_by: user.id }).eq("id", memberToLink.id);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
