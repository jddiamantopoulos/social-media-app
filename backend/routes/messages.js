// routes/messages.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const verifyToken = require("../middleware/verifyToken");

const MAX_LEN = 2200;

// tenant-bound models accessor
const getM = (req) => req.models;

/** Build a stable, unique key for a 2-party conversation. */
function buildParticipantsKey(a, b) {
  const [x, y] = [String(a).trim(), String(b).trim()].sort();
  return `${x}_${y}`;
}

/** Create-or-get conversation (no lastMessageAt here). */
router.post("/messages/start", verifyToken, async (req, res) => {
  try {
    const { Conversation } = getM(req);

    const me = String(req.user.id || "").trim();
    const other = String(req.body.userId || "").trim();

    if (!other || other === me) {
      return res.status(400).json({ message: "Bad userId" });
    }
    if (
      !mongoose.Types.ObjectId.isValid(me) ||
      !mongoose.Types.ObjectId.isValid(other)
    ) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const meId = new mongoose.Types.ObjectId(me);
    const otherId = new mongoose.Types.ObjectId(other);
    const participantsKey = buildParticipantsKey(meId, otherId);

    const convo = await Conversation.findOneAndUpdate(
      { participantsKey },
      {
        $setOnInsert: {
          participants: [meId, otherId].sort((a, b) =>
            a.toString().localeCompare(b.toString())
          ),
          participantsKey, // unique index in schema
          // lastMessageAt becomes non-null on first message
        },
      },
      { new: true, upsert: true }
    );

    return res.json({ conversationId: convo._id });
  } catch (e) {
    console.error("POST /messages/start failed:", e);
    return res.status(500).json({ message: "Failed to start conversation." });
  }
});

