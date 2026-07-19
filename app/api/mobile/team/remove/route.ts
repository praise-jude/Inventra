import { NextRequest, NextResponse } from "next/server";
import { resolveAdminTeamContext, removeMemberForContext } from "@/lib/team-service";
import { authenticateMobileRequest, mobileErrorResponse } from "@/lib/mobile-auth";
import { logAudit } from "@/lib/actions/audit";

// Mobile equivalent of removeMember (lib/actions/team.ts).
export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const memberId = (body as { memberId?: unknown })?.memberId;
  if (typeof memberId !== "string") {
    return NextResponse.json({ error: "Missing memberId." }, { status: 400 });
  }

  try {
    const context = await resolveAdminTeamContext(auth.supabase);

    const { data: member } = await auth.supabase
      .from("profiles")
      .select("org_id, first_name, last_name")
      .eq("id", memberId)
      .single();
    if (!member || member.org_id !== context.profile.org_id) throw new Error("Member not found.");

    await removeMemberForContext(auth.supabase, context, memberId);

    await logAudit(
      {
        orgId: context.profile.org_id,
        actorId: context.profile.id,
        actorName: context.actorName,
        actorRole: context.actorRole,
        action: "user.removed",
        module: "Team",
        entityType: "profile",
        entityId: memberId,
        entityLabel: `${member.first_name} ${member.last_name}`,
      },
      auth.supabase,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return mobileErrorResponse(err, "Could not remove this member.");
  }
}
