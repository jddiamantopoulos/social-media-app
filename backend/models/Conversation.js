// models/Conversation.js
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
    // e.g., "<idA>_<idB>" with ids sorted lexicographically
    participantsKey: { type: String, unique: true, index: true },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Build a stable key regardless of participant order
function buildKey(list) {
  const [a, b] = (list || []).map((id) => String(id)).sort();
  return a && b ? `${a}_${b}` : null; // underscore to match messages.js
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