import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, getLandingPath } from './context/AuthContext';
import { RequireAuth, RequireSuperAdmin, RequireFormAccess } from './routes/ProtectedRoute';
import Spinner from './components/Spinner';

import Login from './pages/Login';
import ProjectList from './pages/ProjectList';
import ProjectFormsPage from './pages/ProjectFormsPage';
import DateShiftPage from './pages/shiftCard/DateShiftPage';
import ShiftVehiclesPage from './pages/shiftCard/ShiftVehiclesPage';
import DriverSegmentsPage from './pages/shiftCard/DriverSegmentsPage';
import VehicleShiftFormPage from './pages/shiftCard/VehicleShiftFormPage';
import ProductionDatePage from './pages/production/ProductionDatePage';
import FuelDatePage from './pages/fuel/FuelDatePage';
import FuelVehicleFormPage from './pages/fuel/FuelVehicleFormPage';
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
                <DateShiftPage />
              </RequireFormAccess>
            }
          />
          <Route
            path="/projects/:projectId/shift-card/:date/:shift"
            element={
              <RequireFormAccess formSlug="shift-card">
                <ShiftVehiclesPage />
              </RequireFormAccess>
            }
          />
          <Route
            path="/projects/:projectId/shift-card/:date/:shift/:vehicleId"
            element={
              <RequireFormAccess formSlug="shift-card">
                <DriverSegmentsPage />
              </RequireFormAccess>
            }
          />
          <Route
            path="/projects/:projectId/shift-card/:date/:shift/:vehicleId/:driverId"
            element={
              <RequireFormAccess formSlug="shift-card">
                <VehicleShiftFormPage />
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
                <FuelDatePage />
              </RequireFormAccess>
            }
          />
          <Route
            path="/projects/:projectId/fuel/:date/:vehicleId"
            element={
              <RequireFormAccess formSlug="fuel">
                <FuelVehicleFormPage />
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
