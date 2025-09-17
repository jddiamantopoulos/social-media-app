// src/components/EditPostPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";

const MAX_DESC_LEN = 2200;

const truncateMiddle = (str: string, max = 28) => {
  if (!str) return "";
  if (str.length <= max) return str;
  const half = Math.floor((max - 3) / 2);
  return str.slice(0, half) + "…" + str.slice(-half);
};

const stripNewlines = (s: string) => (s ?? "").replace(/[\r\n]+/g, " ").trim();

const EditPostPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || "";

  // who am I?
  const me = useMemo(
    () => JSON.parse(localStorage.getItem("user") || "{}") as { id?: string },
    []
  );
  const myId = String(me.id || "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [description, setDescription] = useState("");
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null); // replacement (optional)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const descLen = description.trim().length;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`/api/posts/${id}`);

        // who owns this post?
        const ownerId = String(
          data.ownerId ??
            data.userId ??
            data.authorId ??
            data.user?._id ??
            data.author?._id ??
            ""
        );
        const isDeleted = Boolean(
          data.deleted ?? data.isDeleted ?? data.removed
        );
        const myId = JSON.parse(localStorage.getItem("user") || "{}").id || "";

        // if not mine (or deleted), bounce to the public post page
        if (isDeleted || ownerId !== myId) {
          navigate(`/posts/${id}`, { replace: true });
          return;
        }

        if (cancelled) return;
        setDescription(stripNewlines(data?.description || ""));
        setCurrentImageUrl(data?.imageUrl || null);
        setLoading(false);
      } catch (err: any) {
        // 404/410 = gone, 403 = not allowed → show the post page (or its Not Found UI)
        const code = err?.response?.status;
        if (code === 404 || code === 410 || code === 403) {
          navigate(`/posts/${id}`, { replace: true });
          return;
        }
        // fallback: still send them to the post page
        navigate(`/posts/${id}`, { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  // Preview selected file
  useEffect(() => {
    if (!imageFile) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFile]);

  const openPicker = () => fileInputRef.current?.click();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // reset first so picking the same file works
    setImageFile(null);
    setTimeout(() => setImageFile(f), 0);
    setError("");
  };

  const removeSelected = () => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Newline-blocking handlers for description
  const onDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let val = stripNewlines(e.target.value);
    if (val.length > MAX_DESC_LEN) val = val.slice(0, MAX_DESC_LEN);
    setDescription(val);
  };

  const onDescKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (
    e
  ) => {
    if (e.key === "Enter") {
      e.preventDefault(); // block newline insert
    }
  };

  const onDescPaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
    e.preventDefault();
    const pasted = stripNewlines(e.clipboardData.getData("text"));
    const target = e.currentTarget;
    const start = target.selectionStart ?? description.length;
    const end = target.selectionEnd ?? description.length;

    const next = (
      description.slice(0, start) +
      pasted +
      description.slice(end)
    ).slice(0, MAX_DESC_LEN);

    setDescription(next);
    // place caret after inserted text
    requestAnimationFrame(() => {
      const pos = start + pasted.length;
      target.setSelectionRange(pos, pos);
    });
  };

  // For editing: allow submitting with or without replacing image,
  // but require a non-empty, within-limit description.
  const canSubmit = useMemo(
    () => descLen > 0 && descLen <= MAX_DESC_LEN && !submitting,
    [descLen, submitting]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const desc = stripNewlines(description);
    if (!desc) {
      setError("Description cannot be empty.");
      return;
    }
    if (desc.length > MAX_DESC_LEN) {
      setError(`Description must be ${MAX_DESC_LEN} characters or less.`);
      return;
    }

    const form = new FormData();
    form.append("description", desc);
    if (imageFile) form.append("image", imageFile);

    try {
      setSubmitting(true);
      await axios.put(`/api/posts/${id}`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      navigate("/home");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update post");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <p className="container" style={{ paddingTop: 56 }}>
        Loading…
      </p>
    );

  // Prefer new preview, else show current image if present
  const effectivePreview = previewUrl || currentImageUrl || null;

  const ABS_API = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const imgSrc = (u?: string) =>
    !u ? "" : /^https?:\/\//i.test(u) ? u : `${ABS_API}${u.startsWith("/") ? u : `/${u}`}`;

  return (
    <div className="container" style={{ paddingTop: 56 }}>
      <style>{`
        .post-card {
          max-width: 820px;
          margin: 0 auto;
          border: 1px solid var(--bs-border-color);
          border-radius: 12px;
          overflow: hidden;
          background: var(--bs-card-bg);
          color: var(--bs-body-color);
          box-shadow: var(--elev-card);
        }

        /* Header uses the card cap color + themed divider */
        .post-header {
          padding: 16px 20px;
          background: var(--bs-card-cap-bg);
          border-bottom: 1px solid var(--bs-border-color);
        }

        /* Layout stays the same */
        .post-body {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          padding: 16px;
        }
        @media (max-width: 768px) {
          .post-body { grid-template-columns: 1fr; }
        }

        /* Subtle surface for the image drop area (dark/light aware) */
        :root {
          /* derive soft panels from your theme vars */
          --image-panel-bg: color-mix(in srgb, var(--bs-card-bg) 94%, var(--bs-body-color) 6%);
          --image-panel-bg-hover: color-mix(in srgb, var(--bs-card-bg) 90%, var(--bs-body-color) 10%);
        }

        .image-wrap {
          position: relative;
          border: 2px dashed var(--bs-border-color);
          border-radius: 12px;
          min-height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: var(--image-panel-bg);
          cursor: pointer;
          user-select: none;
          transition: border-color .15s ease-in-out, background .15s ease-in-out;
        }
        .image-wrap:hover {
          border-color: var(--bs-border-color);
          background: var(--image-panel-bg-hover);
        }

        .image-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* Muted tokens become theme-aware */
        .placeholder-emoji {
          font-size: 56px;
          line-height: 1;
          color: var(--bs-secondary-color);
        }

        .file-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 8px;
        }
        .file-name {
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        /* Keep danger link red; everything else already themed */
        .link-plain {
          background: none;
          border: none;
          color: #dc3545;
          padding: 0;
          font-size: .875rem;
          font-weight: 500;
          text-decoration: none !important;
          cursor: pointer;
        }

        /* Textarea styling comes from global theme overrides; just size */
        .desc-area {
          resize: none;
          min-height: 220px;
        }

        /* Counters use theme-muted */
        .counter {
          font-size: .875rem;
          color: var(--bs-secondary-color);
        }
        .counter.danger {
          color: #dc3545;
          font-weight: 600;
        }

        .image-caption { text-align: center; margin-top: 8px; }
      `}</style>

      <div className="post-card">
        <div className="post-header">
          <h2 className="mb-0">Edit Post</h2>
        </div>

        {error && <div className="alert alert-danger m-3">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="post-body">
            {/* Image side */}
            <div>
              {/* hidden input */}
              <input
                ref={fileInputRef}
                id="image-upload"
                type="file"
                accept="image/*"
                className="visually-hidden"
                onChange={handleImageChange}
              />

              {/* Big clickable box */}
              <div
                className="image-wrap"
                role="button"
                tabIndex={0}
                onClick={openPicker}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") && openPicker()
                }
                aria-label={effectivePreview ? "Change image" : "Add a photo"}
                title={effectivePreview ? "Change image" : "Add a photo"}
              >
                {effectivePreview ? (
                  <img
                    src={imgSrc(effectivePreview)}
                    alt="Preview"
                    className="image-preview"
                  />
                ) : (
                  <div className="placeholder-emoji" aria-hidden>
                    🖼️
                  </div>
                )}
              </div>

              {/* Text UNDER the big picture */}
              {!effectivePreview ? (
                <div className="image-caption">
                  <small className="text-muted">
                    Click the box to add a photo
                  </small>
                </div>
              ) : imageFile ? (
                <div className="file-row">
                  <small
                    className="text-muted file-name"
                    title={imageFile.name}
                  >
                    Selected:{" "}
                    <strong>{truncateMiddle(imageFile.name, 22)}</strong>
                  </small>
                  <button
                    type="button"
                    className="link-plain"
                    onClick={removeSelected}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="image-caption">
                  <small className="text-muted">
                    Click the box to replace the current photo
                  </small>
                </div>
              )}
            </div>

            {/* Description side */}
            <div>
              <label htmlFor="description" className="form-label">
                Description
              </label>
              <textarea
                id="description"
                className="form-control desc-area"
                rows={9}
                maxLength={MAX_DESC_LEN}
                value={description}
                onChange={onDescChange}
                onKeyDown={onDescKeyDown}
                onPaste={onDescPaste}
                placeholder="Update your caption…"
              />
              <div className="d-flex justify-content-between mt-2">
                <small
                  className={`counter ${
                    descLen === 0 || description.length > MAX_DESC_LEN
                      ? "danger"
                      : ""
                  }`}
                >
                  {description.length}/{MAX_DESC_LEN}
                </small>
                {descLen === 0 && (
                  <small className="text-danger">Required</small>
                )}
              </div>

              <div
                className="d-flex justify-content-end mt-3"
                style={{ gap: 8 }}
              >
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => navigate(-1)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!canSubmit}
                >
                  {submitting ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPostPage;
