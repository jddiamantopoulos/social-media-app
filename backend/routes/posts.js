// routes/posts.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const upload = multer({ dest: "tmp/" });
const { cloudinary } = require("../lib/cloudinary");

// -------- tenant model accessor --------
const getM = (req) => req.models; // { Post, User, Notification }

// --- cursor helpers ---
const encodeCursor = (obj) =>
  Buffer.from(
    JSON.stringify({ createdAt: obj.createdAt, _id: String(obj._id) }),
    "utf8"
  ).toString("base64");

const decodeCursor = (s) => {
  const { createdAt, _id } = JSON.parse(
    Buffer.from(String(s), "base64").toString("utf8")
  );
  return {
    createdAt: new Date(createdAt),
    _id: new mongoose.Types.ObjectId(_id),
  };
};

function removeLocalIfUploadsPath(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith("/uploads/")) return;
  const full = path.join(process.cwd(), fileUrl.replace(/^\//, ""));
  fs.unlink(full, () => {});
}

/* =========================
 *          POSTS
 * ======================= */

// CREATE post (supports either: multipart "image" OR JSON { imageUrl })
router.post("/posts", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const { Post, User, Notification } = getM(req);
    const meId = req.user.id;

    const description = (req.body.description || "").trim();

    // If client provided a full URL, accept it; otherwise, if a file was sent, upload to Cloudinary.
    let imageUrl = (req.body.imageUrl || "").trim() || null;

    if (req.file) {
      // Upload temp file to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: `${process.env.CLOUDINARY_FOLDER || "social-media-app"}/posts`,
        // optional:
        // public_id: `post_${Date.now()}`,
        // overwrite: true,
      });
      imageUrl = result.secure_url;

      // Clean up temp file
      try { fs.unlink(req.file.path, () => {}); } catch {}
    }

    const post = await Post.create({ user: meId, description, imageUrl });

    // (optional) notify followers — keep your existing logic
    try {
      const u = await User.findById(meId).select("followers");
      const followers = (u?.followers || [])
        .map(String)
        .filter((fid) => fid !== String(meId));
      if (followers.length) {
        await Notification.insertMany(
          followers.map((fid) => ({
            recipient: fid,
            actor: meId,
            type: "new_post",
            post: post._id,
          })),
          { ordered: false }
        );
      }
    } catch (e) {
      console.warn("notify followers failed:", e);
    }

    const populated = await Post.findById(post._id)
      .populate("user", "username photoUrl")
      .populate("comments.user", "username photoUrl")
      .populate("comments.replies.user", "username photoUrl")
      .populate("comments.replies.replyTo", "username photoUrl");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET all posts (cursor-based; newest → oldest)
