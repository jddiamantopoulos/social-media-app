// src/components/PostPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const MAX_DESC_LEN = 2200;

function truncateMiddle(name: string, max = 22) {
  if (name.length <= max) return name;
  const head = Math.max(8, Math.floor((max - 1) / 2));
  const tail = Math.max(6, max - head - 1);
  return name.slice(0, head) + "…" + name.slice(-tail);
}

const stripNewlines = (s: string) => (s ?? "").replace(/[\r\n]+/g, " ").trim();

const PostPage: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!imageFile) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const descLen = description.trim().length;
  const canSubmit = useMemo(
    () => !!imageFile && descLen > 0 && descLen <= MAX_DESC_LEN,
    [imageFile, descLen]
  );

  const openPicker = () => {
    if (fileInputRef.current) {
      // allow reselecting the same file
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      setError("");
    }
  };

  const removeImage = () => {
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- no-newlines handlers for description ---
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!imageFile) {
      setError("Please select an image.");
      return;
    }

    const cleanDesc = stripNewlines(description);
    const cleanLen = cleanDesc.length;

    if (cleanLen === 0) {
      setError("Description cannot be empty.");
      return;
    }
    if (cleanLen > MAX_DESC_LEN) {
      setError(`Description must be ${MAX_DESC_LEN} characters or less.`);
      return;
    }

    const formData = new FormData();
    formData.append("image", imageFile); // <-- field name must match backend
    formData.append("description", cleanDesc);

    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      await axios.post("/api/posts", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });
      navigate("/home");
    } catch (err: any) {
      console.error("PostPage error:", err);
      setError(err.response?.data?.message || "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  };

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
          <h2 className="mb-0">Create a New Post</h2>
        </div>

        {error && <div className="alert alert-danger m-3">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="post-body">
            {/* Image side */}
            <div>
              {/* Hidden file input */}
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
                aria-label={previewUrl ? "Change image" : "Add a photo"}
                title={previewUrl ? "Change image" : "Add a photo"}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
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
              {!imageFile ? (
                <div className="image-caption">
                  <small className="text-muted">
                    Click the box to add a photo
                  </small>
                </div>
              ) : (
                <div className="file-row">
                  <small className="text-muted file-name">
                    Selected:{" "}
                    <strong title={imageFile.name}>
                      {typeof truncateMiddle === "function"
                        ? truncateMiddle(imageFile.name, 22)
                        : imageFile.name}
                    </strong>
                  </small>
                  <button
                    type="button"
                    className="link-plain"
                    onClick={removeImage}
                  >
                    Remove
                  </button>
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
                placeholder="Say something about your post…"
                onChange={onDescChange}
                onKeyDown={onDescKeyDown}
                onPaste={onDescPaste}
              />
              <div className="d-flex justify-content-between mt-2">
                <small
                  className={`counter ${
                    descLen > MAX_DESC_LEN || descLen === 0 ? "danger" : ""
                  }`}
                >
                  {descLen}/{MAX_DESC_LEN}
                </small>
                {descLen === 0 && (
                  <small className="text-danger">Required</small>
                )}
              </div>

              <div className="d-flex justify-content-end mt-3">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!canSubmit || submitting}
                >
                  {submitting ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostPage;
