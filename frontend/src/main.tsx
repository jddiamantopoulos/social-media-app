/**
 * Client entrypoint.
 *
 * What this file does:
 *   - Boots the React app, mounts <App /> into #root, and applies the saved theme.
 *   - Configures Axios defaults used across the frontend (baseURL + X-Tenant header).
 *   - Selects a "dataset/tenant" (resume vs friends) using a priority order:
 *       1) one-time URL override (?db=friends|resume) -> persisted to localStorage
 *       2) persisted localStorage value (dbKey)
 *       3) host-based default (friends.* -> friends)
 *       4) fallback default ("resume")
 *   - Exposes a dev-friendly global switcher (window.setDb) that flips datasets, clears auth/session
 *     state to prevent cross-tenant bleed, and hard-navigates so the app remounts cleanly.
 *   - (Dev-only) logs Axios requests/responses for quick debugging.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyTheme, loadTheme } from "./utils/theme";
import "bootstrap/dist/css/bootstrap.css";
import axios from "axios";

// ---- Dataset selection (sticky + host-aware) ----
type DbKey = "resume" | "friends";
const VALID_KEYS: DbKey[] = ["resume", "friends"];
const DEFAULT_DB: DbKey = "resume";

// Prefer host -> one-time ?db= override -> stored -> default
function pickDbFromHost(): DbKey | null {
  const h = window.location.hostname.toLowerCase();
  if (h.startsWith("friends.")) return "friends";
  return null;
}

function pickDbFromUrlOnce(): DbKey | null {
  const url = new URL(window.location.href);
  const raw = (url.searchParams.get("db") || "").toLowerCase() as DbKey;
  if (!VALID_KEYS.includes(raw)) return null;

  // Persist and clean the URL (no reload)
  localStorage.setItem("dbKey", raw);
  url.searchParams.delete("db");
  window.history.replaceState({}, "", url.toString());
  return raw;
}

const fromUrl  = pickDbFromUrlOnce();
const fromHost = pickDbFromHost();
const stored   = (localStorage.getItem("dbKey") as DbKey) || null;

const dbKey: DbKey = fromUrl ?? stored ?? fromHost ?? DEFAULT_DB;

// Set a default header that the backend reads in pickTenant()
axios.defaults.headers.common["X-Tenant"] = dbKey;

// Set baseURL using Vite env or same-origin
axios.defaults.baseURL = import.meta.env.VITE_API_URL || "/api";

// Quick global switcher that can be called from the console or a settings UI
declare global {
  interface Window {
    setDb?: (key: DbKey) => void;
  }
}
window.setDb = (key: DbKey) => {
  if (!VALID_KEYS.includes(key)) return;
  localStorage.setItem("dbKey", key);
  axios.defaults.headers.common["X-Tenant"] = key;

  // Prevent cross-dataset session bleed
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.clear();

  // Hard navigate so everything re-mounts cleanly
  window.location.assign("/home");
};

// Expose current dataset for debugging/CSS hooks
document.documentElement.setAttribute("data-db", dbKey);
console.info(`[App] Using dataset: ${dbKey}`);

// ---- Theme + mount ----
applyTheme(loadTheme());

// Dev-only tool; logs Axios requests/responses for debugging
axios.interceptors.request.use((cfg) => {
  console.log(
    "[API ->]",
    cfg.method?.toUpperCase(),
    (cfg.baseURL || "") + (cfg.url || "")
  );
  return cfg;
});
axios.interceptors.response.use(
  (res) => {
    console.log("[API Y]", res.status, res.config.url);
    return res;
  },
  (err) => {
    const r = err.response;
    console.warn("[API N]", r?.status, r?.config?.url, r?.data || err.message);
    return Promise.reject(err);
  }
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
