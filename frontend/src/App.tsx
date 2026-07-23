import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/AppShell';
import { BorderGlowSystem } from './components/BorderGlowSystem';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { AuthProvider } from './context/AuthProvider';
import { ThemeProvider } from './context/ThemeProvider';
import { useAuth } from './hooks/useAuth';
import { AuthPage } from './pages/AuthPage';
import { AdministrationPage } from './pages/AdministrationPage';
import { AccountGovernancePage } from './pages/AccountGovernancePage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { DashboardPage } from './pages/DashboardPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { NewTicketPage } from './pages/NewTicketPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { SuspendedAccountPage } from './pages/SuspendedAccountPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { TicketsPage } from './pages/TicketsPage';
import { UserManagementPage } from './pages/UserManagementPage';

function AppRoutes() {
  const { isLoading } = useAuth();
  if (isLoading) {
    return <div className="app-loading"><span /><p>Securing your workspace…</p></div>;
  }
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/suspension" element={<SuspendedAccountPage />} />
      <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/new" element={<RoleRoute roles={['consumer', 'employee']}><NewTicketPage /></RoleRoute>} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="reports" element={<RoleRoute roles={['supervisor', 'administrator']}><ReportsPage /></RoleRoute>} />
        <Route path="announcements" element={<RoleRoute roles={['supervisor', 'administrator']}><AnnouncementsPage /></RoleRoute>} />
        <Route path="account-governance" element={<RoleRoute roles={['technician', 'supervisor', 'administrator']}><AccountGovernancePage /></RoleRoute>} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admin/users" element={<RoleRoute roles={['administrator']}><UserManagementPage /></RoleRoute>} />
        <Route path="admin/master-data" element={<RoleRoute roles={['administrator']}><MasterDataPage /></RoleRoute>} />
        <Route path="admin/operations" element={<RoleRoute roles={['administrator']}><AdministrationPage /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <BorderGlowSystem />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
