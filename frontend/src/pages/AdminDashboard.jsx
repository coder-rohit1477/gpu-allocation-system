import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, NavLink }          from 'react-router-dom';
import PortalLayout   from '../components/PortalLayout';
import StatCard       from '../components/StatCard';
import StatusBadge    from '../components/StatusBadge';
import Modal          from '../components/Modal';
import Icon           from '../components/Icon';
import api            from '../api/client';
import gpuService     from '../services/gpu/service';
import requestService from '../services/request/service';
import { toast }      from 'sonner';

// ─── GPU Management ───────────────────────────────────────────────────────────
function GpuManagement() {
  const [gpus,    setGpus]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState({ name:'', model:'', vram:'', cudaCores:'', condition:'New', status:'Available' });
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await gpuService.getAllGpus();
      setGpus(res.data?.data?.gpus ?? []);
    } catch { toast.error('Failed to load GPU resources.'); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => setForm({ name:'', model:'', vram:'', cudaCores:'', condition:'New', status:'Available' });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.model.trim()) { toast.error('Name and model are required.'); return; }
    if (Number(form.vram) <= 0 || !form.vram)   { toast.error('VRAM must be a positive number.'); return; }
    setSaving(true);
    try {
      await gpuService.createGpu({ ...form, vram: Number(form.vram), cudaCores: Number(form.cudaCores) || 0 });
      toast.success('GPU resource added successfully!');
      setModal(false);
      resetForm();
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create GPU.'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">GPU Resources</h1>
          <p className="page-subtitle">Manage all GPU hardware in the system</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setModal(true); }}>
          <Icon name="plus" size={15} /> Add GPU
        </button>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">All GPU Resources ({gpus.length})</h2>
          <button className="btn btn-outline btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
        </div>
        {loading ? (
          <div className="loading-page"><div className="spinner" /><span className="text-muted text-sm" style={{marginLeft:10}}>Loading…</span></div>
        ) : gpus.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🖥️</div>
            <p className="empty-title">No GPU resources found</p>
            <p className="empty-desc">Add your first GPU resource to get started.</p>
            <button className="btn btn-primary" style={{marginTop:12}} onClick={() => { resetForm(); setModal(true); }}>
              <Icon name="plus" size={15} /> Add GPU
            </button>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="portal-table">
              <thead><tr>
                <th>Name</th><th>Model</th><th>VRAM</th><th>CUDA Cores</th><th>Condition</th><th>Status</th>
              </tr></thead>
              <tbody>
                {gpus.map((g) => (
                  <tr key={g._id}>
                    <td><strong>{g.name}</strong></td>
                    <td>{g.model}</td>
                    <td>{g.vram} GB</td>
                    <td>{g.cudaCores?.toLocaleString() || '—'}</td>
                    <td><StatusBadge status={g.condition} /></td>
                    <td><StatusBadge status={g.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add New GPU Resource"
        footer={<>
          <button className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn btn-primary" form="gpu-form" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Add GPU'}
          </button>
        </>}
      >
        <form id="gpu-form" onSubmit={handleSave}>
          <div className="grid-2 mb-3">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-control" placeholder="e.g. RTX 4090 Lab 1"
                value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Model *</label>
              <input className="form-control" placeholder="e.g. RTX 4090"
                value={form.model} onChange={e => setForm(p => ({...p, model:e.target.value}))} required />
            </div>
          </div>
          <div className="grid-2 mb-3">
            <div className="form-group">
              <label className="form-label">VRAM (GB) *</label>
              <input className="form-control" type="number" min="1" placeholder="24"
                value={form.vram} onChange={e => setForm(p => ({...p, vram:e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">CUDA Cores</label>
              <input className="form-control" type="number" min="0" placeholder="16384"
                value={form.cudaCores} onChange={e => setForm(p => ({...p, cudaCores:e.target.value}))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Condition</label>
              <select className="form-control" value={form.condition} onChange={e => setForm(p => ({...p, condition:e.target.value}))}>
                {['New','Used','Refurbished'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-control" value={form.status} onChange={e => setForm(p => ({...p, status:e.target.value}))}>
                {['Available','Maintenance','Decommissioned'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─── All Requests ─────────────────────────────────────────────────────────────
function AllRequests() {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await requestService.getAllRequests();
      setRequests(res.data?.data?.requests ?? []);
    } catch { toast.error('Failed to load requests.'); }
    finally  { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'ALL' ? requests : requests.filter(r => r.status === filter);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">All Requests</h1>
          <p className="page-subtitle">Every GPU request across the system</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </div>
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Requests ({filtered.length})</h2>
          <div className="flex gap-2" style={{flexWrap:'wrap'}}>
            {['ALL','PENDING','APPROVED','REJECTED','COMPLETED'].map(s => (
              <button key={s}
                className={`btn btn-sm ${filter===s ? 'btn-primary' : 'btn-outline'}`}
                style={{fontSize:12, padding:'4px 10px'}}
                onClick={() => setFilter(s)}
              >{s}</button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📋</div><p className="empty-title">No requests found</p></div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table className="portal-table">
              <thead><tr><th>User</th><th>Role</th><th>GPU</th><th>Purpose</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r._id}>
                    <td><strong>{r.userId?.username ?? '—'}</strong></td>
                    <td><span className="text-sm text-muted">{r.userId?.role ?? '—'}</span></td>
                    <td>{r.gpuResourceId?.name ?? <span className="text-muted">Not assigned</span>}</td>
                    <td><span className="truncate" style={{maxWidth:180, display:'block'}}>{r.purpose}</span></td>
                    <td className="text-sm text-muted">{new Date(r.startDate).toLocaleDateString('en-IN')}</td>
                    <td className="text-sm text-muted">{new Date(r.endDate).toLocaleDateString('en-IN')}</td>
                    <td><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Audit Logs — uses static api import, no dynamic import() ─────────────────
function AuditLogs() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/admin/audit-logs');
      setLogs(res.data?.data?.logs ?? []);
    } catch { toast.error('Failed to load audit logs.'); }
    finally  { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Full activity trail across the system</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </div>
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Activity Log ({logs.length})</h2></div>
        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : logs.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🛡️</div><p className="empty-title">No audit entries yet</p></div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table className="portal-table">
              <thead><tr><th>Time</th><th>Actor</th><th>Role</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l._id}>
                    <td className="text-sm text-muted">{new Date(l.createdAt).toLocaleString('en-IN')}</td>
                    <td><strong>{l.actorId?.username ?? '—'}</strong></td>
                    <td><span className="text-sm text-muted">{l.actorId?.role ?? '—'}</span></td>
                    <td><code style={{fontSize:12, background:'rgba(14,34,64,.06)', padding:'2px 6px', borderRadius:4}}>{l.action}</code></td>
                    <td className="text-sm text-muted" style={{maxWidth:240}}>
                      <span className="truncate" style={{display:'block'}}>{JSON.stringify(l.details)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Analytics — uses static api import ───────────────────────────────────────
function Analytics() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/v1/analytics/usage');
      setData(res.data?.data ?? null);
    } catch { toast.error('Failed to load analytics.'); }
    finally  { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;

  const gpu = data?.gpuUtilization      ?? {};
  const req = data?.requestDistribution ?? {};

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Analytics</h1><p className="page-subtitle">System-wide performance metrics</p></div>
        <button className="btn btn-outline btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </div>
      <div className="stats-grid">
        <StatCard icon="🖥️" label="Total GPUs"      value={gpu.total}               variant="navy"   />
        <StatCard icon="✅" label="Available GPUs"   value={gpu.available}           variant="green"  />
        <StatCard icon="📌" label="Allocated GPUs"   value={gpu.allocated}           variant="gold"   />
        <StatCard icon="📊" label="Utilisation Rate" value={gpu.utilizationRate ?? '—'} variant="orange" />
      </div>
      <div className="stats-grid">
        <StatCard icon="📋" label="Total Requests"   value={req.total}    variant="navy"   />
        <StatCard icon="⏳" label="Pending"          value={req.pending}  variant="orange" />
        <StatCard icon="✅" label="Approved"         value={req.approved} variant="green"  />
        <StatCard icon="❌" label="Rejected"         value={req.rejected} variant="red"    />
      </div>
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Request Status Breakdown</h2></div>
        <div className="panel-body">
          {[
            { label:'Approved', val:req.approved, color:'rgb(22,160,80)'  },
            { label:'Pending',  val:req.pending,  color:'rgb(217,119,6)'  },
            { label:'Rejected', val:req.rejected, color:'rgb(185,28,28)'  },
          ].map(({ label, val, color }) => (
            <div key={label} style={{marginBottom:16}}>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-sm text-muted">{val ?? 0} / {req.total ?? 0}</span>
              </div>
              <div style={{height:8, background:'rgb(var(--border))', borderRadius:99, overflow:'hidden'}}>
                <div style={{
                  height:'100%',
                  width: req.total ? `${((val ?? 0) / req.total) * 100}%` : '0%',
                  background: color, borderRadius:99, transition:'width .5s ease'
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Admin Home ───────────────────────────────────────────────────────────────
function AdminHome() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await gpuService.getAnalytics();
      setSummary(res.data?.data ?? {});
    } catch { toast.error('Failed to load dashboard data.'); }
    finally  { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="loading-page"><div className="spinner" /><span className="text-sm text-muted" style={{marginLeft:10}}>Loading dashboard…</span></div>;
  }

  const quickLinks = [
    { to:'/admin/gpus',      icon:'🖥️', title:'GPU Resources', desc:'View and manage hardware'   },
    { to:'/admin/requests',  icon:'📋', title:'All Requests',  desc:'Review allocation history'  },
    { to:'/admin/analytics', icon:'📊', title:'Analytics',     desc:'Usage and performance data'  },
    { to:'/admin/audit',     icon:'🛡️', title:'Audit Logs',    desc:'Full system activity trail' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-subtitle">System overview and quick actions</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon="🖥️" label="Total GPUs"      value={summary?.totalGpus}      variant="navy"   />
        <StatCard icon="✅" label="Available GPUs"  value={summary?.availableGpus}  variant="green"  />
        <StatCard icon="📌" label="Allocated GPUs"  value={summary?.allocatedGpus}  variant="gold"   />
        <StatCard icon="👥" label="Total Users"     value={summary?.totalUsers}      variant="orange" />
        <StatCard icon="📋" label="Total Requests"  value={summary?.totalRequests}   variant="navy"   />
        <StatCard icon="⏳" label="Pending Requests"value={summary?.pendingRequests} variant="orange" />
      </div>

      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Quick Navigation</h2></div>
        <div className="panel-body" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12}}>
          {quickLinks.map(q => (
            <NavLink key={q.to} to={q.to} style={{textDecoration:'none'}}>
              {({ isActive }) => (
                <div style={{
                  padding:16, border:`1px solid ${isActive ? 'rgb(var(--navy-light))' : 'rgb(var(--border))'}`,
                  borderRadius:'var(--radius-md)',
                  background: isActive ? 'rgba(14,34,64,.04)' : 'rgb(var(--surface-2))',
                  transition:'all .17s', cursor:'pointer',
                }}>
                  <div style={{fontSize:26, marginBottom:8}}>{q.icon}</div>
                  <div style={{fontWeight:700, fontSize:14, color:'rgb(var(--navy))', marginBottom:3}}>{q.title}</div>
                  <div style={{fontSize:12, color:'rgb(var(--text-muted))'}}>{q.desc}</div>
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  return (
    <PortalLayout title="Admin">
      <div className="page-body">
        <Routes>
          <Route index            element={<AdminHome />}    />
          <Route path="gpus"      element={<GpuManagement />} />
          <Route path="requests"  element={<AllRequests />}   />
          <Route path="analytics" element={<Analytics />}     />
          <Route path="audit"     element={<AuditLogs />}     />
        </Routes>
      </div>
    </PortalLayout>
  );
}
