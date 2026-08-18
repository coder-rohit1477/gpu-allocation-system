import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { AdminLayout } from "./components/AdminLayout.js";
import { AdminProtectedRoute } from "./components/AdminProtectedRoute.js";
import { FacultyLayout } from "./components/FacultyLayout.js";
import { FacultyProtectedRoute } from "./components/FacultyProtectedRoute.js";
import { RoleHomeRedirect } from "./components/RoleHomeRedirect.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { GpuExplorerPage } from "./pages/GpuExplorerPage.js";
import { MyReservationsPage } from "./pages/MyReservationsPage.js";
import { WeeklyCalendarPage } from "./pages/WeeklyCalendarPage.js";
import { ReservationHistoryPage } from "./pages/ReservationHistoryPage.js";
import { NotificationsPage } from "./pages/NotificationsPage.js";
import { AdminAnalyticsPage } from "./pages/admin/AdminAnalyticsPage.js";
import { AdminReportsPage } from "./pages/admin/AdminReportsPage.js";
import { FacultyDashboardPage } from "./pages/faculty/FacultyDashboardPage.js";
import { FacultyCoursesPage } from "./pages/faculty/FacultyCoursesPage.js";
import { FacultyWeeklySchedulePage } from "./pages/faculty/FacultyWeeklySchedulePage.js";
import { FacultyApprovalsPage } from "./pages/faculty/FacultyApprovalsPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Each role lands on its own portal — see RoleHomeRedirect. */}
      <Route path="/" element={<RoleHomeRedirect />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/gpu-explorer" element={<GpuExplorerPage />} />
        <Route path="/reservations" element={<MyReservationsPage />} />
        <Route path="/calendar" element={<WeeklyCalendarPage />} />
        <Route path="/history" element={<ReservationHistoryPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>

      <Route
        element={
          <AdminProtectedRoute>
            <AdminLayout />
          </AdminProtectedRoute>
        }
      >
        <Route path="/admin" element={<RoleHomeRedirect />} />
        <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
        <Route path="/admin/reports" element={<AdminReportsPage />} />
      </Route>

      <Route
        element={
          <FacultyProtectedRoute>
            <FacultyLayout />
          </FacultyProtectedRoute>
        }
      >
        <Route path="/faculty" element={<RoleHomeRedirect />} />
        <Route path="/faculty/dashboard" element={<FacultyDashboardPage />} />
        <Route path="/faculty/courses" element={<FacultyCoursesPage />} />
        <Route path="/faculty/schedule" element={<FacultyWeeklySchedulePage />} />
        <Route path="/faculty/approvals" element={<FacultyApprovalsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
