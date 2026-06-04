import { useEffect, useState, useCallback }  from 'react';
import { Routes, Route, useNavigate }         from 'react-router-dom';
import PortalLayout   from '../components/PortalLayout';
import StatCard       from '../components/StatCard';
import StatusBadge    from '../components/StatusBadge';
import Modal          from '../components/Modal';
import Icon           from '../components/Icon';
import requestService from '../services/request/service';
import gpuService     from '../services/gpu/service';
import { toast }      from 'sonner';

// ─── Pending Requests sub-page ────────────────────────────────────────────────
function PendingRequests() {
  const [requests,     setRequests]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [approveModal, setApproveModal] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);   // replaces window.confirm
  const [gpus,         setGpus]         = useState([]);
  const [selGpu,       setSelGpu]       = useState('');
  const [saving,       setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, gpuRes] = await Promise.all([
        requestService.getPendingRequests(),
        gpuService.getAvailableGpus(),
      ]);
      setRequests(reqRes.data?.data?.requests ?? []);
      setGpus(gpuRes.data?.data?.gpus ?? []);
    } catch { toast.error('Failed to load data.'); }
    finally  { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openApprove = (req) => { setApproveModal(req); setSelGpu(''); };

  const handleApprove = async () => {
    if (!selGpu) { toast.error('Please select a GPU to allocate.'); return; }
    setSaving(true);
    try {
      await requestService.approveRequest(approveModal._id, selGpu);
      toast.success('Request approved and GPU allocated!');
      setApproveModal(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Approval failed.'); }
    finally { setSaving(false); }
  };

  // ── Reject — no window.confirm, uses Modal instead ──
  const handleReject = async () => {
    if (!rejectTarget) return;
    setSaving(true);
    try {
      await requestService.rejectRequest(rejectTarget._id);
      toast.success('Request rejected.');
      setRejectTarget(null);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Rejection failed.'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pending Requests</h1>
          <p className="page-subtitle">Review and act on student GPU allocation requests</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}>
          <Icon name="refresh" size={14} /> Refresh
        </button>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Awaiting Review ({requests.length})</h2>
        </div>
        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <p className="empty-title">All caught up!</p>
            <p className="empty-desc">No pending requests at this time.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Student</th><th>GPU Requested</th><th>Purpose</th>
                  <th>Duration</th><th>Submitted</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r._id}>
                    <td><strong>{r.userId?.username ?? '—'}</strong></td>
                    <td>{r.gpuResourceId?.model ?? <span className="text-muted">Any available</span>}</td>
                    <td>
                      <span title={r.purpose} className="truncate" style={{ maxWidth: 200, display: 'block' }}>
                        {r.purpose}
                      </span>
                    </td>
                    <td className="text-sm text-muted">
                      {new Date(r.startDate).toLocaleDateString('en-IN')} →{' '}
                      {new Date(r.endDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="text-sm text-muted">
                      {new Date(r.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-success btn-sm" onClick={() => openApprove(r)}>
                          <Icon name="check" size={13} /> Approve
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setRejectTarget(r)}>
                          <Icon name="x" size={13} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Approve + GPU allocation modal ── */}
      <Modal
        open={!!approveModal}
        onClose={() => setApproveModal(null)}
        title="Approve & Allocate GPU"
        footer={<>
          <button className="btn btn-outline" onClick={() => setApproveModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleApprove} disabled={saving}>
            {saving ? 'Approving…' : 'Confirm Approval'}
          </button>
        </>}
      >
        <p style={{ fontSize: 14, color: 'rgb(var(--text-secondary))', marginBottom: 16 }}>
          Allocating a GPU for <strong>{approveModal?.userId?.username}</strong>:
          &ldquo;{approveModal?.purpose?.slice(0, 60)}&rdquo;
        </p>
        <div className="form-group">
          <label className="form-label">Select GPU to Allocate *</label>
          <select className="form-control" value={selGpu} onChange={(e) => setSelGpu(e.target.value)}>
            <option value="">— Choose a GPU —</option>
            {gpus.map((g) => (
              <option key={g._id} value={g._id}>{g.name} ({g.vram} GB VRAM)</option>
            ))}
          </select>
        </div>
        {gpus.length === 0 && (
          <div className="alert alert-info" style={{ marginTop: 12 }}>
            <Icon name="info" size={16} />
            No available GPUs currently. Add or free up a GPU first.
          </div>
        )}
      </Modal>

      {/* ── Reject confirmation modal — replaces window.confirm ── */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject Request"
        footer={<>
          <button className="btn btn-outline" onClick={() => setRejectTarget(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={handleReject} disabled={saving}>
            {saving ? 'Rejecting…' : 'Confirm Rejection'}
          </button>
        </>}
      >
        <p style={{ fontSize: 14, color: 'rgb(var(--text-secondary))' }}>
          Are you sure you want to reject the request from{' '}
          <strong>{rejectTarget?.userId?.username}</strong>?
        </p>
        <p style={{ fontSize: 13, color: 'rgb(var(--text-muted))', marginTop: 8 }}>
          &ldquo;{rejectTarget?.purpose?.slice(0, 120)}&rdquo;
        </p>
        <div className="alert alert-error" style={{ marginTop: 12 }}>
          <Icon name="info" size={16} />
          This action cannot be undone.
        </div>
      </Modal>
    </>
  );
}

// ─── Faculty Home ─────────────────────────────────────────────────────────────
function FacultyHome() {
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState('…');

  useEffect(() => {
    requestService.getPendingRequests()
      .then((res) => setPendingCount(res.data?.data?.requests?.length ?? 0))
      .catch(() => setPendingCount('—'));
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Faculty Dashboard</h1>
          <p className="page-subtitle">Manage student GPU allocation requests</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon="⏳" label="Pending Review" value={pendingCount} variant="orange" />
        <StatCard icon="🖥️" label="Available GPUs" value="—"           variant="navy"   />
        <StatCard icon="✅" label="Approved Today"  value="—"           variant="green"  />
      </div>

      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Actions</h2></div>
        <div className="panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
            <div style={{
              padding: 20, border: '1px solid rgb(var(--border))',
              borderRadius: 'var(--radius-md)', background: 'rgb(var(--surface-2))',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⏳</div>
              <div style={{ fontWeight: 700, color: 'rgb(var(--navy))', marginBottom: 4 }}>
                Review Pending Requests
              </div>
              <div style={{ fontSize: 13, color: 'rgb(var(--text-muted))', marginBottom: 14 }}>
                Approve or reject GPU allocation requests from students.
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/faculty/pending')}>
                Go to Pending
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function FacultyDashboard() {
  return (
    <PortalLayout title="Faculty">
      <div className="page-body">
        <Routes>
          <Route index          element={<FacultyHome />}     />
          <Route path="pending" element={<PendingRequests />} />
        </Routes>
      </div>
    </PortalLayout>
  );
}
