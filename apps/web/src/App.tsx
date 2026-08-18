import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { GpuExplorerPage } from "./pages/GpuExplorerPage.js";
import { MyReservationsPage } from "./pages/MyReservationsPage.js";
import { WeeklyCalendarPage } from "./pages/WeeklyCalendarPage.js";
import { ReservationHistoryPage } from "./pages/ReservationHistoryPage.js";
import { NotificationsPage } from "./pages/NotificationsPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/gpu-explorer" element={<GpuExplorerPage />} />
        <Route path="/reservations" element={<MyReservationsPage />} />
        <Route path="/calendar" element={<WeeklyCalendarPage />} />
        <Route path="/history" element={<ReservationHistoryPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
