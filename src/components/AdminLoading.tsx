// Archive-native loading state. The Aquarell app uses a soft, glassy shimmer
// (see PageLoading in LoadingState.tsx); the archive is a sharp editorial grid,
// so its skeleton echoes that language instead — hairline boxes, square corners
// and a slow ink-green sweep rather than pastel rounded pills.
export function AdminLoading({ label = "Lädt" }: { label?: string }) {
  return (
    <div className="admin-loading" role="status" aria-label={label}>
      <div className="admin-loading-head">
        <span>{label} …</span>
      </div>
      <div className="admin-stat-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="admin-skeleton admin-skeleton-stat" />
        ))}
      </div>
      <div className="admin-skeleton-panel">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="admin-skeleton-row">
            <div className="admin-skeleton admin-skeleton-avatar" />
            <div className="admin-skeleton-lines">
              <div className="admin-skeleton admin-skeleton-line" style={{ width: `${72 - i * 6}%` }} />
              <div className="admin-skeleton admin-skeleton-line" style={{ width: `${44 - i * 4}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
