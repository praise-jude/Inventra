import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Organization, Profile } from "@/lib/supabase/database.types";

// The (app) layout calls this for the shell chrome, and most pages call it
// again for their own data — cache() dedupes to one auth+profile+org round
// trip per request instead of two.
export const requireProfile = cache(async (): Promise<{ profile: Profile; org: Organization }> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) redirect("/login");

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", profile.org_id)
    .single<Organization>();
  if (!org) redirect("/login");

  return { profile, org };
});
