import { requireProfile } from "@/lib/queries/session";
import { getNotifications } from "@/lib/actions/notifications";
import { NotificationsClient } from "@/components/notifications/NotificationsClient";

export default async function NotificationsPage() {
  const { profile } = await requireProfile();
  const notifications = await getNotifications();

  return <NotificationsClient initialNotifications={notifications} userId={profile.id} />;
}
