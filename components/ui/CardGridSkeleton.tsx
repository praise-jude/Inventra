import { Skeleton } from "@/components/ui/Skeleton";

export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="animate-fade-up">
      <div className="mb-3.5 flex justify-end">
        <Skeleton className="h-[37px] w-[140px]" />
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-[180px] w-full" />
        ))}
      </div>
    </div>
  );
}
