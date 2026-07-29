"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/audit";

// Fire-and-forget from SupportClient.tsx's copy-to-clipboard actions —
// mirrors src/app/(app)/support.tsx's logAudit call on mobile (there it
// fires after actually opening mail/WhatsApp; web only has a copy action,
// so this is the closest equivalent "engaged with a support contact
// method" signal). Never throws — a failed log must never surface as an
// error on what's otherwise just a clipboard copy.
export async function logSupportContact(method: string): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, role, first_name, last_name")
      .eq("id", user.id)
      .single();
    if (!profile) return;

    await logAudit({
      orgId: profile.org_id,
      actorId: user.id,
      actorName: `${profile.first_name} ${profile.last_name}`,
      actorRole: profile.role,
      action: "support.contacted",
      module: "Support",
      entityType: "contact_method",
      entityLabel: method,
    });
  } catch (err) {
    console.error("[Inventra] logSupportContact failed:", err);
  }
}
