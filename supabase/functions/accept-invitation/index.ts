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
    const { email, password, full_name, token } = await req.json();

    if (!email || !password || !token) {
      return new Response(
        JSON.stringify({ error: "Email, password, and invitation token are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Validate the invitation token (not expired, not accepted, not deleted)
    const { data: invitation, error: invError } = await admin
      .from("invitations")
      .select("id, email, role_id, branch_id, invited_by, expires_at, accepted_at, deleted_at")
      .eq("token", token)
      .is("accepted_at", null)
      .is("deleted_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (invError || !invitation) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired invitation token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "This invitation was sent to a different email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Create the auth user (with full_name in metadata for the profile trigger)
    const { data: authData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || email },
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = authData.user.id;

    // 3. Assign the role from the invitation
    const { error: roleError } = await admin
      .from("user_roles")
      .insert({
        user_id: userId,
        role_id: invitation.role_id,
        branch_id: invitation.branch_id,
        created_by: invitation.invited_by,
      });

    if (roleError) {
      // Best-effort cleanup: delete the auth user we just created
      await admin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Failed to assign role: " + roleError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Mark the invitation as accepted
    const { error: acceptError } = await admin
      .from("invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invitation.id);

    if (acceptError) {
      console.error("Failed to mark invitation accepted:", acceptError.message);
    }

    // 5. Update profile with branch if the invitation specifies one
    if (invitation.branch_id) {
      await admin
        .from("profiles")
        .update({ branch_id: invitation.branch_id })
        .eq("id", userId)
        .is("branch_id", null);
    }

    // 6. Sign in the user so we can return a session token
    const userClient = createClient(supabaseUrl, anonKey);
    const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.session) {
      return new Response(
        JSON.stringify({
          success: true,
          warning: "Account created but automatic sign-in failed. Please sign in manually.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: signInData.session,
        user: signInData.user,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
