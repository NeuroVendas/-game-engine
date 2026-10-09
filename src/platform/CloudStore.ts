import { createClient, type Session, type User } from "@supabase/supabase-js";
import type { ForgeSceneDocument } from "../types";

const SUPABASE_URL = "https://qxkpqfhmqrzvdainkbcp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_PsR-TO7GKUI5A5Np7wSR4g_TzLdTgDo";

export type CloudVisibility = "private" | "unlisted" | "public";

export interface CloudProfile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_style: string;
}

interface ProjectOwner {
  id: string;
  username: string;
  display_name: string;
}

interface ProjectRow {
  id: string;
  owner_id: string | null;
  slug: string;
  name: string;
  description: string;
  visibility: CloudVisibility;
  scene_json: ForgeSceneDocument;
  thumbnail_kind: string;
  is_official: boolean;
  updated_at: string;
  play_count: number;
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

// Build the confirmation target from the active Forge page, never from a
// development-only Supabase Site URL (previously localhost:3000).
// Keep the full GitHub Pages project path: /-game-engine/.
export function authReturnUrl(): string {
  return new URL(window.location.pathname, window.location.origin).href;
}

export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<{ user: User | null; session: Session | null }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authReturnUrl(),
      data: { display_name: displayName.trim() || "Builder" }
    }
  });

  if (error) throw error;
  return data;
}

export async function resendConfirmation(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: authReturnUrl() }
  });
  if (error) throw error;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error("No session returned.");
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function loadPublicProfile(userId: string): Promise<CloudProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,avatar_style")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as CloudProfile | null;
}

export async function loadMyProfile(userId: string): Promise<CloudProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,display_name,bio,avatar_style")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as CloudProfile | null;
}

export async function updateMyProfile(
  userId: string,
  values: Pick<CloudProfile, "username" | "display_name" | "bio">
): Promise<CloudProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      username: values.username.trim(),
      display_name: values.display_name.trim() || "Builder",
      bio: values.bio.trim()
    })
    .eq("id", userId)
    .select("id,username,display_name,bio,avatar_style")
    .single();

  if (error) throw error;
  return data as CloudProfile;
}

export function rowToScene(row: ProjectRow, owner?: ProjectOwner): ForgeSceneDocument {
  const scene = structuredClone(row.scene_json);
  scene.name = row.name;
  scene.platform = {
    cloudId: row.id,
    slug: row.slug,
    visibility: row.visibility,
    ownerId: row.owner_id ?? undefined,
    ownerUsername: owner?.username,
    ownerDisplayName: owner?.display_name,
    description: row.description,
    updatedAt: row.updated_at,
    playCount: row.play_count,
    thumbnailKind: row.thumbnail_kind,
    isOfficial: row.is_official
  };
  return scene;
}

async function rowsToScenes(rows: ProjectRow[]): Promise<ForgeSceneDocument[]> {
  const ownerIds = [...new Set(rows.map((row) => row.owner_id).filter((id): id is string => Boolean(id)))];

  if (ownerIds.length === 0) return rows.map((row) => rowToScene(row));

  const { data: owners, error } = await supabase
    .from("profiles")
    .select("id,username,display_name")
    .in("id", ownerIds);

  if (error) throw error;

  const ownerMap = new Map(
    (owners ?? []).map((owner) => [owner.id, owner as ProjectOwner])
  );

  return rows.map((row) => rowToScene(
    row,
    row.owner_id ? ownerMap.get(row.owner_id) : undefined
  ));
}

export async function loadPublicProjects(): Promise<ForgeSceneDocument[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id,owner_id,slug,name,description,visibility,scene_json,thumbnail_kind,is_official,updated_at,play_count")
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(60);

  if (error) throw error;
  return rowsToScenes(data as ProjectRow[]);
}

export async function loadMyProjects(userId: string): Promise<ForgeSceneDocument[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id,owner_id,slug,name,description,visibility,scene_json,thumbnail_kind,is_official,updated_at,play_count")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return rowsToScenes(data as ProjectRow[]);
}

function cleanSceneForCloud(scene: ForgeSceneDocument): ForgeSceneDocument {
  const clean = structuredClone(scene);
  delete clean.platform;
  return clean;
}

function slugBase(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "place";
}

