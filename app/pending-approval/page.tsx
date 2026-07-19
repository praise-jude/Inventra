import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { RefreshApprovalButton } from "@/components/auth/RefreshApprovalButton";

// Deliberately does NOT use requireProfile() — that function redirects an
// awaiting_approval profile here, so calling it from this page would loop.
// This does its own minimal, non-redirecting-for-this-case profile check.
export default async function PendingApprovalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, rejected_at, org_id, branch_id, invited_by")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  if (profile.rejected_at) {
    await supabase.auth.signOut();
    redirect("/login?rejected=1");
  }
  if (profile.status !== "awaiting_approval") redirect("/dashboard");

  const [orgRes, branchRes, inviterRes] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", profile.org_id).single(),
    profile.branch_id ? supabase.from("warehouses").select("name").eq("id", profile.branch_id).single() : Promise.resolve({ data: null }),
    profile.invited_by
      ? supabase.from("profiles").select("first_name, last_name").eq("id", profile.invited_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const orgName = orgRes.data?.name ?? "your workspace";
  const branchName = branchRes.data?.name ?? "—";
  const invitedByName = inviterRes.data ? `${inviterRes.data.first_name} ${inviterRes.data.last_name}` : "—";

  return (
    <div className="min-h-screen bg-hover px-4 py-10">
      <div className="mx-auto max-w-[480px] animate-fade-up text-center">
        <div className="flex flex-col items-center">
          <Image src="/inventra-logo.svg" alt="Inventra" width={56} height={56} />
          <h1 className="mt-4 text-[24px] font-bold tracking-tight">Awaiting approval</h1>
          <p className="mt-1.5 text-[13.5px] text-text-2">
            Your account is set up, but your Branch Manager still needs to approve it before you can sign in.
            You&apos;ll get an email as soon as that happens.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-5 text-left">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-text-2">Company</span>
            <span className="text-[13px] font-semibold">{orgName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-text-2">Branch</span>
            <span className="text-[13px] font-semibold">{branchName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-text-2">Invited by</span>
            <span className="text-[13px] font-semibold">{invitedByName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-text-2">Status</span>
            <span className="rounded-full bg-sky-weak px-2.5 py-1 text-[11px] font-bold text-sky">Awaiting approval</span>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-2.5">
          <RefreshApprovalButton />
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
