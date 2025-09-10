// src/lib/api.ts
import axios, { AxiosHeaders } from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  withCredentials: true,
});

function subdomainToTenant(host: string) {
  const h = (host || "").toLowerCase();
  if (h.startsWith("friends.")) return "friends";
  if (h.startsWith("resume."))  return "resume";
  return "default";
}

api.interceptors.request.use((config) => {
  const tenant = subdomainToTenant(window.location.host);

  // Ensure headers is an AxiosHeaders instance, then set the header
  const hdrs = new AxiosHeaders(config.headers);
  hdrs.set("X-Tenant", tenant);

  config.headers = hdrs;
  return config;
});