export async function upsertCloudProject(
  userId: string,
  scene: ForgeSceneDocument
): Promise<ForgeSceneDocument> {
  const clean = cleanSceneForCloud(scene);
  const visibility = scene.platform?.visibility ?? "private";

  if (scene.platform?.cloudId) {
    const { data, error } = await supabase
      .from("projects")
      .update({
        name: scene.name,
        description: scene.platform?.description?.trim() ?? "",
        visibility,
        scene_json: clean
      })
      .eq("id", scene.platform.cloudId)
      .eq("owner_id", userId)
      .select("id,owner_id,slug,name,description,visibility,scene_json,thumbnail_kind,is_official,updated_at,play_count")
      .single();

    if (error) throw error;
    return rowToScene(data as ProjectRow);
  }

  const slug = `${slugBase(scene.name)}-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: userId,
      slug,
      name: scene.name,
      description: scene.platform?.description?.trim() ?? "",
      visibility,
      scene_json: clean,
      thumbnail_kind: "classic",
      is_official: false
    })
    .select("id,owner_id,slug,name,description,visibility,scene_json,thumbnail_kind,is_official,updated_at,play_count")
    .single();

  if (error) throw error;
  return rowToScene(data as ProjectRow);
}

export async function setCloudVisibility(
  userId: string,
  scene: ForgeSceneDocument,
  visibility: CloudVisibility
): Promise<ForgeSceneDocument> {
  const cloudScene = scene.platform?.cloudId
    ? scene
    : await upsertCloudProject(userId, scene);

  const { data, error } = await supabase
    .from("projects")
    .update({
      visibility,
      published_at: visibility === "public" ? new Date().toISOString() : null
    })
    .eq("id", cloudScene.platform!.cloudId!)
    .eq("owner_id", userId)
    .select("id,owner_id,slug,name,description,visibility,scene_json,thumbnail_kind,is_official,updated_at,play_count")
    .single();

  if (error) throw error;
  return rowToScene(data as ProjectRow);
}

export async function deleteCloudProject(userId: string, scene: ForgeSceneDocument): Promise<void> {
  if (!scene.platform?.cloudId) return;

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", scene.platform.cloudId)
    .eq("owner_id", userId);

  if (error) throw error;
}

export async function loadCloudFavoriteIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("favorites")
    .select("project_id")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).map((row) => `cloud:${row.project_id}`);
}

export async function setCloudFavorite(
  userId: string,
  scene: ForgeSceneDocument,
  favorite: boolean
): Promise<void> {
  const projectId = scene.platform?.cloudId;
  if (!projectId) return;

  if (favorite) {
    const { error } = await supabase
      .from("favorites")
      .upsert({ user_id: userId, project_id: projectId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("project_id", projectId);
    if (error) throw error;
  }
}

export async function loadCloudRecentIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("recent_plays")
    .select("project_id,played_at")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .limit(12);

  if (error) throw error;
  return (data ?? []).map((row) => `cloud:${row.project_id}`);
}

export async function markCloudRecent(userId: string, scene: ForgeSceneDocument): Promise<void> {
  const projectId = scene.platform?.cloudId;
  if (!projectId) return;

  const { error } = await supabase
    .from("recent_plays")
    .upsert({
      user_id: userId,
      project_id: projectId,
      played_at: new Date().toISOString()
    });

  if (error) throw error;
}

export async function pingCloud(): Promise<boolean> {
  const { error } = await supabase
    .from("projects")
    .select("id")
    .eq("visibility", "public")
    .limit(1);

  return !error;
}


export interface FriendConnection {
  other_id: string;
  username: string;
  display_name: string;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing" | "friend";
}

export async function requestFriendByUsername(username: string): Promise<"pending" | "accepted"> {
  const { data, error } = await supabase.rpc("friend_request", {
    target_username: username.trim()
  });
  if (error) throw error;
  return data as "pending" | "accepted";
}

export async function loadFriendConnections(): Promise<FriendConnection[]> {
  const { data, error } = await supabase.rpc("friend_connections");
  if (error) throw error;
  return (data ?? []) as FriendConnection[];
}

export async function acceptFriend(requesterId: string): Promise<void> {
  const { error } = await supabase.rpc("friend_accept", {
    requester: requesterId
  });
  if (error) throw error;
}

export async function removeFriend(otherUserId: string): Promise<void> {
  const { error } = await supabase.rpc("friend_remove", {
    other_user: otherUserId
  });
  if (error) throw error;
}
