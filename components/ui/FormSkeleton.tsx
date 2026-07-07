import { Skeleton } from "@/components/ui/Skeleton";

export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="animate-fade-up">
      <Skeleton className="mb-4 h-[26px] w-[180px]" />
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-3.5">
          {Array.from({ length: fields }).map((_, i) => (
            <Skeleton key={i} className="h-[42px] w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
