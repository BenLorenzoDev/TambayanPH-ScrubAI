import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/common/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import Leads from './pages/Leads';
import Dialer from './pages/Dialer';
import CallMonitor from './pages/CallMonitor';
import Users from './pages/Users';
import Reports from './pages/Reports';

const PrivateRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="leads" element={<Leads />} />
        <Route path="dialer" element={<Dialer />} />
        <Route
          path="monitor"
          element={
            <PrivateRoute roles={['admin', 'supervisor']}>
              <CallMonitor />
            </PrivateRoute>
          }
        />
        <Route
          path="users"
          element={
            <PrivateRoute roles={['admin']}>
              <Users />
            </PrivateRoute>
          }
        />
        <Route
          path="reports"
          element={
            <PrivateRoute roles={['admin', 'supervisor']}>
              <Reports />
            </PrivateRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
