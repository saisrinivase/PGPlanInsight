export function Brand({ onHome }: { onHome: () => void }) {
  return <button className="brand" onClick={onHome} aria-label="PGPlan Insight home"><span className="brand-mark">PG</span><span>PGPlan <b>Insight</b><small>v1.0.0 · PostgreSQL-native</small></span></button>;
}