router.get("/posts", async (req, res) => {
  try {
    const { Post } = getM(req);

    const raw = Number(req.query.limit);
    const limit = Math.min(Math.max(isNaN(raw) ? 20 : raw, 1), 50);

    let filter = {};
    if (req.query.after) {
      try {
        const { createdAt, _id } = decodeCursor(req.query.after);
        filter = {
          $or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: _id } }],
        };
      } catch {
        return res.status(400).json({ message: "Invalid cursor" });
      }
    }

    const docs = await Post.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate("user", "username photoUrl")
      .populate("comments.user", "username photoUrl")
      .populate("comments.replies.user", "username photoUrl")
      .populate("comments.replies.replyTo", "username photoUrl");

    let nextCursor = null;
    let items = docs;

    if (docs.length > limit) {
      const last = docs[limit - 1];
      nextCursor = encodeCursor({ createdAt: last.createdAt, _id: last._id });
      items = docs.slice(0, limit);
    }

    res.json({ items, nextCursor });
  } catch (err) {
    console.error("Fetch posts error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET single post
router.get("/posts/:id", async (req, res) => {
  try {
    const { Post } = getM(req);
    const post = await Post.findById(req.params.id)
      .populate("user", "username photoUrl")
      .populate("comments.user", "username photoUrl")
      .populate("comments.replies.user", "username photoUrl")
      .populate("comments.replies.replyTo", "username photoUrl");
    if (!post) return res.status(404).json({ message: "Post not found" });
    res.json(post);
  } catch (err) {
    console.error("Get single post error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// UPDATE post
router.put("/posts/:id", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const { Post } = getM(req);

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    const { description } = req.body;
    if (typeof description === "string") post.description = description;

    if (req.file) {
      // remove old local-only file if you had one
      removeLocalIfUploadsPath(post.imageUrl);
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: `${process.env.CLOUDINARY_FOLDER || "social-media"}/posts`,
        // optional: public_id: `post_${post._id}`, overwrite: true
      });
      post.imageUrl = result.secure_url;
      try { fs.unlink(req.file.path, () => {}); } catch {}
    } else if (typeof req.body.imageUrl === "string" && req.body.imageUrl.trim()) {
      // allow swapping to a new Cloudinary URL without uploading a new file
      removeLocalIfUploadsPath(post.imageUrl);
      post.imageUrl = req.body.imageUrl.trim();
    }

    if (typeof description === "string") post.description = description.trim();
    post.editedAt = new Date();
    await post.save();

    const populated = await Post.findById(post._id)
      .populate("user", "username photoUrl")
      .populate("comments.user", "username photoUrl")
      .populate("comments.replies.user", "username photoUrl")
      .populate("comments.replies.replyTo", "username photoUrl");

    res.json({ message: "Post updated", post: populated });
  } catch (err) {
    console.error("Update post error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE post
router.delete("/posts/:id", verifyToken, async (req, res) => {
  try {
    const { Post } = getM(req);

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });

    if (post.imageUrl) removeLocalIfUploadsPath(post.imageUrl);
    await post.deleteOne();
    res.json({ message: "Post deleted" });
  } catch (err) {
    console.error("Delete post error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Posts by user
router.get("/users/:id/posts", async (req, res) => {
  try {
    const { Post } = getM(req);

    const posts = await Post.find({ user: req.params.id })
      .sort({ createdAt: -1 })
      .populate("user", "username photoUrl")
      .populate("comments.user", "username photoUrl")
      .populate("comments.replies.user", "username photoUrl")
      .populate("comments.replies.replyTo", "username photoUrl");
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
 *       POST REACTIONS
 * ======================= */

router.post("/posts/:id/like", verifyToken, async (req, res) => {
  try {
    const { Post, Notification } = getM(req);

    const me = req.user.id;
    const postId = req.params.id;

    const post = await Post.findById(postId).select("user likes dislikes");
    if (!post) return res.status(404).json({ message: "Post not found" });

    const hasLiked = (post.likes || []).some((u) => String(u) === me);

    if (hasLiked) {
      await Post.updateOne({ _id: postId }, { $pull: { likes: me } });
      const fresh = await Post.findById(postId).select("likes dislikes");
      return res.json({
        liked: false,
        disliked: (fresh.dislikes || []).some((u) => String(u) === me),
        likes: (fresh.likes || []).length,
        dislikes: (fresh.dislikes || []).length,
      });
    } else {
      await Post.updateOne(
        { _id: postId },
        { $addToSet: { likes: me }, $pull: { dislikes: me } }
      );

      if (String(post.user) !== me) {
        await Notification.create({
          recipient: post.user,
          actor: me,
          type: "post_like",
          post: post._id,
        });
      }

      const fresh = await Post.findById(postId).select("likes dislikes");
      return res.json({
        liked: true,
        disliked: false,
        likes: (fresh.likes || []).length,
        dislikes: (fresh.dislikes || []).length,
      });
    }
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/posts/:id/dislike", verifyToken, async (req, res) => {
  try {
    const { Post } = getM(req);

    const me = req.user.id;
    const postId = req.params.id;

    const post = await Post.findById(postId).select("likes dislikes");
    if (!post) return res.status(404).json({ message: "Post not found" });

    const hasDisliked = (post.dislikes || []).some((u) => String(u) === me);

    if (hasDisliked) {
      await Post.updateOne({ _id: postId }, { $pull: { dislikes: me } });
      const fresh = await Post.findById(postId).select("likes dislikes");
      return res.json({
        liked: (fresh.likes || []).some((u) => String(u) === me),
        disliked: false,
        likes: (fresh.likes || []).length,
        dislikes: (fresh.dislikes || []).length,
      });
    } else {
      await Post.updateOne(
        { _id: postId },
        { $addToSet: { dislikes: me }, $pull: { likes: me } }
      );
      const fresh = await Post.findById(postId).select("likes dislikes");
      return res.json({
        liked: false,
        disliked: true,
        likes: (fresh.likes || []).length,
        dislikes: (fresh.dislikes || []).length,
      });
    }
  } catch (err) {
    console.error("Dislike error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
 *          COMMENTS
 * ======================= */

router.post("/posts/:id/comments", verifyToken, async (req, res) => {
  try {
    const { Post, Notification } = getM(req);

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({ user: req.user.id, text: req.body.text });
    await post.save();

    try {
      if (String(post.user) !== String(req.user.id)) {
        const inserted = post.comments[post.comments.length - 1];
        await Notification.create({
          recipient: post.user,
          actor: req.user.id,
          type: "post_comment",
          post: post._id,
          comment: inserted?._id,
        });
      }
    } catch (e) {
      console.warn("post_comment notif failed:", e);
    }

    const populated = await Post.findById(req.params.id)
      .populate("comments.user", "username photoUrl")
      .populate("comments.replies.user", "username photoUrl")
      .populate("comments.replies.replyTo", "username photoUrl");

    res.status(201).json(populated.comments);
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put(
  "/posts/:postId/comments/:commentId",
  verifyToken,
  async (req, res) => {
    try {
      const { Post } = getM(req);

      const { postId, commentId } = req.params;
      const { text } = req.body;
      if (!text || !text.trim())
        return res.status(400).json({ message: "Text required" });

      const post = await Post.findById(postId);
      if (!post) return res.status(404).json({ message: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ message: "Comment not found" });
      if (comment.user.toString() !== req.user.id)
        return res.status(403).json({ message: "Not authorized" });

      comment.text = text.trim();
      comment.editedAt = new Date();
      await post.save();

      res.json({
        comment: {
          _id: comment._id,
          user: comment.user,
          text: comment.text,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          editedAt: comment.editedAt,
          likes: comment.likes ?? [],
          dislikes: comment.dislikes ?? [],
        },
      });
    } catch (err) {
      console.error("Edit comment error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.delete(
  "/posts/:postId/comments/:commentId",
  verifyToken,
  async (req, res) => {
    try {
      const { Post } = getM(req);

      const { postId, commentId } = req.params;
      const post = await Post.findById(postId);
      if (!post) return res.status(404).json({ message: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ message: "Comment not found" });

      const uid = req.user.id;
      const canDelete =
        comment.user.toString() === uid || post.user.toString() === uid;
      if (!canDelete) return res.status(403).json({ message: "Not authorized" });

      comment.deleteOne();
      await post.save();
      res.json({ message: "Comment deleted" });
    } catch (err) {
      console.error("Delete comment error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ---- helpers that need Post passed in (tenant-safe) ----
async function getCommentSnapshot(Post, postId, commentId) {
  const snap = await Post.findById(postId).select(
    "comments._id comments.likes comments.dislikes"
  );
  if (!snap) return null;
  const c = snap.comments.id(commentId);
  if (!c) return null;
  return {
    likes: c.likes.length,
    dislikes: c.dislikes.length,
    likesIds: c.likes.map((x) => x.toString()),
    dislikesIds: c.dislikes.map((x) => x.toString()),
  };
}

/* =========================
 *     COMMENT REACTIONS
 * ======================= */

router.post(
  "/posts/:postId/comments/:commentId/like",
  verifyToken,
  async (req, res) => {
    try {
      const { Post, Notification } = getM(req);

      const { postId, commentId } = req.params;
      const uid = req.user.id;

      const seed = await Post.findById(postId).select(
        "comments._id comments.user comments.likes comments.dislikes"
      );
      if (!seed) return res.status(404).json({ message: "Post not found" });
      const comment = seed.comments.id(commentId);
      if (!comment) return res.status(404).json({ message: "Comment not found" });

      const hasLiked = comment.likes.some((u) => u.toString() === uid);

      await Post.updateOne(
        { _id: postId, "comments._id": commentId },
        hasLiked
          ? { $pull: { "comments.$.likes": uid } }
          : {
              $addToSet: { "comments.$.likes": uid },
              $pull: { "comments.$.dislikes": uid },
            }
      );

      if (!hasLiked) {
        try {
          const recipient = comment.user?.toString?.() || String(comment.user);
          if (recipient && recipient !== uid) {
            await Notification.create({
              recipient,
              actor: uid,
              type: "comment_like",
              post: seed._id,
              comment: comment._id,
            });
          }
        } catch (e) {
          console.warn("comment_like notif failed:", e);
        }
      }

      const snap = await getCommentSnapshot(Post, postId, commentId);
      if (!snap) return res.status(500).json({ message: "Failed to refresh" });

      res.json({
        commentId,
        liked: !hasLiked,
        disliked: false,
        likes: snap.likes,
        dislikes: snap.dislikes,
        likesIds: snap.likesIds,
        dislikesIds: snap.dislikesIds,
      });
    } catch (err) {
      console.error("Comment like error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/posts/:postId/comments/:commentId/dislike",
  verifyToken,
  async (req, res) => {
    try {
      const { Post } = getM(req);

      const { postId, commentId } = req.params;
      const uid = req.user.id;

      const seed = await Post.findById(postId).select(
        "comments._id comments.likes comments.dislikes"
      );
      if (!seed) return res.status(404).json({ message: "Post not found" });
      const comment = seed.comments.id(commentId);
      if (!comment) return res.status(404).json({ message: "Comment not found" });

      const hasDisliked = comment.dislikes.some((u) => u.toString() === uid);

      await Post.updateOne(
        { _id: postId, "comments._id": commentId },
        hasDisliked
          ? { $pull: { "comments.$.dislikes": uid } }
          : {
              $addToSet: { "comments.$.dislikes": uid },
              $pull: { "comments.$.likes": uid },
            }
      );

      const snap = await getCommentSnapshot(Post, postId, commentId);
      if (!snap) return res.status(500).json({ message: "Failed to refresh" });

      res.json({
        commentId,
        liked: false,
        disliked: !hasDisliked,
        likes: snap.likes,
        dislikes: snap.dislikes,
        likesIds: snap.likesIds,
        dislikesIds: snap.dislikesIds,
      });
    } catch (err) {
      console.error("Comment dislike error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/* =========================
 *          REPLIES
 * ======================= */

router.post(
  "/posts/:postId/comments/:commentId/replies",
  verifyToken,
  async (req, res) => {
    try {
      const { Post, Notification } = getM(req);

      const { postId, commentId } = req.params;
      let { text, replyTo } = req.body;

      if (!text || !text.trim())
        return res.status(400).json({ message: "Text required" });
      if (!replyTo)
        return res.status(400).json({ message: "replyTo (user id) required" });

      const post = await Post.findById(postId);
      if (!post) return res.status(404).json({ message: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ message: "Comment not found" });

      comment.replies = comment.replies || [];
      comment.replies.push({
        user: req.user.id,
        replyTo,
        text: text.trim(),
      });

      await post.save();

      try {
        const actor = String(req.user.id);
        const postOwner = String(post.user);
        const replyDoc = (comment.replies || [])[comment.replies.length - 1];
        const directTarget = String(replyTo);

        const payloads = [];
        if (directTarget && directTarget !== actor) {
          payloads.push({
            recipient: directTarget,
            actor,
            type: "comment_reply",
            post: post._id,
            comment: comment._id,
            reply: replyDoc?._id,
          });
        }
        if (postOwner !== actor && postOwner !== directTarget) {
          payloads.push({
            recipient: postOwner,
            actor,
            type: "post_comment",
            post: post._id,
            comment: comment._id,
            reply: replyDoc?._id,
          });
        }
        if (payloads.length)
          await Notification.insertMany(payloads, { ordered: false });
      } catch (e) {
        console.warn("reply notifications failed:", e);
      }

      const fresh = await Post.findById(postId)
        .populate("comments.user", "username photoUrl")
        .populate("comments.replies.user", "username photoUrl")
        .populate("comments.replies.replyTo", "username photoUrl");

      const updated = fresh.comments.id(commentId);
      res.status(201).json({ replies: updated.replies });
    } catch (err) {
      console.error("Create reply error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// ---- helper needs Post injected ----
async function getReplySnapshot(Post, postId, commentId, replyId) {
  const snap = await Post.findById(postId).select(
    "comments._id comments.replies._id comments.replies.likes comments.replies.dislikes"
  );
  if (!snap) return null;
  const c = snap.comments.id(commentId);
  if (!c) return null;
  const r = (c.replies || []).id(replyId);
  if (!r) return null;
  return {
    likes: (r.likes || []).length,
    dislikes: (r.dislikes || []).length,
    likesIds: (r.likes || []).map((x) => x.toString()),
    dislikesIds: (r.dislikes || []).map((x) => x.toString()),
  };
}

router.post(
  "/posts/:postId/comments/:commentId/replies/:replyId/like",
  verifyToken,
  async (req, res) => {
    try {
      const { Post, Notification } = getM(req);

      const { postId, commentId, replyId } = req.params;
      const uid = req.user.id;

      const seed = await Post.findById(postId).select(
        "comments._id comments.replies._id comments.replies.user comments.replies.likes comments.replies.dislikes"
      );
      if (!seed) return res.status(404).json({ message: "Post not found" });
      const c = seed.comments.id(commentId);
      if (!c) return res.status(404).json({ message: "Comment not found" });
      const r = (c.replies || []).id(replyId);
      if (!r) return res.status(404).json({ message: "Reply not found" });

      const hasLiked = (r.likes || []).some((x) => x.toString() === uid);

      await Post.updateOne(
        { _id: postId },
        hasLiked
          ? { $pull: { "comments.$[c].replies.$[r].likes": uid } }
          : {
              $addToSet: { "comments.$[c].replies.$[r].likes": uid },
              $pull: { "comments.$[c].replies.$[r].dislikes": uid },
            },
        {
          arrayFilters: [
            { "c._id": new mongoose.Types.ObjectId(commentId) },
            { "r._id": new mongoose.Types.ObjectId(replyId) },
          ],
        }
      );

      if (!hasLiked) {
        try {
          const recipient = String(r.user);
          if (recipient && recipient !== uid) {
            await Notification.create({
              recipient,
              actor: uid,
              type: "comment_like",
              post: seed._id,
              comment: c._id,
              reply: r._id,
            });
          }
        } catch (e) {
          console.warn("reply like notif failed:", e);
        }
      }

      const snap = await getReplySnapshot(Post, postId, commentId, replyId);
      if (!snap) return res.status(500).json({ message: "Failed to refresh" });

      res.json({
        replyId,
        liked: !hasLiked,
        disliked: false,
        likes: snap.likes,
        dislikes: snap.dislikes,
        likesIds: snap.likesIds,
        dislikesIds: snap.dislikesIds,
      });
    } catch (err) {
      console.error("Reply like error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/posts/:postId/comments/:commentId/replies/:replyId/dislike",
  verifyToken,
  async (req, res) => {
    try {
      const { Post } = getM(req);

      const { postId, commentId, replyId } = req.params;
      const uid = req.user.id;

      const seed = await Post.findById(postId).select(
        "comments._id comments.replies._id comments.replies.likes comments.replies.dislikes"
      );
      if (!seed) return res.status(404).json({ message: "Post not found" });
      const c = seed.comments.id(commentId);
      if (!c) return res.status(404).json({ message: "Comment not found" });
      const r = (c.replies || []).id(replyId);
      if (!r) return res.status(404).json({ message: "Reply not found" });

      const hasDisliked = (r.dislikes || []).some((x) => x.toString() === uid);

      await Post.updateOne(
        { _id: postId },
        hasDisliked
          ? { $pull: { "comments.$[c].replies.$[r].dislikes": uid } }
          : {
              $addToSet: { "comments.$[c].replies.$[r].dislikes": uid },
              $pull: { "comments.$[c].replies.$[r].likes": uid },
            },
        {
          arrayFilters: [
            { "c._id": new mongoose.Types.ObjectId(commentId) },
            { "r._id": new mongoose.Types.ObjectId(replyId) },
          ],
        }
      );

      const snap = await getReplySnapshot(Post, postId, commentId, replyId);
      if (!snap) return res.status(500).json({ message: "Failed to refresh" });

      res.json({
        replyId,
        liked: false,
        disliked: !hasDisliked,
        likes: snap.likes,
        dislikes: snap.dislikes,
        likesIds: snap.likesIds,
        dislikesIds: snap.dislikesIds,
      });
    } catch (err) {
      console.error("Reply dislike error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Edit reply
router.put(
  "/posts/:postId/comments/:commentId/replies/:replyId",
  verifyToken,
  async (req, res) => {
    try {
      const { Post } = getM(req);

      const { postId, commentId, replyId } = req.params;
      const { text } = req.body;
      if (!text || !text.trim())
        return res.status(400).json({ message: "Text required" });

      const post = await Post.findById(postId);
      if (!post) return res.status(404).json({ message: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ message: "Comment not found" });

      const reply = (comment.replies || []).id(replyId);
      if (!reply) return res.status(404).json({ message: "Reply not found" });
      if (reply.user.toString() !== req.user.id)
        return res.status(403).json({ message: "Not authorized" });

      reply.text = text.trim();
      reply.editedAt = new Date();
      await post.save();

      res.json({
        reply: {
          _id: reply._id,
          user: reply.user,
          replyTo: reply.replyTo,
          text: reply.text,
          createdAt: reply.createdAt,
          updatedAt: reply.updatedAt,
          editedAt: reply.editedAt,
          likes: reply.likes ?? [],
          dislikes: reply.dislikes ?? [],
        },
      });
    } catch (err) {
      console.error("Edit reply error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Delete reply
router.delete(
  "/posts/:postId/comments/:commentId/replies/:replyId",
  verifyToken,
  async (req, res) => {
    try {
      const { Post } = getM(req);

      const { postId, commentId, replyId } = req.params;
      const post = await Post.findById(postId);
      if (!post) return res.status(404).json({ message: "Post not found" });

      const comment = post.comments.id(commentId);
      if (!comment) return res.status(404).json({ message: "Comment not found" });

      const reply = (comment.replies || []).id(replyId);
      if (!reply) return res.status(404).json({ message: "Reply not found" });

      const uid = req.user.id;
      const canDelete =
        reply.user.toString() === uid || post.user.toString() === uid;
      if (!canDelete) return res.status(403).json({ message: "Not authorized" });

      reply.deleteOne();
      await post.save();

      res.json({ message: "Reply deleted" });
    } catch (err) {
      console.error("Delete reply error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
