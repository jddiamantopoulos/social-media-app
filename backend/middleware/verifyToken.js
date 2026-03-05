/**
 * Express middleware for authenticating requests using JSON Web Tokens (JWT).
 *
 * Expects an Authorization header in the format:
 *   "Bearer <token>"
 *
 * Verifies the token using the server's JWT secret and, if valid,
 * attaches a normalized user object to req.user for downstream routes.
 */
const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const auth = req.headers["authorization"] || "";
  const [scheme, token] = auth.split(" ");

  if (!token || !/^Bearer$/i.test(scheme)) {
    return res.status(401).json({ message: "Missing or malformed Authorization header" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
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
