// routes/user.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const path = require("path");
const fs = require("fs");

// --- helpers: only delete if it was a local file previously ---
function removeFileIfLocal(url) {
  if (!url || !url.startsWith("/uploads/")) return;   // ignore Cloudinary URLs
  const abs = path.join(process.cwd(), url.replace(/^\//, ""));
  fs.stat(abs, (err, st) => { if (!err && st.isFile()) fs.unlink(abs, () => {}); });
}

// --- simple URL check (accept http/https only) ---
function isHttpUrl(s = "") {
  return /^https?:\/\//i.test(String(s).trim());
}

/** POST /api/user/avatar
 *  Body: { photoUrl: "https://res.cloudinary.com/<cloud>/image/upload/...jpg" }
 *  Replaces previous local avatar (if any) and saves the new absolute URL.
 */
router.post("/user/avatar", verifyToken, upload.single("avatar"), async (req, res) => {
  try {
    const { User } = req.models;

    let photoUrlFromClient = String(req.body?.photoUrl || "").trim();
    let finalPhotoUrl = "";

    if (req.file) {
      // Upload the received file to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: `${process.env.CLOUDINARY_FOLDER || "social-media"}/avatars`,
        public_id: req.user.id,     // stable per-user name
        overwrite: true,
      });
      finalPhotoUrl = result.secure_url;
    } else {
      if (!photoUrlFromClient) {
        return res.status(400).json({ message: "Either 'avatar' file or 'photoUrl' is required." });
      }
      if (!isHttpUrl(photoUrlFromClient)) {
        return res.status(400).json({ message: "photoUrl must be an absolute http(s) URL." });
      }
      finalPhotoUrl = photoUrlFromClient;
    }

    const me = await User.findById(req.user.id).select("photoUrl username");
    if (!me) return res.status(404).json({ message: "User not found" });

    // remove old local disk file (noop for Cloudinary URLs)
    removeFileIfLocal(me.photoUrl);
    me.photoUrl = finalPhotoUrl;
    if (req.file) { try { fs.unlink(req.file.path, () => {}); } catch {} }
    await me.save();

    res.json({ message: "Avatar updated.", photoUrl: me.photoUrl });
  } catch (err) {
    console.error("Avatar update error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** GET current user (with counts) */
router.get("/user/me", verifyToken, async (req, res) => {
  try {
    const { User } = req.models;
    const u = await User.findById(req.user.id)
      .select("username photoUrl description followers following");
    if (!u) return res.status(404).json({ message: "User not found" });

    res.json({
      _id: u._id,
      username: u.username,
      photoUrl: u.photoUrl,
      description: u.description || "",
      followersCount: Array.isArray(u.followers) ? u.followers.length : 0,
      followingCount: Array.isArray(u.following) ? u.following.length : 0,
    });
  } catch (err) {
    console.error("GET /user/me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** PUT description */
router.put("/user/description", verifyToken, async (req, res) => {
  try {
    const { User } = req.models;
    const clean = String(req.body.description || "")
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, 150);

    const u = await User.findById(req.user.id).select("description");
    if (!u) return res.status(404).json({ message: "User not found" });

    u.description = clean;
    await u.save();
    res.json({ description: u.description });
  } catch (err) {
    console.error("PUT /user/description error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** GET public profile + counts */
router.get("/users/:id", async (req, res) => {
  try {
    const { User } = req.models;
    const u = await User.findById(req.params.id)
      .select("username photoUrl description followers following");
    if (!u) return res.status(404).json({ message: "User not found" });

    res.json({
      _id: u._id,
      username: u.username,
      photoUrl: u.photoUrl,
      description: u.description || "",
      followersCount: Array.isArray(u.followers) ? u.followers.length : 0,
      followingCount: Array.isArray(u.following) ? u.following.length : 0,
    });
  } catch (err) {
    console.error("GET /users/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** POST follow toggle */
router.post("/users/:id/follow", verifyToken, async (req, res) => {
  try {
    const { User, Notification } = req.models;
    const targetId = String(req.params.id);
    const meId = String(req.user.id);

    if (targetId === meId) {
      return res.status(400).json({ message: "You cannot follow yourself." });
    }

    // Use atomic updates to avoid races/dupes
    const me = await User.findById(meId).select("_id");
    const target = await User.findById(targetId).select("followers");
    if (!me || !target) return res.status(404).json({ message: "User not found" });

    const already = (target.followers || []).some((u) => String(u) === meId);

    if (already) {
      await Promise.all([
        User.updateOne({ _id: meId }, { $pull: { following: targetId } }),
        User.updateOne({ _id: targetId }, { $pull: { followers: meId } }),
      ]);
      const fresh = await User.findById(targetId).select("followers");
      return res.json({
        following: false,
        followersCount: (fresh.followers || []).length,
      });
    } else {
      await Promise.all([
        User.updateOne({ _id: meId }, { $addToSet: { following: targetId } }),
        User.updateOne({ _id: targetId }, { $addToSet: { followers: meId } }),
      ]);

      // notify target
      try {
        await Notification.create({
          recipient: targetId,
          actor: meId,
          type: "follow",
        });
      } catch (e) {
        console.warn("follow notif failed:", e);
      }

      const fresh = await User.findById(targetId).select("followers");
      return res.json({
        following: true,
        followersCount: (fresh.followers || []).length,
      });
    }
  } catch (err) {
    console.error("Follow toggle error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** Followers list */
router.get("/users/:id/followers", async (req, res) => {
  try {
    const { User } = req.models;
    const u = await User.findById(req.params.id)
      .populate("followers", "username photoUrl")
      .select("followers");
    if (!u) return res.status(404).json({ message: "User not found" });

    res.json(
      (u.followers || []).map((f) => ({
        _id: f._id,
        username: f.username,
        photoUrl: f.photoUrl,
      }))
    );
  } catch (err) {
    console.error("Followers list error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** Following list */
router.get("/users/:id/following", async (req, res) => {
  try {
    const { User } = req.models;
    const u = await User.findById(req.params.id)
      .populate("following", "username photoUrl")
      .select("following");
    if (!u) return res.status(404).json({ message: "User not found" });

    res.json(
      (u.following || []).map((f) => ({
        _id: f._id,
        username: f.username,
        photoUrl: f.photoUrl,
      }))
    );
  } catch (err) {
    console.error("Following list error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
