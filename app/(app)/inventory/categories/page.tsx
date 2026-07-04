import { getCategoriesDetailed } from "@/lib/queries/categories";
import { requireProfile } from "@/lib/queries/session";
import { CategoriesClient } from "@/components/categories/CategoriesClient";

export default async function CategoriesPage() {
  const [categories, { profile }] = await Promise.all([getCategoriesDetailed(), requireProfile()]);
  const canManage = ["owner", "admin", "manager"].includes(profile.role);

  return <CategoriesClient categories={categories} canManage={canManage} />;
}
