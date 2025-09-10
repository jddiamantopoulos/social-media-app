// db/withModels.js
const { getConn } = require("./multi");
const { getModels } = require("../models/byConn");
const { pickTenant } = require("../tenant/pickTenant");

function pickTenantFromReq(req) {
  const hdr = String(req.get("x-tenant") || "").toLowerCase();
  if (hdr === "friends") return "social_friends";
  if (hdr === "resume")  return "social_resume";
  if (hdr === "default") return "social_default";
  if (hdr === "demo")    return "social_demo";

  const hint = req.get("origin") || req.get("referer") || "";
  try {
    const host = new URL(hint).host || req.headers.host || "";
    return pickTenant(host);
  } catch {
    const host = req.headers.host || "";
    return pickTenant(host);
  }
}

// plain middleware
async function attachModels(req, res, next) {
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

module.exports = attachModels;
