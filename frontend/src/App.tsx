import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { BorderGlowSystem } from './components/BorderGlowSystem';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import { AuthProvider } from './context/AuthProvider';
import { PublicComplaintProvider } from './context/PublicComplaintProvider';
import { ThemeProvider } from './context/ThemeProvider';
import { useAuth } from './hooks/useAuth';
const AppShell = lazy(() => import('./components/AppShell').then((module) => ({ default: module.AppShell })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })));
const AdministrationPage = lazy(() => import('./pages/AdministrationPage').then((module) => ({ default: module.AdministrationPage })));
const AccountGovernancePage = lazy(() => import('./pages/AccountGovernancePage').then((module) => ({ default: module.AccountGovernancePage })));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage').then((module) => ({ default: module.AnnouncementsPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const MasterDataPage = lazy(() => import('./pages/MasterDataPage').then((module) => ({ default: module.MasterDataPage })));
const InternalMessagesPage = lazy(() => import('./pages/InternalMessagesPage').then((module) => ({ default: module.InternalMessagesPage })));
const NewTicketPage = lazy(() => import('./pages/NewTicketPage').then((module) => ({ default: module.NewTicketPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const PublicPortalPage = lazy(() => import('./pages/PublicPortalPage').then((module) => ({ default: module.PublicPortalPage })));
const ConsumerVerificationPage = lazy(() => import('./pages/ConsumerVerificationPage').then((module) => ({ default: module.ConsumerVerificationPage })));
const EmployeeComplaintVerificationPage = lazy(() => import('./pages/EmployeeComplaintVerificationPage').then((module) => ({ default: module.EmployeeComplaintVerificationPage })));
const TrackComplaintPage = lazy(() => import('./pages/TrackComplaintPage').then((module) => ({ default: module.TrackComplaintPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const SuspendedAccountPage = lazy(() => import('./pages/SuspendedAccountPage').then((module) => ({ default: module.SuspendedAccountPage })));
const TicketDetailPage = lazy(() => import('./pages/TicketDetailPage').then((module) => ({ default: module.TicketDetailPage })));
const TicketsPage = lazy(() => import('./pages/TicketsPage').then((module) => ({ default: module.TicketsPage })));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage').then((module) => ({ default: module.UserManagementPage })));

function AppRoutes() {
  const { isLoading } = useAuth();
  if (isLoading) {
    return <div className="app-loading"><span /><p>Securing your workspace…</p></div>;
  }
  return (
    <Suspense fallback={<div className="app-loading"><span /><p>Loading workspace...</p></div>}>
      <Routes>
      <Route path="/" element={<PublicPortalPage />} />
      <Route path="/complaints/verify" element={<ConsumerVerificationPage />} />
      <Route path="/employee/complaints/verify" element={<EmployeeComplaintVerificationPage />} />
      <Route path="/complaints/new" element={<NewTicketPage />} />
      <Route path="/complaints/track" element={<TrackComplaintPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/suspension" element={<SuspendedAccountPage />} />
      <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/new" element={<RoleRoute roles={['employee']}><NewTicketPage /></RoleRoute>} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="messages" element={<RoleRoute roles={['technician', 'supervisor', 'administrator']}><InternalMessagesPage /></RoleRoute>} />
        <Route path="reports" element={<RoleRoute roles={['supervisor', 'administrator']}><ReportsPage /></RoleRoute>} />
        <Route path="announcements" element={<RoleRoute roles={['supervisor', 'administrator']}><AnnouncementsPage /></RoleRoute>} />
        <Route path="account-governance" element={<RoleRoute roles={['technician', 'supervisor', 'administrator']}><AccountGovernancePage /></RoleRoute>} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="admin/users" element={<RoleRoute roles={['administrator']}><UserManagementPage /></RoleRoute>} />
        <Route path="admin/master-data" element={<RoleRoute roles={['administrator']}><MasterDataPage /></RoleRoute>} />
        <Route path="admin/operations" element={<RoleRoute roles={['administrator']}><AdministrationPage /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <PublicComplaintProvider>
            <BorderGlowSystem />
            <AppRoutes />
          </PublicComplaintProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
