// db/withModels.js
const { getConn } = require('./multi');
const { getModels } = require('../models/byConn');

const DB = {
  default: (process.env.MONGO_DB_DEFAULT || 'socialmediaapp').trim(),
  friends: (process.env.MONGO_DB_FRIENDS || 'social_friends').trim(),
  resume:  (process.env.MONGO_DB_RESUME  || 'social_resume').trim(),
};

function pickTenantFromReq(req) {
  const hdr = String(req.get('x-tenant') || '').toLowerCase();
  return DB[hdr] || DB.default; // header wins; safe fallback
}

async function withModels(req, res, next) {
  try {
    const dbName = pickTenantFromReq(req);
    const conn = getConn(dbName);
    await conn.asPromise(); // surface connect errors
    req.dbName = dbName;
    req.conn = conn;
    req.models = getModels(conn);
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = withModels;
