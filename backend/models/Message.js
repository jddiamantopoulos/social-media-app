/**
 * Message schema for direct messaging.
 *
 * Stores messages within a Conversation and tracks sender/recipient,
 * read state (readBy), and timestamps. Includes indexes optimized for:
 *   - loading a conversation chronologically
 *   - fetching the latest message per conversation (inbox view)
 *   - scanning unread messages for a recipient
 */
const { Schema } = require("mongoose");

const MessageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      // Filter by conversation
      index: true,
    },
    sender:    { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body:      { type: String, required: true, maxlength: 2200, trim: true },

    // Users who have read this message
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

// Scroll chat up
MessageSchema.index({ conversation: 1, createdAt: 1 });
// Find latest fast
MessageSchema.index({ conversation: 1, createdAt: -1 });
// Speed unread scans
MessageSchema.index({ recipient: 1, createdAt: -1 });

module.exports = { MessageSchema };
