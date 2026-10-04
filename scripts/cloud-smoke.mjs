import { createClient } from "@supabase/supabase-js";

const url = "https://qxkpqfhmqrzvdainkbcp.supabase.co";
const key = "sb_publishable_PsR-TO7GKUI5A5Np7wSR4g_TzLdTgDo";

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { data: projects, error: projectError } = await supabase
  .from("projects")
  .select("id,slug,name,visibility,is_official")
  .eq("visibility", "public")
  .order("updated_at", { ascending: false });

if (projectError) {
  throw new Error(`Public catalog query failed: ${projectError.message}`);
}

const helios = projects?.find((project) => project.slug === "project-helios" && project.is_official);
if (!helios) {
  throw new Error("Forge Cloud is reachable, but the official Project Helios row is missing.");
}

const { error: forbiddenInsert } = await supabase
  .from("projects")
  .insert({
    slug: `anon-probe-${Date.now()}`,
    name: "Anonymous Probe",
    visibility: "public",
    scene_json: {
      format: "forge.scene",
      version: 1,
      name: "Anonymous Probe",
      entities: []
    }
  });

if (!forbiddenInsert) {
  throw new Error("Security regression: anonymous client was able to insert a project.");
}

const { error: profileError } = await supabase
  .from("profiles")
  .select("id,username,display_name")
  .limit(1);

if (profileError) {
  throw new Error(`Public profile read failed: ${profileError.message}`);
}

const { error: friendRpcError } = await supabase.rpc("friend_connections");
if (!friendRpcError) {
  throw new Error("Security regression: anonymous client was able to call authenticated Friends RPC.");
}

console.log(`Forge Cloud OK: ${projects.length} public project(s); Helios present; anonymous writes and Friends RPC blocked.`);
