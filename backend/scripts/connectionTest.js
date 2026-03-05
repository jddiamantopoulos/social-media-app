/**
 * Database connection verification script.
 *
 * Purpose:
 *   - Loads environment variables from .env
 *   - Establishes a MongoDB connection using the multi-tenant connection manager
 *   - Verifies that the configured database is reachable
 *   - Logs the connected database name
 *   - Closes the connection cleanly
 * 
 * Use Case:
 *   - Verifies connection to sample database
 *
 * Usage:
 *   node scripts/connectionTest.js
 *
 * Environment:
 *   - MONGO_DB_FRIENDS: target database name (defaults to "social_friends")
 */
require("dotenv").config();
const { getConn } = require("../db/multi");

(async () => {
  const conn = getConn(process.env.MONGO_DB_FRIENDS || "social_friends");
  await conn.asPromise();
  console.log("Connected to:", conn.name);
  await conn.close();
})();
