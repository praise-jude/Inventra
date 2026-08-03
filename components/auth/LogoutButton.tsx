"use client";

import { useRouter } from "next/navigation";
import { recordLogout } from "@/lib/actions/audit";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    // Must run before signOut() — recordLogout needs the still-valid
    // session to attribute the audit entry to this user.
    await recordLogout();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <Button variant="secondary" onClick={handleLogout}>
      Log out
    </Button>
  );
}
