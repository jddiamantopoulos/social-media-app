// backend/server.js
const path = require("path");
const fs = require("fs");

// ----- Env loading (same logic you had) -----
const ENV_PATH = fs.existsSync(path.join(__dirname, ".env"))
  ? path.join(__dirname, ".env")
  : (fs.existsSync(path.join(__dirname, ".env.development"))
      ? path.join(__dirname, ".env.development")
      : null);

if (!ENV_PATH) {
  console.error("[server] No .env or .env.development file found in backend/");
} else {
  console.log("[server] Loading env from:", ENV_PATH);
  console.log("[server] .env exists?", fs.existsSync(ENV_PATH));
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

const app = express();

// ----- CORS must be FIRST (before json, routes, anything) -----
const ENV_ALLOWED = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const ALLOWED = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...ENV_ALLOWED,
];

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);            // curl/health checks
    if (ALLOWED.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS: " + origin), false);
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Tenant"],
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  next();
});

app.use(cors(corsOptions));

// ✅ Express 5-friendly preflight handler (no bare "*")
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    // Mirror CORS config on preflight
    const reqHeaders = req.headers["access-control-request-headers"] || "";
    const reqMethod = req.headers["access-control-request-method"] || "GET";
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    if (reqHeaders) res.header("Access-Control-Allow-Headers", reqHeaders);
    return res.sendStatus(204);
  }
  next();
});

// Respond to preflight globally
app.options("*", cors(corsOptions));

// Behind Render’s proxy (needed for secure cookies, IPs, etc.)
app.set("trust proxy", 1);

// ----- Body parsing AFTER CORS -----
app.use(express.json());

// ----- Static assets -----
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

// ----- DB models per-tenant -----
const withModels = require("./db/withModels");
app.use(withModels);

// ----- Health check -----
app.get("/api/healthz", (_req, res) => {
  res.status(200).send("ok");
});

// ----- Routes -----
app.use("/api", require("./routes/auth"));
app.use("/api", require("./routes/posts"));
app.use("/api", require("./routes/user"));
app.use("/api", require("./routes/search"));
app.use("/api", require("./routes/notification"));
app.use("/api", require("./routes/settings"));
app.use("/api", require("./routes/messages"));

// ----- Start -----
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
