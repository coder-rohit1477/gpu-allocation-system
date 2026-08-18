import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@gpu/ui";
import { useAuth } from "../auth/AuthContext.js";
import { ErrorBoundary } from "./ErrorBoundary.js";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/gpu-explorer", label: "GPU Explorer" },
  { to: "/reservations", label: "My Reservations" },
  { to: "/calendar", label: "Weekly Calendar" },
  { to: "/history", label: "Reservation History" },
  { to: "/notifications", label: "Notifications" },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <aside className="app-sidebar">
        <div className="app-sidebar__brand">
          <span aria-hidden="true">🖥️</span> GPU Portal
        </div>
        <nav aria-label="Primary">
          <ul className="app-nav">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `app-nav__link${isActive ? " app-nav__link--active" : ""}`}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div />
          {user && (
            <div className="app-topbar__user">
              <div className="app-topbar__identity">
                <span className="app-topbar__name">{user.fullName}</span>
                <span className="app-topbar__role">{user.role}</span>
              </div>
              <Button variant="secondary" onClick={() => void logout()}>
                Log out
              </Button>
            </div>
          )}
        </header>

        <main id="main-content" className="app-content">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
