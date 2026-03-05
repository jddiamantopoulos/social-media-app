/**
 * Post schema for the main social feed.
 *
 * Supports nested comments and one-level replies, along with
 * likes/dislikes and edit tracking. Uses embedded subdocuments
 * to optimize read performance for feed and discussion views.
 *
 * Includes indexes for feed ordering, per-user posts, and
 * efficient updates to nested comments and replies.
 */
const { Schema } = require("mongoose");

const ReplySchema = new Schema(
  {
    user:    { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    replyTo: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text:    { type: String, required: true, trim: true, maxlength: 2200 },
    likes:   [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    dislikes:[{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    editedAt:{ type: Date, default: null },
  },
  { timestamps: true }
);

const CommentSchema = new Schema(
  {
    user:     { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text:     { type: String, required: true, trim: true, maxlength: 2200 },
    likes:    [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    dislikes: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    replies:  [ReplySchema],
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const PostSchema = new Schema(
  {
    user:        { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 2200 },
    imageUrl:    { type: String },
    likes:       [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    dislikes:    [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    comments:    [CommentSchema],
    editedAt:    { type: Date, default: null },
  },
  { timestamps: true }
);

// Feed & per-user queries
PostSchema.index({ createdAt: -1, _id: -1 });
PostSchema.index({ user: 1, createdAt: -1 });

// Speed up updates that filter by subdoc ids:
// e.g. { _id: postId, "comments._id": commentId }
PostSchema.index({ "comments._id": 1 });
PostSchema.index({ "comments.replies._id": 1 });

module.exports = { PostSchema };
