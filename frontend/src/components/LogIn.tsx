// src/components/LogIn.tsx
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
      // correct endpoint: /api/login (not /api/auth/login)
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
