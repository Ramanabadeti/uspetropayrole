import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import "./index.css";

/**
 * Sign-in.
 *
 * The old version fetched /api/employees — which returned every employee's
 * plaintext password — and compared them in the browser. Credentials go to
 * the server now, and the server decides.
 */
function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onSubmitForm = async (event) => {
    event.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      const user = await login(username, password);
      navigate(user.role === "admin" ? "/admin" : `/employee/${user.name}`, { replace: true });
    } catch (err) {
      setErrorMsg(err.message || "Could not sign in");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="loginContainer">
        <img src="/image.png" alt="US Petro Logo" className="login-logo" />
        <h1>US PETRO</h1>
        <form onSubmit={onSubmitForm} className="loginForm" autoComplete="off">
          <label htmlFor="username">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            id="username"
            name="punchway-username"
            type="text"
            placeholder="Enter username"
            autoComplete="off"
            required
          />
          <label htmlFor="password">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            id="password"
            name="punchway-password"
            type="password"
            placeholder="Enter password"
            autoComplete="new-password"
            required
          />
          <button type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Log In"}
          </button>
          {errorMsg && <p className="login-error" role="alert">{errorMsg}</p>}
        </form>
      </div>
    </div>
  );
}

export default Login;
