// routes/settings.js
const express = require("express");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");

// ---- validation (kept consistent with auth) ----
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;
const USERNAME_RE = /^(?![._])(?!.*[._]$)[A-Za-z0-9._]+$/;

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 64;
const PASSWORD_NO_SPACE_RE = /^\S+$/;
const PASSWORD_COMPLEXITY_RE = /^(?=.*[A-Za-z])(?=.*\d).+$/;

const escRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function validateUsername(u) {
  if (typeof u !== "string") return "Username is required.";
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX)
    return `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters.`;
  if (!USERNAME_RE.test(u))
    return "Only letters, numbers, dots, and underscores. No leading or trailing dot/underscore.";
  return null;
}

function validatePassword(pw) {
  if (typeof pw !== "string") return "Password is required.";
  if (pw.length < PASSWORD_MIN || pw.length > PASSWORD_MAX)
    return `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`;
  if (!PASSWORD_NO_SPACE_RE.test(pw)) return "Password cannot contain spaces.";
  if (!PASSWORD_COMPLEXITY_RE.test(pw))
    return "Password must include at least one letter and one number.";
  return null;
}

function removeFileIfExists(url) {
  if (!url || !url.startsWith("/uploads/")) return;
  const fsPath = path.join(process.cwd(), url.replace(/^\//, ""));
  fs.stat(fsPath, (err, st) => {
    if (!err && st.isFile()) fs.unlink(fsPath, () => {});
  });
}

/** GET /api/settings/me -> current user's basic settings */
router.get("/settings/me", verifyToken, async (req, res) => {
  try {
    const { User } = req.models; // 👈 per-request models
    const u = await User.findById(req.user.id).select("username photoUrl");
    if (!u) return res.status(404).json({ message: "User not found" });
    res.json({ username: u.username, photoUrl: u.photoUrl });
  } catch (err) {
    console.error("GET /settings/me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** PUT /api/settings/password */
router.put("/settings/password", verifyToken, async (req, res) => {
  try {
    const { User } = req.models;
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword)
      return res
        .status(400)
        .json({ message: "Both current and new password are required." });

    const errMsg = validatePassword(newPassword);
    if (errMsg) return res.status(400).json({ message: errMsg });

    const u = await User.findById(req.user.id).select("password");
    if (!u) return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(currentPassword, u.password);
    if (!ok) return res.status(400).json({ message: "Current password is incorrect." });

    u.password = await bcrypt.hash(newPassword, 10);
    await u.save();
    res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("PUT /settings/password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** PUT /api/settings/username (case-insensitive uniqueness) */
router.put("/settings/username", verifyToken, async (req, res) => {
  try {
    const { User } = req.models;
    const username = String(req.body?.username || "").trim();

    const errMsg = validateUsername(username);
    if (errMsg) return res.status(400).json({ message: errMsg });

    // case-insensitive uniqueness, excluding me
    const exists = await User.findOne({
      username: { $regex: new RegExp("^" + escRx(username) + "$", "i") },
      _id: { $ne: req.user.id },
    }).select("_id");

    if (exists) return res.status(400).json({ message: "Username already taken" });

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { username } },
      { new: true, select: "username photoUrl" }
    );

    if (!updated) return res.status(404).json({ message: "User not found" });

    res.json({ id: updated._id, username: updated.username, photoUrl: updated.photoUrl });
  } catch (err) {
    console.error("PUT /settings/username error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** DELETE /api/settings/account */
router.delete("/settings/account", verifyToken, async (req, res) => {
  try {
    const { User, Notification, Post } = req.models;
    const userId = String(req.user.id);

    const user = await User.findById(userId).select("photoUrl");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Remove avatar file (local storage)
    removeFileIfExists(user.photoUrl);

    // Remove images from user's own posts
    const myPosts = await Post.find({ user: userId }).select("imageUrl");
    for (const p of myPosts) removeFileIfExists(p.imageUrl);

    // Delete the user's posts
    await Post.deleteMany({ user: userId });

    // Clean up other posts where this user appears (reactions, comments, replies)
    const postsToClean = await Post.find({
      $or: [
        { likes: userId },
        { dislikes: userId },
        { "comments.user": userId },
        { "comments.likes": userId },
        { "comments.dislikes": userId },
        { "comments.replies.user": userId },
        { "comments.replies.likes": userId },
        { "comments.replies.dislikes": userId },
      ],
    });

    for (const post of postsToClean) {
      post.likes = (post.likes || []).filter((u) => String(u) !== userId);
      post.dislikes = (post.dislikes || []).filter((u) => String(u) !== userId);

      post.comments = (post.comments || [])
        .filter((c) => String(c.user) !== userId)
        .map((c) => {
          c.likes = (c.likes || []).filter((u) => String(u) !== userId);
          c.dislikes = (c.dislikes || []).filter((u) => String(u) !== userId);
          c.replies = (c.replies || [])
            .filter((r) => String(r.user) !== userId)
            .map((r) => {
              r.likes = (r.likes || []).filter((u) => String(u) !== userId);
              r.dislikes = (r.dislikes || []).filter((u) => String(u) !== userId);
              return r;
            });
          return c;
        });

      await post.save();
    }

    // followers/following + notifications
    await Promise.all([
      User.updateMany({ followers: userId }, { $pull: { followers: userId } }),
      User.updateMany({ following: userId }, { $pull: { following: userId } }),
      Notification.deleteMany({ $or: [{ actor: userId }, { recipient: userId }] }),
    ]);

    await User.findByIdAndDelete(userId);

    res.json({ message: "Account deleted." });
  } catch (err) {
    console.error("DELETE /settings/account error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
