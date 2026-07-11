import { Skeleton } from "@/components/ui/Skeleton";

export default function NotificationsLoading() {
  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <Skeleton className="h-[26px] w-[200px]" />
        <Skeleton className="mt-2 h-[15px] w-[340px]" />
      </div>
      <div className="rounded-2xl border border-border bg-surface p-10">
        <Skeleton className="mx-auto h-[40px] w-[40px] rounded-full" />
        <Skeleton className="mx-auto mt-3 h-[16px] w-[260px]" />
        <Skeleton className="mx-auto mt-2 h-[13px] w-[380px]" />
      </div>
    </div>
  );
}
