export function Brand({ className = '' }: { className?: string }) {
  return (
    <div className={`horizon-brand ${className}`}>
      <span className="horizon-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path d="M8 18a8 8 0 0 1 16 0M5 19h22M8 24h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M16 5v2M5 11l2 1M27 11l-2 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </span>
      <span>Horizon</span>
    </div>
  )
}
