// db/withModels.js
const { getConn } = require("./multi");
const { getModels } = require("../models/byConn");
const { pickTenant } = require("../tenant/pickTenant");

// Map short header values → DB names
const HEADER_TENANT_MAP = {
  friends: "social_friends",
  resume:  "social_resume",
  default: "social_default",
};

function pickTenantFromReq(req) {
  // 1) Explicit header from frontend (we set X-Tenant in main.tsx)
  const hdr = String(req.get("x-tenant") || "").toLowerCase();
  if (hdr && HEADER_TENANT_MAP[hdr]) return HEADER_TENANT_MAP[hdr];

  // 2) Infer from Origin/Referer/Host (subdomain-based tenancy)
  const hint = req.get("origin") || req.get("referer") || "";
  try {
    const host = new URL(hint).host || req.headers.host || "";
    return pickTenant(host);
  } catch {
    const host = req.headers.host || "";
    return pickTenant(host);
  }
}

// Plain middleware that attaches models, then next()
async function withModels(req, res, next) {
  try {
    const dbName = pickTenantFromReq(req) || "social_default"; // safe fallback
    const conn = getConn(dbName);
    req.dbName = dbName;
    req.conn = conn;
    req.models = getModels(conn);
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = withModels;
