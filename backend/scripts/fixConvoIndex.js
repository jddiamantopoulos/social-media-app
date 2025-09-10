// scripts/fixConvoIndex.js
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
