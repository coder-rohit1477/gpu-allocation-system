const MAP = {
  Available:   'badge-available',
  Allocated:   'badge-allocated',
  'In Use':    'badge-allocated',
  Maintenance: 'badge-maintenance',
  Decommissioned:'badge-maintenance',
  PENDING:     'badge-pending',
  APPROVED:    'badge-approved',
  REJECTED:    'badge-rejected',
  COMPLETED:   'badge-completed',
  New:         'badge-new',
  Used:        'badge-used',
  Refurbished: 'badge-refurbished',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`badge ${MAP[status] ?? ''}`}>
      {status}
    </span>
  );
}
