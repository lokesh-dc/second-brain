"use client";

function Bar({ w = "w-full", h = "h-3" }: { w?: string; h?: string }) {
  return <div className={`animate-pulse rounded-full bg-line ${w} ${h}`} />;
}

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-line bg-white p-5 ${className}`}
      aria-hidden="true"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-line" />
        <Bar w="w-24" h="h-2.5" />
      </div>
      <Bar w="w-full" h="h-3.5" />
      <div className="mt-2">
        <Bar w="w-4/5" h="h-3.5" />
      </div>
    </div>
  );
}

export function DigestSkeleton() {
  return (
    <div
      className="flex flex-col gap-6 md:grid md:grid-cols-2 md:items-start md:gap-x-8"
      role="status"
      aria-label="Loading digest"
    >
      <div className="md:col-start-1 md:row-start-1">
        <div className="rounded-2xl border border-line bg-white p-5">
          <Bar w="w-full" h="h-4" />
          <div className="mt-2.5">
            <Bar w="w-full" h="h-4" />
          </div>
          <div className="mt-2.5">
            <Bar w="w-2/3" h="h-4" />
          </div>
          <div className="mt-5">
            <Bar w="w-28" h="h-2.5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:col-start-2 md:row-start-1 md:row-span-2 md:grid-cols-1 md:gap-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="flex flex-col gap-2.5 md:col-start-1 md:row-start-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-line bg-white p-3"
            aria-hidden="true"
          >
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-line" />
            <Bar w="w-28" h="h-3" />
            <div className="ml-auto">
              <Bar w="w-12" h="h-3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
