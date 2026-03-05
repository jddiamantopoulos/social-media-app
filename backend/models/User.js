/**
 * User schema for authentication and social relationships.
 *
 * Stores core account credentials and profile metadata, along with
 * follower/following references for building the social graph.
 *
 * Enforces case-insensitive unique usernames via indexed collation.
 */
const { Schema } = require("mongoose");

const UserSchema = new Schema(
  {
    username:    { type: String, required: true, trim: true },
    password:    { type: String, required: true },
    photoUrl:    { type: String, default: "/default-avatar.png" },
    description: { type: String, default: "" },

    followers: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    following: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
  },
  { timestamps: true }
);

// Case-insensitive unique index for usernames
UserSchema.index(
  { username: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

module.exports = { UserSchema };
