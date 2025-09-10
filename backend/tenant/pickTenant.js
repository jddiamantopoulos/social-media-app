// tenant/pickTenant.js
function pickTenant(host = "") {
  const h = String(host || "").toLowerCase();

  // ----- production subdomains -----
  // e.g., friends.cyberscape.com, resume.cyberscape.com, app.cyberscape.com
  if (h.startsWith("friends.")) return "social_friends";
  if (h.startsWith("resume."))  return "social_resume";
  if (h.startsWith("app."))     return "social_default"; // main "app" tenant

  // ----- dev helpers (localhost) -----
  // if you sometimes use custom hosts like friends.localhost or resume.localhost
  if (h.startsWith("friends.localhost")) return "social_friends";
  if (h.startsWith("resume.localhost"))  return "social_resume";
  if (h.startsWith("localhost"))         return "social_default";

  // Fallback to main DB
  return "social_default";
}

module.exports = { pickTenant };
