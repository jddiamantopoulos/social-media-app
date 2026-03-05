/**
 * Login page component.
 *
 * Purpose:
 *   - Authenticates a user via username/password and establishes a local session for the SPA.
 *
 * Key behaviors:
 *   - Submits credentials to the backend login endpoint
 *   - Stores the returned JWT and user snapshot in localStorage
 *   - Redirects to /home on success and displays an error message on failure
 *
 * Backend endpoints:
 *   - POST /api/login
 *
 * State & storage:
 *   - Persists auth state in localStorage:
 *       - token (JWT string)
 *       - user  (JSON-serialized user object)
 *
 * Notes:
 *   - Uses basic HTML constraints (maxLength/required/autocomplete) for improved UX.
 */
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const LogIn: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post("/api/login", {
        username,
        password,
      });
      const { token, user } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      navigate("/home");
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="container" style={{ paddingTop: "56px" }}>
      <h2 className="mb-4 text-center">Log In</h2>

      {error && <div className="alert alert-danger">{error}</div>}

      <form
        className="row g-3 needs-validation"
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="col-md-6">
          <label htmlFor="login-username" className="form-label">
            Username
          </label>
          <input
            id="login-username"
            type="text"
            className="form-control"
            value={username}
            maxLength={20}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === " ") {
                e.preventDefault();
              }
            }}
            required
            autoComplete="username"
          />
        </div>

        <div className="col-md-6">
          <label htmlFor="login-password" className="form-label">
            Password
          </label>

          <input
            id="login-password"
            type="password"
            className="form-control"
            value={password}
            maxLength={64}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === " ") {
                e.preventDefault();
              }
            }}
            required
            autoComplete="current-password"
          />
        </div>

        <div className="col-12 text-center">
          <button type="submit" className="btn btn-primary px-5">
            Log In
          </button>
        </div>
      </form>
    </div>
  );
};

export default LogIn;
