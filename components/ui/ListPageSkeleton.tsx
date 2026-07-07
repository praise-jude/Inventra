import { Skeleton } from "@/components/ui/Skeleton";

export function ListPageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-fade-up">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <Skeleton className="h-[26px] w-[160px]" />
          <Skeleton className="mt-2 h-[15px] w-[220px]" />
        </div>
        <Skeleton className="h-[37px] w-[130px]" />
      </div>
      <div className="mb-3.5 flex gap-2.5">
        <Skeleton className="h-[37px] flex-1" />
        <Skeleton className="h-[37px] w-[120px]" />
      </div>
      <div className="overflow-hidden rounded-[14px] border border-border bg-surface p-4">
        <div className="flex flex-col gap-3">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-[52px] w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
