/**
 * Registers and binds Mongoose schemas to a specific connection.
 *
 * Ensures that models are attached per-connection (rather than globally),
 * which allows the application to support multiple databases safely.
 *
 * Exposes a getModels(conn) helper that returns all application models
 * associated with the provided Mongoose connection.
 */
const path = require("path");

// Import schemas explicitly from files in this folder
const { UserSchema }         = require(path.join(__dirname, "User.js"));
const { PostSchema }         = require(path.join(__dirname, "Post.js"));
const { MessageSchema }      = require(path.join(__dirname, "Message.js"));
const { ConversationSchema } = require(path.join(__dirname, "Conversation.js"));
const { NotificationSchema } = require(path.join(__dirname, "Notification.js"));

function assertSchema(name, schema) {
  if (!schema || typeof schema !== "object") {
    throw new Error(
      `[models/byConn] ${name}Schema is undefined. Check export in models/${name}.js (module.exports = { ${name}Schema }).`
    );
  }
}
assertSchema("User", UserSchema);
assertSchema("Post", PostSchema);
assertSchema("Message", MessageSchema);
assertSchema("Conversation", ConversationSchema);
assertSchema("Notification", NotificationSchema);

function ensureModel(conn, name, schema) {
  if (!conn.models[name]) conn.model(name, schema);
  return conn.models[name];
}

// Register all schemas on the given mongoose connection and return the models
function getModels(conn) {
  return {
    User:         ensureModel(conn, "User",         UserSchema),
    Post:         ensureModel(conn, "Post",         PostSchema),
    Message:      ensureModel(conn, "Message",      MessageSchema),
    Conversation: ensureModel(conn, "Conversation", ConversationSchema),
    Notification: ensureModel(conn, "Notification", NotificationSchema),
  };
}

module.exports = { getModels };
