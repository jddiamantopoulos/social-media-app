// routes/auth.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// --- get tenant-bound models from the current request
const getM = (req) => req.models;

/** ---------- Validation helpers ---------- */
const USERNAME_RE = /^(?![_.])(?!.*[_.]{2})[A-Za-z0-9._]{3,20}(?<![_.])$/;
// - no leading/trailing dot/underscore
// - no double dot/underscore
// - only letters, numbers, dot, underscore
// - length 3-20

const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=\S+$).{8,64}$/;
// - at least one letter and one number
// - no whitespace
// - 8-64 chars

function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function validateUsername(username) {
  const u = String(username || "").trim();
  if (!USERNAME_RE.test(u)) {
    return "Username must be 3–20 characters, letters/numbers/._ only, no spaces, no leading/trailing . or _, and no consecutive . or _.";
  }
  return null;
}

function validatePassword(password, username) {
  const p = String(password || "");
  if (!PASSWORD_RE.test(p)) {
    return "Password must be 8–64 characters, include at least one letter and one number, and contain no spaces.";
  }
  if (username && p.toLowerCase().includes(String(username).trim().toLowerCase())) {
    return "Password cannot contain your username.";
  }
  return null;
}

/** ---------- Routes ---------- */

// POST /api/signup
router.post("/signup", async (req, res) => {
  const { User } = getM(req);
  const rawUsername = req.body.username;
  const rawPassword = req.body.password;

  try {
    const username = String(rawUsername || "").trim();
    const password = String(rawPassword || "");

    // Validate inputs
    const userErr = validateUsername(username);
    if (userErr) return res.status(400).json({ message: userErr });

    const passErr = validatePassword(password, username);
    if (passErr) return res.status(400).json({ message: passErr });

    // Case-insensitive uniqueness
    const existingUser = await User.findOne({
      username: { $regex: new RegExp("^" + escRx(username) + "$", "i") },
    });
    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // Create
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, password: hashedPassword });

    // Issue token
    const token = jwt.sign(
      { id: newUser._id, username: newUser.username },
      process.env.JWT_SECRET
      // , { expiresIn: "30d" } // optional: add if you want expiring tokens
    );

    return res.status(201).json({
      message: "Account successfully created!",
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        photoUrl: newUser.photoUrl,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Server error. Try again later." });
  }
});

// POST /api/login
router.post("/login", async (req, res) => {
  const { User } = getM(req);
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  try {
    // case-insensitive lookup
    const user = await User.findOne({
      username: { $regex: new RegExp("^" + escRx(username) + "$", "i") },
    });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET
      // , { expiresIn: "30d" } // optional
    );

    res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        photoUrl: user.photoUrl,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
