import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import EmployeeHomeWrapper from './components/EmployeeHomeWrapper';
import Admin from './components/Admin';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import PunchWayShowcase from './components/PunchWayShowcase';
import { AuthProvider, useAuth } from './auth';
import './App.css';

/** Sends whoever is signed in to the right home screen. */
function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <div className="route-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : `/employee/${user.name}`} replace />;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/:name"
              element={
                <ProtectedRoute selfOnly>
                  <EmployeeHomeWrapper />
                </ProtectedRoute>
              }
            />
            <Route path="/showcase" element={<PunchWayShowcase />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
