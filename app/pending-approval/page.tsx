import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";

// Deliberately does NOT use requireProfile() — that function redirects an
// awaiting_approval profile here, so calling it from this page would loop.
// This does its own minimal, non-redirecting-for-this-case profile check.
export default async function PendingApprovalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("status, rejected_at").eq("id", user.id).single();
  if (!profile) redirect("/login");
  if (profile.rejected_at) {
    await supabase.auth.signOut();
    redirect("/login?rejected=1");
  }
  if (profile.status !== "awaiting_approval") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-hover px-4 py-10">
      <div className="mx-auto max-w-[480px] animate-fade-up text-center">
        <div className="flex flex-col items-center">
          <Image src="/inventra-logo.svg" alt="Inventra" width={56} height={56} />
          <h1 className="mt-4 text-[24px] font-bold tracking-tight">Awaiting approval</h1>
          <p className="mt-1.5 text-[13.5px] text-text-2">
            Your account is set up, but a workspace admin still needs to approve it before you can sign in. You&apos;ll
            get an email as soon as that happens.
          </p>
        </div>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
