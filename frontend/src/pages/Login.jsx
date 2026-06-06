import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth }  from '../hooks/useAuth';
import authService  from '../services/auth/service';
import { toast }    from 'sonner';

const FEATURES = [
  { icon: '🖥️', text: 'Allocate high-performance GPU resources to faculty and students' },
  { icon: '📊', text: 'Real-time usage analytics and system monitoring' },
  { icon: '🔒', text: 'Role-based access control for secure resource management' },
];

export default function Login() {
  const location     = useLocation();
  const isSignupMode = location.pathname === '/signup';

  const [username,         setUsername]         = useState('');
  const [password,         setPassword]         = useState('');
  const [confirmPassword,  setConfirmPassword]  = useState('');
  const [loading,          setLoading]          = useState(false);

  const { login }  = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      toast.error('Please enter both username and password.');
      return;
    }
    if (isSignupMode && password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Signup always creates STUDENT — role is not passed
      const response = isSignupMode
        ? await authService.signup({ username: username.trim(), password })
        : await authService.login({ username: username.trim(), password });

      const didLogin = login(response?.token);
      if (!didLogin) throw new Error('Received an invalid token from the server.');

      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        err.message ||
        (isSignupMode ? 'Unable to create your account.' : 'Invalid credentials. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      {/* ── Left panel ── */}
      <div className="login-left">
        <div className="login-left-glow-1" />
        <div className="login-left-glow-2" />
        <div className="login-brand">
          <div className="login-brand-mark">🖥️</div>
          <h1 className="login-brand-name" style={{ color: '#fff' }}>GPU Manager</h1>
          <p className="login-brand-desc">
            Centralised GPU resource allocation and management for your institution.
          </p>
        </div>
        <div className="login-features">
          {FEATURES.map((f, i) => (
            <div className="login-feat" key={i}>
              <div className="login-feat-icon">{f.icon}</div>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="login-right">
        <div className="login-card">
          <h2 className="login-card-title">{isSignupMode ? 'Create account' : 'Welcome back'}</h2>
          <p className="login-card-subtitle">
            {isSignupMode
              ? 'Register as a student to access GPU resources'
              : 'Sign in to access the GPU resource portal'}
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group mb-4">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                id="username" className="form-control" type="text"
                placeholder="Enter your username"
                value={username} onChange={(e) => setUsername(e.target.value)}
                autoComplete="username" autoFocus
              />
            </div>

            <div className="form-group mb-4">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password" className="form-control" type="password"
                placeholder="Enter your password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignupMode ? 'new-password' : 'current-password'}
              />
            </div>

            {isSignupMode && (
              <>
                <div className="form-group mb-4">
                  <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
                  <input
                    id="confirm-password" className="form-control" type="password"
                    placeholder="Re-enter your password"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                {/* Role dropdown intentionally removed from public signup.
                    Faculty and Admin accounts are created by admins only via the admin panel. */}
                <div className="alert alert-info mb-4" style={{ fontSize: 13 }}>
                  <span>🎓</span>
                  Student accounts only. Faculty/Admin accounts are provisioned by your administrator.
                </div>
              </>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              style={{ justifyContent: 'center', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  {isSignupMode ? 'Creating account…' : 'Signing in…'}
                </>
              ) : (isSignupMode ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="divider" style={{ marginTop: 28, marginBottom: 16 }} />

          {isSignupMode ? (
            <p style={{ textAlign: 'center', fontSize: 13, color: 'rgb(var(--text-muted))' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'rgb(var(--navy))', fontWeight: 700 }}>Sign in</Link>
            </p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { role: 'ADMIN',   user: 'admin',   pass: 'Admin@1234'   },
                  { role: 'FACULTY', user: 'faculty', pass: 'Faculty@1234' },
                  { role: 'STUDENT', user: 'student', pass: 'Student@1234' },
                ].map((d) => (
                  <button
                    key={d.role}
                    className="btn btn-outline btn-sm"
                    style={{ justifyContent: 'center', fontSize: 12 }}
                    onClick={() => { setUsername(d.user); setPassword(d.pass); }}
                    type="button"
                  >
                    {d.role}
                  </button>
                ))}
              </div>
              <p style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'rgb(var(--text-muted))' }}>
                Demo credentials — click to auto-fill
              </p>
              <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgb(var(--text-muted))' }}>
                Need an account?{' '}
                <Link to="/signup" style={{ color: 'rgb(var(--navy))', fontWeight: 700 }}>Create one</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
