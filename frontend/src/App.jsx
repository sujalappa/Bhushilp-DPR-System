import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, getLandingPath } from './context/AuthContext';
import { RequireAuth, RequireSuperAdmin, RequireFormAccess } from './routes/ProtectedRoute';
import Spinner from './components/Spinner';
import OfflineSync from './offline/OfflineSync';

import Login from './pages/Login';
import ProjectList from './pages/ProjectList';
import ProjectFormsPage from './pages/ProjectFormsPage';
import ShiftCardPage from './pages/shiftCard/ShiftCardPage';
import ProductionDatePage from './pages/production/ProductionDatePage';
import FuelPage from './pages/fuel/FuelPage';
import LevelProductionPage from './pages/underground/LevelProductionPage';
import DevelopmentPage from './pages/underground/DevelopmentPage';
import WorkOrderPage from './pages/underground/WorkOrderPage';
import ManageUsers from './pages/admin/ManageUsers';
import DataExport from './pages/admin/DataExport';

// Loaded on demand: it pulls in the charting library, which is larger than
// the rest of the app put together and only superadmins ever open it.
const Analysis = lazy(() => import('./pages/admin/Analysis'));

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner full />;
  return <Navigate to={getLandingPath(user)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OfflineSync />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Landing />} />

          <Route
            path="/projects"
            element={
              <RequireAuth>
                <ProjectList />
              </RequireAuth>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <RequireAuth>
                <ProjectFormsPage />
              </RequireAuth>
            }
          />

          <Route
            path="/projects/:projectId/shift-card"
            element={
              <RequireFormAccess formSlug="shift-card">
                <ShiftCardPage />
              </RequireFormAccess>
            }
          />

          <Route
            path="/projects/:projectId/production"
            element={
              <RequireFormAccess formSlug="production">
                <ProductionDatePage />
              </RequireFormAccess>
            }
          />

          <Route
            path="/projects/:projectId/fuel"
            element={
              <RequireFormAccess formSlug="fuel">
                <FuelPage />
              </RequireFormAccess>
            }
          />

          <Route
            path="/projects/:projectId/wo/:workOrderId"
            element={
              <RequireAuth>
                <WorkOrderPage />
              </RequireAuth>
            }
          />
          <Route
            path="/projects/:projectId/wo/:workOrderId/ug-production"
            element={
              <RequireFormAccess formSlug="ug-production">
                <LevelProductionPage />
              </RequireFormAccess>
            }
          />
          <Route
            path="/projects/:projectId/wo/:workOrderId/ug-development"
            element={
              <RequireFormAccess formSlug="ug-development">
                <DevelopmentPage />
              </RequireFormAccess>
            }
          />

          <Route
            path="/admin/users"
            element={
              <RequireSuperAdmin>
                <ManageUsers />
              </RequireSuperAdmin>
            }
          />
          <Route
            path="/admin/export"
            element={
              <RequireSuperAdmin>
                <DataExport />
              </RequireSuperAdmin>
            }
          />

          <Route
            path="/admin/analysis"
            element={
              <RequireSuperAdmin>
                <Suspense fallback={<Spinner full />}>
                  <Analysis />
                </Suspense>
              </RequireSuperAdmin>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
