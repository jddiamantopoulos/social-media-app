/**
 * Conversation schema for 1:1 direct messages.
 *
 * Enforces exactly two participants and maintains a stable participantsKey
 * (<idA>_<idB> sorted lexicographically) so the same pair of users maps to
 * a single conversation regardless of participant order.
 *
 * Includes lastMessageAt for efficient inbox-style sorting.
 */
const { Schema } = require("mongoose");

const ConversationSchema = new Schema(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 2,
        message: "Conversation must have exactly 2 participants",
      },
    },
    // E.g., "<idA>_<idB>" with ids sorted lexicographically
    participantsKey: { type: String, unique: true, index: true },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Build a stable key regardless of participant order
function buildKey(list) {
  const [a, b] = (list || []).map((id) => String(id)).sort();
  return a && b ? `${a}_${b}` : null;
}

ConversationSchema.pre("save", function (next) {
  if (!this.participantsKey || this.isModified("participants")) {
    this.participantsKey = buildKey(this.participants);
  }
  next();
});

// Handy helper to compute the key outside
ConversationSchema.statics.participantsKeyFor = function (a, b) {
  return buildKey([a, b]);
};

ConversationSchema.index({ lastMessageAt: -1 });

module.exports = { ConversationSchema };