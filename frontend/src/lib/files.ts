// src/lib/files.ts
export const API = import.meta.env.VITE_API_URL; // "https://social-media-app-hey5.onrender.com"
export const fileUrl = (pathOrName?: string) => {
  if (!pathOrName) return "";
  // support either "abc.jpg" or "/uploads/abc.jpg"
  const p = pathOrName.startsWith("/uploads/") ? pathOrName : `/uploads/${pathOrName}`;
  return `${API}${p}`;
};
