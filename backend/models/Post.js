// models/Post.js
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
  { timestamps: true } // adds createdAt/updatedAt to replies
);

const CommentSchema = new Schema(
  {
    user:     { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text:     { type: String, required: true, trim: true, maxlength: 2200 },
    likes:    [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    dislikes: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    replies:  [ReplySchema], // one-level replies
    editedAt: { type: Date, default: null },
  },
  { timestamps: true } // adds createdAt/updatedAt to comments
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
  { timestamps: true } // adds createdAt/updatedAt to posts
);

// Feed & per-user queries
PostSchema.index({ createdAt: -1, _id: -1 });
PostSchema.index({ user: 1, createdAt: -1 });

// Speed up updates that filter by subdoc ids:
// e.g. { _id: postId, "comments._id": commentId }
PostSchema.index({ "comments._id": 1 });
PostSchema.index({ "comments.replies._id": 1 });

module.exports = { PostSchema };
