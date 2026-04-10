import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, useNavigate }        from 'react-router-dom';
import PortalLayout   from '../components/PortalLayout';
import StatCard       from '../components/StatCard';
import StatusBadge    from '../components/StatusBadge';
import Modal          from '../components/Modal';
import Icon           from '../components/Icon';
import requestService from '../services/request.service';
import gpuService     from '../services/gpu.service';
import { useAuth }    from '../hooks/useAuth';
import { toast }      from 'sonner';

const INIT_FORM = { gpuResourceId:'', purpose:'', startDate:'', endDate:'' };

// ─── My Requests sub-page ─────────────────────────────────────────────────────
function MyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(false);
  const [gpus,     setGpus]     = useState([]);
  const [form,     setForm]     = useState(INIT_FORM);
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, gpuRes] = await Promise.all([
        requestService.getMyRequests(),
        gpuService.getAvailableGpus(),
      ]);
      setRequests(reqRes.data?.data?.requests ?? []);
      setGpus(gpuRes.data?.data?.gpus ?? []);
    } catch { toast.error('Failed to load data.'); }
    finally  { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const closeModal = () => { setModal(false); setForm(INIT_FORM); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.gpuResourceId)          { toast.error('Please select a GPU.');      return; }
    if (!form.purpose.trim())         { toast.error('Purpose is required.');      return; }
    if (!form.startDate||!form.endDate){ toast.error('Both dates are required.'); return; }
    if (new Date(form.startDate) >= new Date(form.endDate)) {
      toast.error('End date must be after start date.'); return;
    }
    setSaving(true);
    try {
      await requestService.submitRequest(form);
      toast.success('GPU request submitted successfully!');
      closeModal();
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit request.'); }
    finally { setSaving(false); }
  };

  const counts = requests.reduce((acc, r) => { acc[r.status] = (acc[r.status]||0)+1; return acc; }, {});
  const today  = new Date().toISOString().split('T')[0];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Requests</h1>
          <p className="page-subtitle">Track and manage your GPU allocation requests</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(INIT_FORM); setModal(true); }}>
          <Icon name="plus" size={15} /> New Request
        </button>
      </div>

      <div className="stats-grid">
        <StatCard icon="📋" label="Total Requests" value={requests.length}              variant="navy"   />
        <StatCard icon="⏳" label="Pending"         value={counts.PENDING   ?? 0}       variant="orange" />
        <StatCard icon="✅" label="Approved"        value={counts.APPROVED  ?? 0}       variant="green"  />
        <StatCard icon="🏁" label="Completed"       value={counts.COMPLETED ?? 0}       variant="navy"   />
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Request History</h2>
          <button className="btn btn-outline btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
        </div>
        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🖥️</div>
            <p className="empty-title">No requests yet</p>
            <p className="empty-desc">Submit your first GPU request to get started.</p>
            <button className="btn btn-primary" style={{marginTop:12}} onClick={() => { setForm(INIT_FORM); setModal(true); }}>
              <Icon name="plus" size={15} /> New Request
            </button>
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table className="portal-table">
              <thead><tr><th>GPU</th><th>Model</th><th>Purpose</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r._id}>
                    <td><strong>{r.gpuResourceId?.name ?? '—'}</strong></td>
                    <td className="text-sm text-muted">{r.gpuResourceId?.model ?? '—'}</td>
                    <td><span className="truncate" style={{maxWidth:200, display:'block'}}>{r.purpose}</span></td>
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

      <Modal
        open={modal}
        onClose={closeModal}
        title="Submit GPU Request"
        footer={<>
          <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" form="req-form" type="submit" disabled={saving}>
            {saving ? 'Submitting…' : 'Submit Request'}
          </button>
        </>}
      >
        <form id="req-form" onSubmit={handleSubmit}>
          <div className="form-group mb-3">
            <label className="form-label">Select GPU *</label>
            <select className="form-control" value={form.gpuResourceId}
              onChange={e => setForm(p => ({...p, gpuResourceId:e.target.value}))} required>
              <option value="">— Choose an available GPU —</option>
              {gpus.map(g => (
                <option key={g._id} value={g._id}>{g.name} — {g.vram} GB VRAM</option>
              ))}
            </select>
            {gpus.length === 0 && <p className="text-sm text-muted mt-1">No GPUs available at this time.</p>}
          </div>
          <div className="form-group mb-3">
            <label className="form-label">Purpose *</label>
            <textarea className="form-control" rows={3}
              placeholder="Describe your use case (e.g. ML model training for final year project)…"
              value={form.purpose} onChange={e => setForm(p => ({...p, purpose:e.target.value}))} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input className="form-control" type="date" value={form.startDate} min={today}
                onChange={e => setForm(p => ({...p, startDate:e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input className="form-control" type="date" value={form.endDate}
                min={form.startDate || today}
                onChange={e => setForm(p => ({...p, endDate:e.target.value}))} required />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ─── Available GPUs sub-page ──────────────────────────────────────────────────
function AvailableGPUs() {
  const [gpus,    setGpus]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gpuService.getAvailableGpus()
      .then(res => setGpus(res.data?.data?.gpus ?? []))
      .catch(() => toast.error('Failed to load GPUs.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <div><h1 className="page-title">Available GPUs</h1><p className="page-subtitle">Browse GPUs you can request access to</p></div>
      </div>
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Available Resources ({gpus.length})</h2></div>
        {loading ? (
          <div className="loading-page"><div className="spinner" /></div>
        ) : gpus.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">😔</div>
            <p className="empty-title">No GPUs available right now</p>
            <p className="empty-desc">Check back later or contact your faculty.</p>
          </div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16, padding:20}}>
            {gpus.map(g => (
              <div key={g._id} style={{
                border:'1px solid rgb(var(--border))', borderRadius:'var(--radius-md)',
                padding:20, background:'rgb(var(--surface-2))',
              }}>
                <div style={{fontSize:28, marginBottom:10}}>🖥️</div>
                <div style={{fontWeight:700, color:'rgb(var(--navy))', fontSize:15, marginBottom:2}}>{g.name}</div>
                <div style={{fontSize:13, color:'rgb(var(--text-muted))', marginBottom:14}}>{g.model}</div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14}}>
                  {[['VRAM', `${g.vram} GB`], ['CUDA', g.cudaCores?.toLocaleString() || '—']].map(([k,v]) => (
                    <div key={k} style={{background:'rgb(var(--surface))', borderRadius:'var(--radius-sm)', padding:'8px 10px'}}>
                      <div style={{fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'rgb(var(--text-muted))' }}>{k}</div>
                      <div style={{fontSize:14, fontWeight:700, color:'rgb(var(--navy))'}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center">
                  <StatusBadge status={g.condition} />
                  <StatusBadge status={g.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Student Home ─────────────────────────────────────────────────────────────
function StudentHome() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {user?.username}!</h1>
          <p className="page-subtitle">Request GPU resources for your projects and research</p>
        </div>
      </div>

      {/* Hero CTA */}
      <div className="panel" style={{marginBottom:20}}>
        <div className="panel-body" style={{
          background:'linear-gradient(135deg,rgb(var(--navy)) 0%,rgb(var(--navy-light)) 100%)',
          borderRadius:'var(--radius-lg)', padding:28,
        }}>
          <h3 style={{color:'#fff', margin:'0 0 8px', fontFamily:"'Playfair Display',serif", fontSize:20}}>
            Need GPU resources?
          </h3>
          <p style={{color:'rgba(255,255,255,.62)', fontSize:14, margin:'0 0 18px'}}>
            Browse available GPUs and submit an allocation request for your project.
          </p>
          <button className="btn btn-gold" onClick={() => navigate('/student/requests')}>
            Submit a Request →
          </button>
        </div>
      </div>

      {/* Quick links — also using onClick + navigate */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
        {[
          { icon:'📋', title:'My Requests',  desc:'Track the status of your GPU allocation requests.',  to:'/student/requests' },
          { icon:'🖥️', title:'Browse GPUs',  desc:'See all currently available GPU resources.',          to:'/student/gpus'     },
        ].map(c => (
          <div
            key={c.title}
            className="panel"
            style={{cursor:'pointer'}}
            onClick={() => navigate(c.to)}
          >
            <div className="panel-body">
              <div style={{fontSize:28, marginBottom:10}}>{c.icon}</div>
              <div style={{fontWeight:700, color:'rgb(var(--navy))', marginBottom:4}}>{c.title}</div>
              <div style={{fontSize:13, color:'rgb(var(--text-muted))'}}>{c.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  return (
    <PortalLayout title="Student">
      <div className="page-body">
        <Routes>
          <Route index           element={<StudentHome />}   />
          <Route path="requests" element={<MyRequests />}    />
          <Route path="gpus"     element={<AvailableGPUs />} />
        </Routes>
      </div>
    </PortalLayout>
  );
}
