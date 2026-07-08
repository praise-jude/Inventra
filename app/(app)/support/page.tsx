import { requireProfile } from "@/lib/queries/session";
import { SupportClient } from "@/components/support/SupportClient";

export default async function SupportPage() {
  await requireProfile();
  return <SupportClient />;
}
