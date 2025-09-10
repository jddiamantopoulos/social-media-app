// backend/server.js
const path = require("path");
const fs = require("fs");

// Try .env first; fall back to .env.development if present
const ENV_PATH = fs.existsSync(path.join(__dirname, ".env"))
  ? path.join(__dirname, ".env")
  : (fs.existsSync(path.join(__dirname, ".env.development"))
      ? path.join(__dirname, ".env.development")
      : null);

if (!ENV_PATH) {
  console.error("[server] No .env or .env.development file found in backend/");
} else {
  console.log("[server] Loading env from:", ENV_PATH);
  // Show whether Node can see the file
  console.log("[server] .env exists?", fs.existsSync(ENV_PATH));
  // Optional: peek first bytes to catch a BOM
  const firstBytes = fs.readFileSync(ENV_PATH).slice(0, 3);
  console.log("[server] First 3 bytes:", [...firstBytes]);
  require("dotenv").config({ path: ENV_PATH /*, debug: true*/ });
}

// Accept either key (multi.js supports both)
const MONGODB_URI_BASE = process.env.MONGODB_URI_BASE || process.env.MONGO_URI_BASE;
console.log("[server] Has MONGODB_URI_BASE?", !!MONGODB_URI_BASE);

const express = require("express");
const cors = require("cors");

const PORT = process.env.PORT || 5000;

// Allowlist: env override + sane dev defaults
const ENV_ALLOWED = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const ALLOWED = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://friends.cyberscape.com",
  "https://demo.cyberscape.com",
  "https://app.cyberscape.com",
  ...ENV_ALLOWED,
];

console.log("[server] ENV loaded. Has MONGODB_URI_BASE?", !!process.env.MONGODB_URI_BASE);

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    // allow tools with no origin (curl, health checks)
    if (!origin) return cb(null, true);
    if (ALLOWED.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS: " + origin));
  },
  credentials: false, // using tokens, not cookies
}));

app.use(express.json());

// Use absolute paths for static dirs to avoid cwd issues
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

const withModels = require("./db/withModels");
app.use(withModels);

// simple health check
app.get("/api/healthz", (_req, res) => {
  res.status(200).send("ok");
});


app.use("/api", require("./routes/auth"));
app.use("/api", require("./routes/posts"));
app.use("/api", require("./routes/user"));
app.use("/api", require("./routes/search"));
app.use("/api", require("./routes/notification"));
app.use("/api", require("./routes/settings"));
app.use("/api", require("./routes/messages"));

app.listen(PORT, () => console.log(`API listening on :${PORT}`));
