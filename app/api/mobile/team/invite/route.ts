import { NextRequest, NextResponse } from "next/server";
import { resolveAdminTeamContext, inviteMemberForContext } from "@/lib/team-service";
import { authenticateMobileRequest, mobileErrorResponse } from "@/lib/mobile-auth";
import { logAudit } from "@/lib/actions/audit";

// Mobile equivalent of inviteMember (lib/actions/team.ts).
export async function POST(req: NextRequest) {
  const auth = await authenticateMobileRequest(req);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const { email, role, firstName, lastName, branchId } = body as {
    email?: unknown;
    role?: unknown;
    firstName?: unknown;
    lastName?: unknown;
    branchId?: unknown;
  };
  if (typeof email !== "string" || typeof role !== "string" || typeof firstName !== "string" || typeof lastName !== "string" || typeof branchId !== "string") {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const context = await resolveAdminTeamContext(auth.supabase);
    await inviteMemberForContext(context, { email, role, firstName, lastName, branchId });

    await logAudit(
      {
        orgId: context.profile.org_id,
        actorId: context.profile.id,
        actorName: context.actorName,
        actorRole: context.actorRole,
        action: "user.invited",
        module: "Team",
        entityType: "profile",
        entityLabel: `${firstName} ${lastName} (${email})`,
        newValue: { email, role, branchId },
      },
      auth.supabase,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return mobileErrorResponse(err, "Could not send the invite email.");
  }
}
