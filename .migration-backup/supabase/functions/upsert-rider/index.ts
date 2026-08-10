import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
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

    const body = await req.json();
    const { rider_id, member_id, full_name, date_of_birth, gender, riding_level, preferred_discipline, height_cm, weight_kg, goals, photo_url, status, emergency_contacts, guardians, medical } = body;

    if (!member_id || !full_name || !date_of_birth || !gender) {
      return new Response(JSON.stringify({ error: "Missing required fields: member_id, full_name, date_of_birth, gender" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const dob = new Date(date_of_birth);
    if (isNaN(dob.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid date of birth" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ageMs = Date.now() - dob.getTime();
    const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 0 || ageYears > 120) {
      return new Response(JSON.stringify({ error: "Date of birth is out of valid range" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isJunior = ageYears < 18;

    if (height_cm != null && (height_cm <= 0 || height_cm >= 300)) {
      return new Response(JSON.stringify({ error: "Height must be between 1 and 299 cm" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (weight_kg != null && (weight_kg <= 0 || weight_kg >= 500)) {
      return new Response(JSON.stringify({ error: "Weight must be between 1 and 499 kg" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (isJunior && (!emergency_contacts || emergency_contacts.length === 0)) {
      return new Response(JSON.stringify({ error: "Junior riders must have at least one emergency contact" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const riderData: Record<string, unknown> = {
      member_id, full_name, date_of_birth, gender,
      riding_level: riding_level || "beginner",
      preferred_discipline: preferred_discipline || null,
      height_cm: height_cm || null,
      weight_kg: weight_kg || null,
      goals: goals || null,
      photo_url: photo_url || null,
      status: status || "active",
    };

    let riderId = rider_id;

    if (riderId) {
      const { data: updated, error: updateErr } = await admin.from("riders").update(riderData).eq("id", riderId).select("id").single();
      if (updateErr) {
        return new Response(JSON.stringify({ error: "Failed to update rider: " + updateErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      riderId = updated.id;
    } else {
      const { data: created, error: insertErr } = await admin.from("riders").insert({ ...riderData, created_by: user.id }).select("id").single();
      if (insertErr) {
        return new Response(JSON.stringify({ error: "Failed to create rider: " + insertErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      riderId = created.id;
    }

    if (emergency_contacts && emergency_contacts.length > 0) {
      await admin.from("emergency_contacts").delete().eq("rider_id", riderId);
      const contacts = emergency_contacts.map((c: any, i: number) => ({ rider_id: riderId, name: c.name, relationship: c.relationship, phone: c.phone, priority: c.priority ?? i, created_by: user.id }));
      const { error: ecErr } = await admin.from("emergency_contacts").insert(contacts);
      if (ecErr) {
        return new Response(JSON.stringify({ error: "Failed to save emergency contacts: " + ecErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (guardians && guardians.length > 0) {
      await admin.from("guardian_riders").delete().eq("rider_id", riderId);
      const links = guardians.map((g: any) => ({ guardian_member_id: g.guardian_member_id, rider_id: riderId, relationship: g.relationship || "other", created_by: user.id }));
      const { error: gErr } = await admin.from("guardian_riders").insert(links);
      if (gErr) {
        return new Response(JSON.stringify({ error: "Failed to save guardian links: " + gErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (medical) {
      const { error: medErr } = await admin.from("rider_medical").upsert({
        rider_id: riderId, conditions: medical.conditions || null, allergies: medical.allergies || null,
        accessibility_requirements: medical.accessibility_requirements || null, notes: medical.notes || null, created_by: user.id, updated_by: user.id,
      }, { onConflict: "rider_id" });
      if (medErr) {
        return new Response(JSON.stringify({ error: "Failed to save medical record: " + medErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ success: true, rider_id: riderId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
