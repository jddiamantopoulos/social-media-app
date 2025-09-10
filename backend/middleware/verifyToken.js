// middleware/verifyToken.js
const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const auth = req.headers["authorization"] || ""; // "Bearer <token>"
  const [scheme, token] = auth.split(" ");

  if (!token || !/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ message: "Missing or malformed Authorization header" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET); // throws if bad/expired
    // Normalize the shape expected by routes
    req.user = {
      id: String(payload.id || ""),
      username: payload.username || "",
    };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = verifyToken;
