// models/Notification.js
const { Schema } = require("mongoose");

const NotificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actor:     { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["post_like","follow","new_post","comment_like","comment_reply","post_comment","post_reply"],
      required: true,
    },
    post:    { type: Schema.Types.ObjectId, ref: "Post" },
    comment: { type: Schema.Types.ObjectId }, // subdoc id
    reply:   { type: Schema.Types.ObjectId }, // subdoc id
    read:    { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Lists & pagination
NotificationSchema.index({ recipient: 1, createdAt: -1 });
// Unread filters / mark-all-read
NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = { NotificationSchema };
