// db/pickTenant.js
function pickTenant(host = "") {
  const h = String(host || "").toLowerCase();

  // ---- prod subdomains ----
  if (h.startsWith("friends.cyberscape.com")) return "social_friends";
  if (h.startsWith("demo.cyberscape.com"))    return "social_demo";
  if (h.startsWith("app.cyberscape.com"))     return "socialmediaapp";

  // ---- dev helpers ----
  if (h.startsWith("friends.localhost")) return "social_friends";
  if (h.startsWith("demo.localhost"))    return "social_demo";

  // Fallback to main DB
  return "socialmediaapp";
}

module.exports = { pickTenant };
