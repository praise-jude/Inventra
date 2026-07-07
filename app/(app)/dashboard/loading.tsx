import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="animate-fade-up">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <Skeleton className="h-[22px] w-[220px]" />
          <Skeleton className="mt-2 h-[14px] w-[280px]" />
        </div>
        <Skeleton className="h-[37px] w-[110px]" />
      </div>
      <div className="mb-[22px] grid gap-[13px]" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[95px]" />
        ))}
      </div>
      <div className="mb-4 grid gap-4" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <Skeleton className="h-[260px]" />
        <Skeleton className="h-[260px]" />
        <Skeleton className="h-[260px]" />
      </div>
    </div>
  );
}