/** Total unread for current user (for navbar badge). */
router.get("/messages/unread-count", verifyToken, async (req, res) => {
  try {
    const { Message } = getM(req);

    const meId = new mongoose.Types.ObjectId(String(req.user.id));
    const agg = await Message.aggregate([
      {
        $match: {
          recipient: meId,
          readBy: { $nin: [meId] }, // array does not contain me
        },
      },
      { $count: "count" },
    ]);

    const count = agg.length ? agg[0].count : 0;
    res.json({ count });
  } catch (err) {
    console.error("GET /messages/unread-count error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** List my conversations (only those with at least one message). Includes unreadCount per convo. */
router.get("/messages/conversations", verifyToken, async (req, res) => {
  try {
    const { Conversation, Message, User } = getM(req);

    const me = String(req.user.id);
    const meId = new mongoose.Types.ObjectId(me);

    const convos = await Conversation.find({
      participants: meId,                 // cast to ObjectId
      lastMessageAt: { $ne: null },       // only convos with first message sent
    })
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .lean();

    if (convos.length === 0) {
      return res.json({ conversations: [] });
    }

    const convoIds = convos.map((c) => c._id);

    // Latest message per conversation
    const latest = await Message.find({ conversation: { $in: convoIds } })
      .sort({ createdAt: -1 })
      .select("conversation sender body createdAt")
      .lean();

    const latestMap = new Map();
    for (const m of latest) {
      const k = String(m.conversation);
      if (!latestMap.has(k)) latestMap.set(k, m);
    }

    // Unread counts per conversation (messages addressed TO me and not read by me)
    const unreadAgg = await Message.aggregate([
      {
        $match: {
          conversation: { $in: convoIds },
          recipient: meId,
          readBy: { $nin: [meId] },
        },
      },
      { $group: { _id: "$conversation", count: { $sum: 1 } } },
    ]);
    const unreadMap = new Map(unreadAgg.map((u) => [String(u._id), u.count]));

    // Other users for each conversation
    const otherIds = [];
    const otherByConvo = {};
    for (const c of convos) {
      const otherId = (c.participants || [])
        .map(String)
        .find((p) => p !== me) || null;
      if (otherId) {
        otherByConvo[String(c._id)] = otherId;
        otherIds.push(new mongoose.Types.ObjectId(otherId));
      }
    }

    const users = await User.find(
      { _id: { $in: otherIds } },
      { username: 1, photoUrl: 1 }
    ).lean();
    const userMap = new Map(users.map((u) => [String(u._id), u]));

    const result = convos.map((c) => {
      const id = String(c._id);
      const otherId = otherByConvo[id];
      const otherUser = otherId ? userMap.get(otherId) : null;
      const last = latestMap.get(id) || null;
      const unreadCount = unreadMap.get(id) || 0;

      return {
        _id: c._id,
        lastMessageAt: c.lastMessageAt,
        otherUser: otherUser
          ? {
              _id: otherUser._id,
              username: otherUser.username,
              photoUrl: otherUser.photoUrl,
            }
          : null,
        lastMessageBody: last ? last.body : "",
        lastMessageSender: last ? String(last.sender) : null,
        lastMessageCreatedAt: last ? last.createdAt : c.lastMessageAt,
        unreadCount,
      };
    });

    return res.json({ conversations: result });
  } catch (err) {
    console.error("GET /messages/conversations error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/** Fetch messages (no auto-read here; the client calls /read separately). */
router.get("/messages/:conversationId", verifyToken, async (req, res) => {
  try {
    const { Conversation, Message } = getM(req);

    const { conversationId } = req.params;
    const me = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation id" });
    }

    const convo = await Conversation.findById(conversationId).select(
      "participants"
    );
    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    const isParticipant = (convo.participants || []).some(
      (p) => String(p) === String(me)
    );
    if (!isParticipant) return res.status(403).json({ message: "Forbidden" });

    const messages = await Message.find({ conversation: convo._id })
      .sort({ createdAt: 1 })
      .lean();

    res.json({ messages });
  } catch (err) {
    console.error("get messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/** Mark all inbound messages in this convo as read for me. */
router.post("/messages/:conversationId/read", verifyToken, async (req, res) => {
  try {
    const { Conversation, Message } = getM(req);

    const { conversationId } = req.params;
    const meId = new mongoose.Types.ObjectId(String(req.user.id));

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation id" });
    }

    const convo = await Conversation.findById(conversationId).select(
      "participants"
    );
    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    const isParticipant = (convo.participants || []).some(
      (p) => String(p) === String(meId)
    );
    if (!isParticipant) return res.status(403).json({ message: "Forbidden" });

    const result = await Message.updateMany(
      { conversation: convo._id, recipient: meId, readBy: { $nin: [meId] } },
      { $addToSet: { readBy: meId } }
    );

    return res.json({ ok: true, updatedCount: result.modifiedCount || 0 });
  } catch (err) {
    console.error("POST /messages/:conversationId/read error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/** Send message + stamp lastMessageAt. */
router.post("/messages/:conversationId", verifyToken, async (req, res) => {
  try {
    const { Conversation, Message } = getM(req);

    const { conversationId } = req.params;
    const me = String(req.user.id);

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation id" });
    }

    const raw = String(req.body.body || "");
    const body = raw.trim();
    if (!body) return res.status(400).json({ message: "Message body required" });
    if (body.length > MAX_LEN) {
      return res
        .status(400)
        .json({ message: `Message must be <= ${MAX_LEN} characters` });
    }

    const convo = await Conversation.findById(conversationId).select(
      "participants"
    );
    if (!convo) return res.status(404).json({ message: "Conversation not found" });

    const isParticipant = (convo.participants || []).some((p) => String(p) === me);
    if (!isParticipant) return res.status(403).json({ message: "Forbidden" });

    const recipient = String(
      (convo.participants || []).find((p) => String(p) !== me)
    );

    const msg = await Message.create({
      conversation: convo._id,
      sender: me,
      recipient,
      body,
    });

    await Conversation.updateOne(
      { _id: convo._id },
      { $set: { lastMessageAt: msg.createdAt } }
    );

    return res.status(201).json({
      message: {
        _id: msg._id,
        conversation: msg.conversation,
        sender: String(msg.sender),
        recipient: String(msg.recipient),
        body: msg.body,
        createdAt: msg.createdAt,
      },
    });
  } catch (err) {
    console.error("POST /messages/:conversationId error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
