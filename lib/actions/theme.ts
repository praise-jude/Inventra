"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function setTheme(resolved: "light" | "dark", preference: "light" | "dark" | "system" = resolved) {
  const cookieStore = await cookies();
  cookieStore.set("theme", resolved, { path: "/", maxAge: 60 * 60 * 24 * 365 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").update({ theme_preference: preference }).eq("id", user.id);
  }
}
