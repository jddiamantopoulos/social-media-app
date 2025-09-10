// src/components/Settings.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  applyTheme,
  loadTheme,
  saveTheme,
  ThemeMode,
  PrimaryKey,
} from "../utils/theme";

const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
// Only letters/numbers/dot/underscore; no leading/trailing dot/underscore
const USERNAME_RE = /^(?![._])(?!.*[._]$)[A-Za-z0-9._]+$/;

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 64;

const Settings: React.FC = () => {
  const token = localStorage.getItem("token");
  const auth = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(loadTheme());

  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  const primaryOptions: PrimaryKey[] = [
    "blue",
    "violet",
    "green",
    "orange",
    "red",
    "teal",
    "magenta",
    "yellow",
  ];
  const swatch: Record<PrimaryKey, string> = {
    blue: "#0d6efd",
    violet: "#6f42c1",
    green: "#198754",
    orange: "#fd7e14",
    red: "#dc3545",
    teal: "#20c997",
    magenta: "#d63384",
    yellow: "#ffc107",
  };

  // ---- Username state ----
  const [username, setUsername] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState<string | null>(null);

  // ---- Password state ----
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  // ---- Delete account state ----
  const [delLoading, setDelLoading] = useState(false);

  const isLoggedIn = Boolean(token);

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        // Load current username for the input
        const { data } = await axios.get("/api/settings/me", { headers: auth });
        setUsername(data?.username || "");
      } catch (err) {
        console.error("Load settings error:", err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // ---- Save Username ----
  const saveUsername = async () => {
    setUsernameMsg(null);
    const trimmed = username.trim();
    if (
      trimmed.length < USERNAME_MIN ||
      trimmed.length > USERNAME_MAX ||
      !USERNAME_RE.test(trimmed)
    ) {
      setUsernameMsg(
        `Username must be ${USERNAME_MIN}-${USERNAME_MAX} chars; letters, numbers, . _ only, and may not start or end with . or _.`
      );
      return;
    }
    try {
      setUsernameSaving(true);
      const { data } = await axios.put(
        "/api/settings/username",
        { username: trimmed },
        { headers: auth }
      );
      // Update localStorage user (so UI elsewhere updates)
      const nextLocal = {
        id: data.id,
        username: data.username,
        photoUrl: data.photoUrl,
      };
      localStorage.setItem("user", JSON.stringify(nextLocal));
      setUsernameMsg("Username updated.");
    } catch (err: any) {
      setUsernameMsg(
        err.response?.data?.message || "Failed to update username."
      );
    } finally {
      setUsernameSaving(false);
    }
  };

  // ---- Save Password ----
  const savePassword = async () => {
    setPwMsg(null);
    if (pwNew !== pwConfirm) {
      setPwMsg("New passwords do not match.");
      return;
    }
    if (pwNew.length < PASSWORD_MIN || pwNew.length > PASSWORD_MAX) {
      setPwMsg(
        `New password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`
      );
      return;
    }
    if (/\s/.test(pwNew)) {
      setPwMsg("Password cannot contain spaces.");
      return;
    }
    try {
      setPwSaving(true);
      const { data } = await axios.put(
        "/api/settings/password",
        { currentPassword: pwCurrent, newPassword: pwNew },
        { headers: auth }
      );
      setPwMsg(data.message || "Password updated.");
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
    } catch (err: any) {
      setPwMsg(err.response?.data?.message || "Failed to update password.");
    } finally {
      setPwSaving(false);
    }
  };

  // ---- Delete Account ----
  const handleDeleteAccount = async () => {
    if (delLoading) return;
    const ok = window.confirm(
      "Are you sure you want to permanently delete your account? This cannot be undone."
    );
    if (!ok) {
      window.alert("Deletion canceled.");
      return;
    }
    try {
      setDelLoading(true);
      await axios.delete("/api/settings/account", { headers: auth });
      window.alert("Your account has been deleted.");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.assign("/");
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to delete account.";
      window.alert(msg);
    } finally {
      setDelLoading(false);
    }
  };

  /** --------------- Auth gate --------------- */
  if (!token) {
    return (
      <div className="container">
        <div className="mx-auto" style={{ maxWidth: 820 }}>
          <p>&nbsp;</p>
          <div className="card border-0 shadow-sm mt-3">
            <div className="card-body text-center py-5">
              <h5 className="mb-2">Sign in to view settings</h5>
              <p className="text-muted mb-0">
                You need to be logged in to view and change your settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function SettingsLoadingSkeleton() {
    return (
      <div className="mx-auto" style={{ maxWidth: 720 }}>
        <div className="card border-0 shadow-sm mt-3">
          {/* Header */}
          <div className="card-header bg-transparent border-0">
            <div className="placeholder-wave">
              <div className="placeholder col-3 mb-1" aria-hidden />
              <div className="placeholder col-2" aria-hidden />
            </div>
          </div>

          <div className="card-body">
            {/* Profile row (avatar + name) */}
            <div
              className="d-flex align-items-center placeholder-wave mb-4"
              style={{ gap: 14 }}
            >
              <div
                className="placeholder rounded-circle flex-shrink-0"
                style={{ width: 72, height: 72 }}
                aria-hidden
              />
              <div className="flex-grow-1">
                <div className="placeholder col-4 mb-2" aria-hidden />
                <div className="placeholder col-6" aria-hidden />
              </div>
            </div>

            {/* Username field */}
            <div className="mb-3">
              <div className="placeholder-wave">
                <div className="placeholder col-2 mb-2" aria-hidden />
                <div
                  className="placeholder col-6"
                  style={{ height: 38 }}
                  aria-hidden
                />
              </div>
            </div>

            {/* Description field (textarea) */}
            <div className="mb-4">
              <div className="placeholder-wave">
                <div className="placeholder col-3 mb-2" aria-hidden />
                <div
                  className="placeholder w-100 mb-2"
                  style={{ height: 72 }}
                  aria-hidden
                />
                <div className="placeholder col-5" aria-hidden />
              </div>
            </div>

            {/* Password section title */}
            <div className="placeholder-wave mb-3">
              <div className="placeholder col-4" aria-hidden />
            </div>

            {/* Current password */}
            <div className="mb-3">
              <div className="placeholder-wave">
                <div className="placeholder col-3 mb-2" aria-hidden />
                <div
                  className="placeholder col-7"
                  style={{ height: 38 }}
                  aria-hidden
                />
              </div>
            </div>

            {/* New password */}
            <div className="mb-3">
              <div className="placeholder-wave">
                <div className="placeholder col-3 mb-2" aria-hidden />
                <div
                  className="placeholder col-7"
                  style={{ height: 38 }}
                  aria-hidden
                />
              </div>
            </div>

            {/* Confirm password */}
            <div className="mb-4">
              <div className="placeholder-wave">
                <div className="placeholder col-4 mb-2" aria-hidden />
                <div
                  className="placeholder col-7"
                  style={{ height: 38 }}
                  aria-hidden
                />
              </div>
            </div>

            {/* Save buttons */}
            <div
              className="d-flex justify-content-end placeholder-wave"
              style={{ gap: 10 }}
            >
              <div
                className="placeholder col-3"
                style={{ height: 38 }}
                aria-hidden
              />
              <div
                className="placeholder col-2"
                style={{ height: 38 }}
                aria-hidden
              />
            </div>
          </div>
        </div>

        {/* Danger zone / delete account card (optional) */}
        <div className="card border-0 shadow-sm mt-3">
          <div className="card-body">
            <div className="placeholder-wave mb-2">
              <div className="placeholder col-4" aria-hidden />
            </div>
            <div className="placeholder-wave mb-3">
              <div className="placeholder col-8" aria-hidden />
            </div>
            <div className="placeholder-wave">
              <div
                className="placeholder col-2"
                style={{ height: 38 }}
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 56 }}>
      <style>{`
        .settings-card {
          max-width: 900px;
          margin: 0 auto 24px;
          border: 1px solid var(--bs-card-border-color);
          border-radius: 12px;
          background: var(--bs-card-bg);
          color: var(--bs-card-color);
          box-shadow: var(--elev-2-shadow);
        }

        .section-title { margin-bottom: .5rem; }
      `}</style>

      {loading ? (
        <SettingsLoadingSkeleton />
      ) : (
        <>
          {/* Theme */}
          <div className="card settings-card mb-4">
            <div className="card-header">
              <h4 className="mb-0">Theme</h4>
            </div>
            <div className="card-body">
              {/* Mode: Light / Dark */}
              <div className="mb-3">
                <label className="form-label me-3">Mode</label>
                <div className="btn-group" role="group" aria-label="Theme mode">
                  {(["light", "dark"] as ThemeMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`btn btn-outline-primary ${
                        theme.mode === m ? "active" : ""
                      }`}
                      onClick={() => {
                        const next = { ...theme, mode: m };
                        setTheme(next); // <- remove applyTheme(next) and saveTheme(next)
                      }}
                    >
                      {m === "light" ? "Light" : "Dark"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Primary color swatches (limited set) */}
              <div className="mb-2">
                <label className="form-label me-3">Primary color</label>
                <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                  {primaryOptions.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className="border rounded-circle p-0"
                      title={k}
                      aria-label={`Primary ${k}`}
                      onClick={() => {
                        const next = { ...theme, primary: k };
                        setTheme(next); // <- remove applyTheme(next) and saveTheme(next)
                      }}
                      style={{
                        width: 32,
                        height: 32,
                        background: swatch[k],
                        outline:
                          theme.primary === k
                            ? "2px solid var(--bs-body-color)"
                            : "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              <small className="text-muted">
                Choices are limited to the options above. Changes apply across
                the whole app.
              </small>
            </div>
          </div>

          {/* Username */}
          <div className="card settings-card">
            <div className="card-header">
              <h4 className="mb-0">Username</h4>
            </div>
            <div className="card-body">
              <div className="mb-2">
                <label htmlFor="username" className="form-label">
                  Change username
                </label>
                <input
                  id="username"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={USERNAME_MAX}
                />
                <div className="form-text">
                  {USERNAME_MIN}-{USERNAME_MAX} chars; letters, numbers, dot,
                  underscore. No leading/trailing dot/underscore.
                </div>
              </div>

              {usernameMsg && (
                <div className="alert alert-secondary py-2">{usernameMsg}</div>
              )}

              <button
                className="btn btn-primary"
                onClick={saveUsername}
                disabled={usernameSaving}
              >
                {usernameSaving ? "Saving…" : "Save username"}
              </button>
            </div>
          </div>

          {/* Password */}
          <div className="card settings-card mb-4">
            <div className="card-header">
              <h4 className="mb-0">Password</h4>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label htmlFor="pwCur" className="form-label">
                    Current password
                  </label>
                  <input
                    id="pwCur"
                    type="password"
                    className="form-control"
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label htmlFor="pwNew" className="form-label">
                    New password
                  </label>
                  <input
                    id="pwNew"
                    type="password"
                    className="form-control"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                  />
                  <div className="form-text">
                    {PASSWORD_MIN}-{PASSWORD_MAX} chars, no spaces, include
                    letters and numbers.
                  </div>
                </div>
                <div className="col-md-4">
                  <label htmlFor="pwConf" className="form-label">
                    Confirm new password
                  </label>
                  <input
                    id="pwConf"
                    type="password"
                    className="form-control"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                  />
                </div>
              </div>

              {pwMsg && (
                <div className="alert alert-secondary py-2 mt-3">{pwMsg}</div>
              )}

              <button
                className="btn btn-primary mt-2"
                onClick={savePassword}
                disabled={pwSaving}
              >
                {pwSaving ? "Saving…" : "Change password"}
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="card settings-card mb-5">
            <div className="card-header">
              <h4 className="mb-0 text-danger">Danger zone</h4>
            </div>
            <div className="card-body">
              <p className="mb-3">
                Deleting your account is permanent and cannot be undone. All of
                your posts, comments, and profile data will be removed.
              </p>
              <button
                className="btn btn-danger"
                onClick={handleDeleteAccount}
                disabled={delLoading}
              >
                {delLoading ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Settings;
