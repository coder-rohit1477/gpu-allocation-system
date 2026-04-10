import { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Icon from './Icon';

// ─── Nav config per role ──────────────────────────────────────────────────────
const NAV_CONFIG = {
  ADMIN: [
    {
      section: 'Overview',
      items: [
        { to: '/admin',           icon: 'dashboard', label: 'Dashboard'      },
        { to: '/admin/analytics', icon: 'analytics', label: 'Analytics'      },
      ],
    },
    {
      section: 'Management',
      items: [
        { to: '/admin/gpus',      icon: 'gpu',       label: 'GPU Resources'  },
        { to: '/admin/requests',  icon: 'request',   label: 'All Requests'   },
        { to: '/admin/audit',     icon: 'audit',     label: 'Audit Logs'     },
      ],
    },
  ],
  FACULTY: [
    {
      section: 'Overview',
      items: [
        { to: '/faculty',         icon: 'dashboard', label: 'Dashboard'      },
      ],
    },
    {
      section: 'Requests',
      items: [
        { to: '/faculty/pending', icon: 'request',   label: 'Pending Review' },
      ],
    },
  ],
  STUDENT: [
    {
      section: 'Overview',
      items: [
        { to: '/student',         icon: 'dashboard', label: 'Dashboard'      },
      ],
    },
    {
      section: 'GPU Access',
      items: [
        { to: '/student/requests',icon: 'request',   label: 'My Requests'    },
        { to: '/student/gpus',    icon: 'gpu',       label: 'Available GPUs' },
      ],
    },
  ],
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const role    = user?.role ?? 'STUDENT';
  const navGroups = NAV_CONFIG[role] ?? [];
  const initials  = user?.username?.slice(0, 2).toUpperCase() ?? 'U';

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="sidebar-backdrop" onClick={onClose} style={{ position:'fixed',inset:0,zIndex:39,background:'rgba(0,0,0,.4)' }} />}

      <aside className={`sidebar${open ? ' open' : ''}`}>
        {/* Logo */}
        <a href="#" className="sidebar-logo" onClick={(e) => e.preventDefault()}>
          <div className="sidebar-logo-mark">🖥️</div>
          <div>
            <div className="sidebar-logo-name">GPU Manager</div>
            <div className="sidebar-logo-sub">Resource Portal</div>
          </div>
        </a>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.section}>
              <div className="sidebar-section">{group.section}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to.split('/').length <= 2}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  onClick={onClose}
                >
                  <Icon name={item.icon} size={17} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="sidebar-uname truncate">{user?.username}</div>
              <div className="sidebar-urole">{role}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={logout}>
            <Icon name="logout" size={14} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────
function Topbar({ onMenuToggle, title }) {
  const { user } = useAuth();
  const now = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-menu-btn" onClick={onMenuToggle} aria-label="Toggle menu">
          <Icon name="menu" size={20} />
        </button>
        <div className="breadcrumb">
          <span>Portal</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">{title}</span>
        </div>
      </div>
      <div className="topbar-right">
        <span className="topbar-date">{now}</span>
        <div className="topbar-badge">{user?.role}</div>
      </div>
    </header>
  );
}

// ─── PortalLayout ─────────────────────────────────────────────────────────────
export default function PortalLayout({ children, title = 'Dashboard' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const toggleSidebar = useCallback(() => setSidebarOpen((p) => !p), []);
  const closeSidebar  = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="portal-layout">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="main-content">
        <Topbar onMenuToggle={toggleSidebar} title={title} />
        {children}
      </div>
    </div>
  );
}
