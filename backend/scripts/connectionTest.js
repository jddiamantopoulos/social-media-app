// scripts/connectionTest.js
require("dotenv").config();
const { getConn } = require("../db/multi");

(async () => {
  const conn = getConn(process.env.MONGO_DB_FRIENDS || "social_friends");
  await conn.asPromise();
  console.log("Connected to:", conn.name);
  await conn.close();
})();
