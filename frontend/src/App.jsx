import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate }   from 'react-router-dom';
import { useAuth }                   from './hooks/useAuth';
import { setupApiInterceptors }      from './api/interceptors';
import ErrorBoundary                 from './components/ErrorBoundary';

const Login            = lazy(() => import('./pages/Login'));
const AdminDashboard   = lazy(() => import('./pages/AdminDashboard'));
const FacultyDashboard = lazy(() => import('./pages/FacultyDashboard'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard'));

// ─── Guards ───────────────────────────────────────────────────────────────────

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function RoleGuard({ children, allowedRoles }) {
  const { user } = useAuth();
  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function RoleRedirect() {
  const { user } = useAuth();
  switch (user?.role) {
    case 'ADMIN':   return <Navigate to="/admin"   replace />;
    case 'FACULTY': return <Navigate to="/faculty" replace />;
    case 'STUDENT': return <Navigate to="/student" replace />;
    default:        return <Navigate to="/login"   replace />;
  }
}

const PageLoader = () => (
  <div className="loading-screen">
    <div className="spinner" />
    <span style={{ fontSize: 14, color: 'rgb(var(--text-muted))' }}>Loading…</span>
  </div>
);

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { logout, isAuthenticated } = useAuth();

  useEffect(() => {
    return setupApiInterceptors(logout);
  }, [logout]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ── Public ── */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          path="/signup"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
        />

        {/* ── Role dispatcher ── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RoleRedirect />
            </ProtectedRoute>
          }
        />

        {/* ── Admin ── */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={['ADMIN']}>
                <ErrorBoundary>
                  <AdminDashboard />
                </ErrorBoundary>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* ── Faculty ── */}
        <Route
          path="/faculty/*"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={['FACULTY']}>
                <ErrorBoundary>
                  <FacultyDashboard />
                </ErrorBoundary>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        {/* ── Student ── */}
        <Route
          path="/student/*"
          element={
            <ProtectedRoute>
              <RoleGuard allowedRoles={['STUDENT']}>
                <ErrorBoundary>
                  <StudentDashboard />
                </ErrorBoundary>
              </RoleGuard>
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
        />
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </Suspense>
  );
}
