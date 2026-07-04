import { requireAdminProfile } from "@/lib/queries/session";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminProfile();

  return (
    <div className="max-w-[760px] animate-fade-up">
      <div className="mb-[18px]">
        <div className="text-[22px] font-bold tracking-tight">Settings</div>
        <div className="mt-[3px] text-text-2">Business profile, notifications &amp; integrations.</div>
      </div>
      <SettingsTabs />
      {children}
    </div>
  );
}
