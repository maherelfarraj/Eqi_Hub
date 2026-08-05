import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if bootstrap is already disabled
    const { data: bootstrapFlag } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "bootstrap_completed")
      .is("branch_id", null)
      .maybeSingle();

    if (bootstrapFlag && bootstrapFlag.value === true) {
      return new Response(
        JSON.stringify({ error: "Bootstrap has already been completed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if any owner exists
    const { data: existingOwners, error: ownersError } = await supabaseAdmin
      .from("user_roles")
      .select("id, roles!inner(name)")
      .eq("roles.name", "owner");

    if (ownersError) {
      return new Response(
        JSON.stringify({ error: "Database error checking owners" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingOwners && existingOwners.length > 0) {
      // Disable bootstrap permanently
      await supabaseAdmin.from("app_settings").upsert({
        key: "bootstrap_completed",
        value: true,
      }, { onConflict: "key,branch_id" });

      return new Response(
        JSON.stringify({ error: "An owner already exists. Bootstrap disabled." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the owner role ID
    const { data: ownerRole } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", "owner")
      .single();

    if (!ownerRole) {
      return new Response(
        JSON.stringify({ error: "Owner role not found in database" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Assign owner role to the caller
    const { error: assignError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: user.id,
        role_id: ownerRole.id,
        created_by: user.id,
      });

    if (assignError) {
      return new Response(
        JSON.stringify({ error: "Failed to assign owner role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark bootstrap as permanently completed
    await supabaseAdmin.from("app_settings").upsert({
      key: "bootstrap_completed",
      value: true,
    }, { onConflict: "key,branch_id" });

    // Write audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: user.id,
      action: "bootstrap_owner",
      table_name: "user_roles",
      record_id: user.id,
      after: { role: "owner", user_email: user.email },
    });

    return new Response(
      JSON.stringify({ success: true, message: "You are now the system owner" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
