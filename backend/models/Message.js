// models/Message.js
const { Schema } = require("mongoose");

const MessageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true, // filter by conversation
    },
    sender:    { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body:      { type: String, required: true, maxlength: 2200, trim: true },

    // users who have read this message
    readBy: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
  },
  { timestamps: true }
);

// Queries:
// - get all messages in a convo sorted by time (asc) -> /messages/:conversationId
// - get latest per convo (desc) when building inbox
// - count unread for a recipient

MessageSchema.index({ conversation: 1, createdAt: 1 });   // scroll chat up
MessageSchema.index({ conversation: 1, createdAt: -1 });  // find latest fast
MessageSchema.index({ recipient: 1, createdAt: -1 });     // speed unread scans

module.exports = { MessageSchema };
