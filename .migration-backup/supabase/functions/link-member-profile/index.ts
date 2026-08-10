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

    const { member_id, email } = await req.json();

    if (!member_id || !email) {
      return new Response(JSON.stringify({ error: "member_id and email are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: authUsers, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) {
      return new Response(JSON.stringify({ error: "Failed to search for user" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const targetUser = (authUsers.users || []).find((u: { email: string }) => u.email.toLowerCase() === email.toLowerCase().trim());
    if (!targetUser) {
      return new Response(JSON.stringify({ error: "No user account found with that email. The user must register first." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: linkErr } = await userClient.rpc("link_member_profile", {
      p_member_id: member_id,
      p_profile_id: targetUser.id,
    });

    if (linkErr) {
      return new Response(JSON.stringify({ error: linkErr.message }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
