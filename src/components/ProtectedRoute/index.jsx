import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth";

/**
 * Gate for a route that needs a signed-in user.
 *
 * This file existed but was empty — nothing guarded any route, and /admin
 * rendered the full admin page for anyone who typed the URL.
 *
 * @param {object} props
 * @param {"admin"|"employee"} [props.role] required role, if any.
 * @param {boolean} [props.selfOnly] for /employee/:name — an employee may
 *   only open their own page; an admin may open anyone's.
 */
function ProtectedRoute({ children, role, selfOnly = false }) {
  const { user, loading } = useAuth();
  const params = useParams();

  // Rendering the redirect before /api/auth/me answers would bounce a
  // signed-in person to the login screen on every refresh.
  if (loading) return <div className="route-loading">Loading…</div>;

  if (!user) return <Navigate to="/login" replace />;

  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : `/employee/${user.name}`} replace />;
  }

  if (selfOnly && user.role !== "admin" && params.name !== user.name) {
    return <Navigate to={`/employee/${user.name}`} replace />;
  }

  return children;
}

export default ProtectedRoute;
