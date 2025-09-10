// src/components/SignUp.tsx
import React, { useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Keep these in sync with backend
const USERNAME_RE = /^(?![_.])(?!.*[_.]{2})[A-Za-z0-9._]{3,20}(?<![_.])$/;
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=\S+$).{8,64}$/;

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const usernameHelp =
    "3–20 chars • letters/numbers/._ • no spaces • no leading/trailing . or _";
  const passwordHelp =
    "8–64 chars • at least one letter and one number • no spaces";

  const usernameValid = useMemo(
    () => USERNAME_RE.test(username.trim()),
    [username]
  );
  const passwordValid = useMemo(
    () =>
      PASSWORD_RE.test(password) &&
      !password.toLowerCase().includes(username.trim().toLowerCase()),
    [password, username]
  );
  const confirmValid = useMemo(
    () => (confirm ? confirm === password : false),
    [confirm, password]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const u = username.trim();
    const p = password;
    const c = confirm;

    if (!USERNAME_RE.test(u)) {
      setError(usernameHelp);
      return;
    }
    if (!(PASSWORD_RE.test(p) && !p.toLowerCase().includes(u.toLowerCase()))) {
      setError(passwordHelp + " • cannot contain your username");
      return;
    }
    if (p !== c) {
      setError("Passwords do not match");
      return;
    }

    try {
      setSubmitting(true);
      // Create account (server already returns token + user)
      const res = await axios.post("/api/signup", { username: u, password: p });
      const { token, user } = res.data || {};
      if (!token || !user) {
        throw new Error("Unexpected response from server.");
      }

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      navigate("/home");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 56, maxWidth: 1140 }}>
      <h2 className="mb-4 text-center">Sign Up</h2>

      {error && <div className="alert alert-danger">{error}</div>}

      <form className="row g-3" noValidate onSubmit={handleSubmit}>
        <div className="col-12 col-lg-4">
          <label htmlFor="signup-username" className="form-label">
            Username
          </label>
          <input
            id="signup-username"
            type="text"
            className={`form-control ${
              username ? (usernameValid ? "is-valid" : "is-invalid") : ""
            }`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            minLength={3}
            maxLength={20}
            pattern={USERNAME_RE.source}
            required
          />
          <div className="form-text">{usernameHelp}</div>
        </div>

        <div className="col-12 col-lg-4">
          <label htmlFor="signup-password" className="form-label">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            className={`form-control ${
              password ? (passwordValid ? "is-valid" : "is-invalid") : ""
            }`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={64}
            required
          />
          <div className="form-text">{passwordHelp}</div>
        </div>

        <div className="col-12 col-lg-4">
          <label htmlFor="signup-confirm" className="form-label">
            Confirm password
          </label>
          <input
            id="signup-confirm"
            type="password"
            className={`form-control ${
              confirm ? (confirmValid ? "is-valid" : "is-invalid") : ""
            }`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={64}
            required
          />
          {/* no help text under confirm per request */}
          <div className="form-text invisible">&nbsp;</div>
        </div>

        <div className="col-12 text-center">
          <button
            type="submit"
            className="btn btn-success px-5"
            disabled={submitting}
          >
            {submitting ? "Creating…" : "Create Account"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SignUp;
