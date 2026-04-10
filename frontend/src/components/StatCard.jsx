export default function StatCard({ icon, label, value, variant = 'navy', trend }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${variant}`}>{icon}</div>
      <div className="stat-info">
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
        {trend && <div style={{ fontSize:12, marginTop:4, color: trend > 0 ? 'rgb(22,160,80)' : 'rgb(185,28,28)' }}>
          {trend > 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last month
        </div>}
      </div>
    </div>
  );
}
