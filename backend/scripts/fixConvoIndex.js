/**
 * Conversation collection index repair script.
 *
 * Purpose:
 *   - Connects to MongoDB using the configured MONGO_URI
 *   - Inspects existing indexes on the "conversations" collection
 *   - Removes the legacy "key_1" index if present
 *   - Recreates a partial unique index on the "key" field
 *   - Enforces uniqueness only for documents where key is a string
 *
 * Use Case:
 *   - Migrates legacy or corrupted indexes
 *   - Prevents duplicate conversation keys
 *   - Safely handles documents with missing or non-string keys
 *
 * Usage:
 *   node scripts/fixConvoIndex.js
 *
 * Environment:
 *   - Requires MONGO_URI to be set in .env or environment variables
 */
const mongoose = require("mongoose");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const db = mongoose.connection.db;
    const col = db.collection("conversations");

    const indexes = await col.indexes();
    const hasKeyIdx = indexes.find(i => i.name === "key_1");
    if (hasKeyIdx) {
      console.log("Dropping key_1...");
      await col.dropIndex("key_1");
    }

    console.log("Creating partial unique index on key...");
    await col.createIndex(
      { key: 1 },
      { unique: true, partialFilterExpression: { key: { $type: "string" } } }
    );

    console.log("Done.");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
