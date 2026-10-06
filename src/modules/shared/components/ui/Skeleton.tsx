import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-slate-200/80 dark:bg-slate-800/80 animate-shimmer",
        className
      )}
      {...props}
    />
  );
}

export function ProductSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-3 shadow-xs flex flex-col justify-between space-y-2.5">
      <Skeleton className="w-full aspect-square rounded-xl" />
      <div className="space-y-1.5 pt-1">
        <Skeleton className="h-3.5 w-4/5 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-4 w-16 rounded-md" />
        <Skeleton className="h-6 w-14 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return <ProductSkeleton />;
}
