import { getSuppliersDetailed } from "@/lib/queries/suppliers";
import { requireProfile } from "@/lib/queries/session";
import { SuppliersClient } from "@/components/suppliers/SuppliersClient";

export default async function SuppliersPage() {
  const [suppliers, { profile }] = await Promise.all([getSuppliersDetailed(), requireProfile()]);
  const canManage = ["owner", "admin", "manager"].includes(profile.role);

  return <SuppliersClient suppliers={suppliers} canManage={canManage} />;
}
