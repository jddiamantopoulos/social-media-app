/**
 * Centralized Axios client configuration.
 *
 * Creates a shared API instance with a predefined base URL and
 * request interceptor that injects a tenant identifier based on
 * the current subdomain.
 *
 * Automatically adds the X-Tenant header to all outgoing requests
 * to support multi-tenant backend routing.
 */
import axios, { AxiosHeaders } from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

function subdomainToTenant(host: string) {
  const h = (host || "").toLowerCase();
  if (h.startsWith("friends.")) return "friends";
  return "resume";
}

api.interceptors.request.use((config) => {
  const tenant = subdomainToTenant(window.location.host);

  // Ensure headers is an AxiosHeaders instance, then set the header
  const hdrs = new AxiosHeaders(config.headers);
  hdrs.set("X-Tenant", tenant);

  config.headers = hdrs;
  return config;
});
