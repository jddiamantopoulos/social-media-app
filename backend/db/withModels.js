/**
 * Express middleware that selects and attaches the appropriate
 * MongoDB connection and Mongoose models for each request.
 *
 * The target database is determined from the X-Tenant request
 * header, with "resume" used as the default fallback.
 *
 * Attaches the following to the request object:
 *   - req.dbName   : active database name
 *   - req.conn     : Mongoose connection instance
 *   - req.models   : bound models for the selected database
 */
const { getConn } = require('./multi');
const { getModels } = require('../models/byConn');

const DB = {
  resume:  (process.env.MONGO_DB_RESUME  || 'social_resume').trim(),
  friends: (process.env.MONGO_DB_FRIENDS || 'social_friends').trim(),
};

function pickTenantFromReq(req) {
  const hdr = String(req.get('x-tenant') || '').toLowerCase();
  return DB[hdr] || DB.resume;
}

async function withModels(req, res, next) {
  try {
    const dbName = pickTenantFromReq(req);
    const conn = getConn(dbName);
    await conn.asPromise();
    req.dbName = dbName;
    req.conn = conn;
    req.models = getModels(conn);
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = withModels;
