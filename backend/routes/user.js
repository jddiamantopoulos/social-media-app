/**
 * User profile and social interaction routes.
 *
 * Supports:
 *   - uploading and updating user avatars (Cloudinary-backed)
 *   - fetching the authenticated user's profile and follower/following counts
 *   - updating profile descriptions with length/safety constraints
 *   - viewing public user profiles
 *   - following and unfollowing other users (with notifications)
 *   - retrieving followers and following lists
 *
 * Uses verifyToken for authentication, multer for temporary file handling,
 * Cloudinary for media storage, and tenant-bound models (req.models).
 */
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { cloudinary } = require("../lib/cloudinary");

// Multer temp storage
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(process.cwd(), "tmp")),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      cb(null, `${req.user?.id || Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/** POST /api/user/avatar */
router.post("/user/avatar", verifyToken, upload.single("avatar"), async (req, res) => {
  try {
    const { User } = req.models;
    const me = await User.findById(req.user.id).select("photoUrl");
    if (!me) return res.status(404).json({ message: "User not found" });

    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: `${process.env.CLOUDINARY_FOLDER || "social-media-app"}/avatars`,
      // Stable name per user
      public_id: req.user.id,
      overwrite: true,
    });

    // Clean up temp file
    try { fs.unlink(req.file.path, () => {}); } catch {}

    // Save URL
    me.photoUrl = result.secure_url;
    await me.save();

    res.json({ photoUrl: me.photoUrl });
  } catch (err) {
    console.error("Avatar upload error:", err);
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

      // Notify target
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
