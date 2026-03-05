/**
 * Manages MongoDB connections for the application.
 *
 * Builds database-specific connection URIs from environment variables
 * and caches active Mongoose connections to avoid reconnecting on
 * every request.
 *
 * Used by middleware to retrieve the correct database connection
 * based on the selected tenant.
 */
const mongoose = require("mongoose");

const BASE =
  process.env.MONGODB_URI_BASE || process.env.MONGO_URI_BASE;
if (!BASE) throw new Error("MONGODB_URI_BASE (or MONGO_URI_BASE) missing in env");

const RAW_PARAMS = process.env.MONGODB_URI_PARAMS || "?retryWrites=true&w=majority";

const cache = new Map();

function buildUri(dbName) {
  if (!dbName) throw new Error("dbName is required");
  const baseNoSlash = BASE.replace(/\/+$/, "");
  const hasQuery = baseNoSlash.includes("?");
  const params = RAW_PARAMS
    ? RAW_PARAMS.startsWith("?") ? RAW_PARAMS : `?${RAW_PARAMS}`
    : "";

  return hasQuery
    ? `${baseNoSlash}/${encodeURIComponent(dbName)}`
    : `${baseNoSlash}/${encodeURIComponent(dbName)}${params}`;
}

function getConn(dbName) {
  if (cache.has(dbName)) return cache.get(dbName);
  const uri = buildUri(dbName);

  const conn = mongoose.createConnection(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
  });

  conn.asPromise().catch((e) => {
    console.error(`[multi:${dbName}] Mongo connection error`, e.message);
  });

  cache.set(dbName, conn);
  return conn;
}

module.exports = { getConn };
