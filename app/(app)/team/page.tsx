import { getTeamMembers } from "@/lib/queries/team";
import { requireProfile } from "@/lib/queries/session";
import { TeamClient } from "@/components/team/TeamClient";

const PLAN_SEATS: Record<string, number> = { starter: 2, growth: 15, scale: 999 };

export default async function TeamPage() {
  const [members, { org }] = await Promise.all([getTeamMembers(), requireProfile()]);
  const seatsTotal = PLAN_SEATS[org.plan] ?? 5;

  return <TeamClient members={members} seatsUsed={members.length} seatsTotal={seatsTotal} />;
}
