/** Shimmer placeholder block. */
export function Skeleton({
  width = "100%",
  height = 14,
  className = "",
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  return <div className={`skeleton ${className}`.trim()} style={{ width, height }} />;
}

/** A stack of skeleton lines for loading panels. */
export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={12} width={`${100 - i * 12}%`} />
      ))}
    </div>
  );
}
