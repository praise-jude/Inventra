import { Skeleton } from "@/components/ui/Skeleton";

export default function CashRegisterLoading() {
  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <Skeleton className="h-[24px] w-[180px]" />
        <Skeleton className="mt-2 h-[14px] w-[240px]" />
      </div>
      <div className="mb-4 grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[85px]" />
        ))}
      </div>
      <div className="overflow-hidden rounded-[14px] border border-border bg-surface p-4">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[48px] w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
