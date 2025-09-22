// routes/search.js
const express = require("express");
const router = express.Router();

// simple escape for building a safe regex
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ----- tiny scorers -----
function scoreUser(u, q) {
  const s = q.toLowerCase();
  const name = (u.username || "").toLowerCase();
  let score = 0;
  if (name === s) score += 100;
  else if (name.startsWith(s)) score += 70;
  else if (name.includes(s)) score += 40;
  score += Math.max(0, 20 - Math.abs(name.length - s.length));
  return score;
}

function scorePost(p, q) {
  const s = q.toLowerCase();
  const desc = (p.description || "").toLowerCase();
  let score = 0;
  if (desc.startsWith(s)) score += 80;
  else if (desc.includes(s)) score += 60;

  // recency boost (gentle decay)
  const ageH = (Date.now() - new Date(p.createdAt).getTime()) / 36e5;
  score += Math.max(0, 40 - Math.log10(1 + ageH) * 25);

  // popularity
  const likes = Array.isArray(p.likes) ? p.likes.length : 0;
  score += Math.min(40, likes * 2);

  return score;
}

router.get("/search", async (req, res) => {
  try {
    // get tenant-bound models per request
    const { User, Post } = req.models;

    // sanitize inputs
    const raw = String(req.query.q || "").trim();
    const q = raw.slice(0, 80); // hard cap to avoid pathological regex
    const limit = Math.max(1, Math.min(20, Number(req.query.limit) || 8));
    if (!q) return res.json({ results: [] });

    const rx = new RegExp(esc(q.replace(/^@/, "")), "i");

    // fetch a few of each (lean + projections)
    const [users, posts] = await Promise.all([
      User.find({ username: rx })
        .select({ username: 1, photoUrl: 1 })
        .limit(limit)
        .lean(),
      Post.find({ description: rx })
        .select({ description: 1, imageUrl: 1, likes: 1, createdAt: 1 })
        .limit(limit)
        .lean(),
    ]);

    let results = [];

    for (const u of users) {
      results.push({
        type: "user",
        _id: u._id,
        username: u.username,
        photoUrl: u.photoUrl || "/default-avatar.png",
        _score: scoreUser(u, q) + (q.startsWith("@") ? 30 : 0),
      });
    }

    for (const p of posts) {
      results.push({
        type: "post",
        _id: p._id,
        description: p.description,
        imageUrl: p.imageUrl,
        likes: Array.isArray(p.likes) ? p.likes.length : 0,
        _score: scorePost(p, q) - (q.startsWith("@") ? 20 : 0),
      });
    }

    results.sort((a, b) => b._score - a._score);
    results = results.slice(0, limit);

    res.json({ results });
  } catch (err) {
    console.error("GET /search error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
