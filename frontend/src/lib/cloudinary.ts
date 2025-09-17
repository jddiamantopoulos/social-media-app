// src/lib/cloudinary.ts
export const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME!;
export const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET!;

export async function uploadImage(file: File): Promise<string> {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET); // unsigned preset
  // optional: folder
  fd.append("folder", "social-media-app");

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) throw new Error("Cloudinary upload failed");
  const json = await res.json();
  return json.secure_url as string; // <- store this in your DB
}
