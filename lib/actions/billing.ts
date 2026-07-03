"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function changePlan(planKey: "starter" | "growth" | "scale") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase.from("profiles").select("org_id, role").eq("id", user.id).single();
  if (!profile) throw new Error("No profile");
  if (!["owner", "admin"].includes(profile.role)) {
    throw new Error("Only an owner or admin can change the plan.");
  }

  const { error } = await supabase.from("organizations").update({ plan: planKey }).eq("id", profile.org_id);
  if (error) throw error;
  revalidatePath("/billing");
}
