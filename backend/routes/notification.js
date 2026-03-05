/**
 * Notification routes for the activity feed/bell icon.
 *
 * Supports:
 *   - listing recent notifications (used by NavBar)
 *   - marking notifications as read (single + mark-all)
 *
 * Uses verifyToken for authentication and tenant-bound models (req.models).
 */
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");

// Simple accessor to get tenant-bound models per-request
const getM = (req) => req.models;

/** List notifications (unified shape used by NavBar) */
router.get("/notifications", verifyToken, async (req, res) => {
  try {
    const { Notification } = getM(req);

    const raw = parseInt(req.query.limit ?? "20", 10);
    const limit = Math.min(Math.max(isNaN(raw) ? 20 : raw, 1), 50);

    const list = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("actor", "username photoUrl")
      .populate("post", "description imageUrl")
      .lean();

    res.json(
      (list || []).map((n) => ({
        _id: n._id,
        type: n.type,
        actor: n.actor
          ? {
              _id: n.actor._id,
              username: n.actor.username,
              photoUrl: n.actor.photoUrl,
            }
          : null,
        post: n.post
          ? {
              _id: n.post._id,
              description: n.post.description,
              imageUrl: n.post.imageUrl,
            }
          : null,
        createdAt: n.createdAt,
        read: !!n.read,
      }))
    );
  } catch (err) {
    console.error("GET /notifications error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** Mark all as read */
router.post("/notifications/read-all", verifyToken, async (req, res) => {
  try {
    const { Notification } = getM(req);

    const r = await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { $set: { read: true } }
    );
    res.json({ ok: true, modified: r.modifiedCount ?? 0 });
  } catch (err) {
    console.error("POST /notifications/read-all error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** Mark one as read */
router.post("/notifications/:id/read", verifyToken, async (req, res) => {
  try {
    const { Notification } = getM(req);

    await Notification.updateOne(
      { _id: req.params.id, recipient: req.user.id },
      { $set: { read: true } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /notifications/:id/read error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
