interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`skeleton ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "flex-row-reverse" : ""}`}>
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="space-y-2 max-w-[70%]">
            <Skeleton className="h-16 w-64 rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
