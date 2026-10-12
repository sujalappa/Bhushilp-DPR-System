import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, getLandingPath } from './context/AuthContext';
import { RequireAuth, RequireSuperAdmin, RequireFormAccess } from './routes/ProtectedRoute';
import Spinner from './components/Spinner';

import Login from './pages/Login';
import ProjectList from './pages/ProjectList';
import ProjectFormsPage from './pages/ProjectFormsPage';
import ShiftCardPage from './pages/shiftCard/ShiftCardPage';
import ProductionDatePage from './pages/production/ProductionDatePage';
import FuelPage from './pages/fuel/FuelPage';
import ManageUsers from './pages/admin/ManageUsers';
import DataExport from './pages/admin/DataExport';

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner full />;
  return <Navigate to={getLandingPath(user)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
