export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[9px] bg-border-2 ${className}`} />;
}
