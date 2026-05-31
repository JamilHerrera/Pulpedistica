export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`skeleton ${className}`} />
  )
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass-card p-4 flex gap-3 items-center">
          <div className="skeleton w-10 h-10 rounded-xl" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="skeleton h-4 w-3/4 rounded-lg" />
            <div className="skeleton h-3 w-1/2 rounded-lg" />
          </div>
          <div className="skeleton h-6 w-12 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1,2,3,4].map((i) => (
        <div key={i} className="glass-card p-4">
          <div className="skeleton h-3 w-16 rounded mb-3" />
          <div className="skeleton h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  )
}
