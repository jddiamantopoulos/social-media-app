// src/components/Profile.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { timeAgo } from "../utils/timeAgo";

interface SimpleUser {
  _id: string;
  username: string;
  photoUrl: string;
}
interface Reply {
  _id: string;
  user: { _id: string; username: string; photoUrl: string };
  replyTo: { _id: string; username: string; photoUrl: string };
  text: string;
  createdAt: string;
  editedAt?: string;
  likes?: string[];
  dislikes?: string[];
}
interface Comment {
  _id: string;
  user: { _id: string; username: string; photoUrl: string };
  text: string;
  createdAt: string;
  editedAt?: string;
  likes: string[];
  dislikes: string[];
  replies?: Reply[];
}
interface Post {
  _id: string;
  user: { _id: string; username: string; photoUrl: string };
  description: string;
  imageUrl?: string;
  likes: string[];
  dislikes: string[];
  comments: Comment[];
  createdAt: string;
  editedAt?: string;
}
interface Me {
  id: string;
  username: string;
  photoUrl: string;
  description?: string;
  followersCount?: number;
  followingCount?: number;
}

const MAX_DESC_LEN = 150;
const stripNewlines = (s: string) => (s ?? "").replace(/[\r\n]+/g, " ").trim();

const Profile: React.FC = () => {
  const token = localStorage.getItem("token")!;
  const navigate = useNavigate();
  const storedMe = JSON.parse(localStorage.getItem("user") || "{}") as Me;

  const [me, setMe] = useState<Me>(storedMe);
  const [photoUrl, setPhotoUrl] = useState(me.photoUrl);
  const [description, setDescription] = useState(me.description || "");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [overlayPostId, setOverlayPostId] = useState<string | null>(null);

  // followers/following overlays
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followersList, setFollowersList] = useState<SimpleUser[]>([]);
  const [followingList, setFollowingList] = useState<SimpleUser[]>([]);

  // unified description editing state
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState(description ?? "");

  const fileRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const baseBg = (location.state as any)?.backgroundLocation || location;
  const refreshIfSame: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (location.pathname === "/profile") {
      e.preventDefault(); // don’t re-push /profile
      navigate(0); // React Router v6 hard refresh
    }
  };

  const onDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let val = stripNewlines(e.target.value);
    if (val.length > MAX_DESC_LEN) val = val.slice(0, MAX_DESC_LEN);
    setEditDesc(val);
  };
  const onDescKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (
    e
  ) => {
    if (e.key === "Enter") e.preventDefault(); // block newlines entirely
  };

  const styles = `
  .icon-btn {
    background: none;
    border: 0;
    padding: 4px;
    margin: 0;
    line-height: 1;
    color: #6c757d;
    cursor: pointer;
    border-radius: .375rem;
  }
  .icon-btn:hover { color: var(--bs-primary); }
  .icon-btn.danger:hover { color: #dc3545; }
  .icon-btn:focus { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

  .reaction {
    background: none;
    border: 0;
    padding: 0;
    margin-right: 12px;
    color: #6c757d;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .reaction.like.active { color: #0d6efd; }
  .reaction.like:hover { color: #0d6efd; }
  .reaction.comment:hover { color: #0d6efd; }

  .reaction.dislike.active { color: #dc3545; }
  .reaction.dislike:hover { color: #dc3545; }
  .reaction:focus { outline: 2px solid #0d6efd33; outline-offset: 2px; border-radius: .375rem; }
  
  .profile-card {
    max-width: 900px;
    margin: 16px auto 24px;
    border: 1px solid var(--bs-border-color);
    border-radius: 14px;
    background: var(--bs-card-bg);
    box-shadow:
      0 10px 22px -12px rgba(0,0,0,.35),
      0 6px 18px rgba(0,0,0,.05);
    padding: 18px 20px;
  }
  .avatar-wrap {
    position: relative;
    width: 128px; height: 128px;
  }
  .avatar-img {
    width: 128px; height: 128px;
    object-fit: cover;
    border-radius: 50%;
    border: 3px solid var(--bs-card-bg); /* ring matches card */
    box-shadow:
      0 0 0 3px var(--bs-card-bg),          /* crisp ring */
      0 0 18px 6px var(--ring-underlay),    /* radial glow */
      0 10px 22px -6px var(--ring-underlay),/* soft spread */
      0 12px 28px rgba(0,0,0,.35);          /* depth */
  }
  .avatar-camera {
    position: absolute;
    bottom: 6px;
    right: 6px;
    width: 40px; height: 40px;
    border-radius: 50%;
    background: var(--bs-primary);
    color: #fff;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 16px var(--focus-ring);
    cursor: pointer;
  }
  .avatar-camera:hover { background: var(--bs-primary-hover); }
  .avatar-camera:focus { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

  .stat {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid var(--bs-border-color);
    border-radius: 999px;
    background: var(--bs-card-bg);
    font-size: .95rem;
    color: var(--bs-secondary-color);
  }

  .desc-editor { resize: none; min-height: 120px; }
  .counter { font-size: .875rem; color: #6c757d; }
  .counter.danger { color: #dc3545; font-weight: 700; }

  .count-link {
    background: none;
    border: none;
    padding: 0;
    color: #0d6efd;
    cursor: pointer;
    text-decoration: none;
  }
  .count-link:hover { text-decoration: none; color: #0b5ed7; }

  /* Ensure long text wraps inside cards, never overflows horizontally */
  .wrap-text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  /* --- Feed skeleton shimmer --- */
  .skel {
    position: relative;
    overflow: hidden;
    background: color-mix(in srgb, var(--bs-secondary-bg, #e9ecef) 85%, #fff 15%);
  }
  .skel::after {
    content: "";
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
    animation: skel-shimmer 1.2s infinite;
  }
  @keyframes skel-shimmer {
    100% { transform: translateX(100%); }
  }
  `;

  const refreshProfile = async () => {
    const res = await axios.get<any>("/api/user/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = res.data;
    const meMapped: Me = {
      id: data._id,
      username: data.username,
      photoUrl: data.photoUrl,
      description: data.description,
      followersCount: data.followersCount ?? 0,
      followingCount: data.followingCount ?? 0,
    };
    setMe(meMapped);
    setPhotoUrl(data.photoUrl);
    setDescription(data.description || "");
    if (!editingDesc) setEditDesc(data.description || "");
    localStorage.setItem("user", JSON.stringify(meMapped));
  };

  const fetchPosts = async () => {
    try {
      const res = await axios.get<Post[]>(`/api/users/${me.id}/posts`);
      setPosts(res.data);
    } catch (err) {
      console.error("Fetch posts error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await refreshProfile();
      await fetchPosts();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reactPost = async (postId: string, type: "like" | "dislike") => {
    await axios.post(
      `/api/posts/${postId}/${type}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    fetchPosts();
  };

  const postComment = async (postId: string, text: string) => {
    if (!text.trim()) return;
    await axios.post(
      `/api/posts/${postId}/comments`,
      { text },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    fetchPosts();
  };

  const deletePost = async (postId: string) => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try {
      await axios.delete(`/api/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchPosts();
    } catch (err) {
      console.error("Delete post error:", err);
      alert("Failed to delete post.");
    }
  };

  const handleAvatarPick = () => fileRef.current?.click();

  // helper
  const cacheBust = (url: string) =>
    `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // Optional: instant preview while uploading
    const tempUrl = URL.createObjectURL(f);
    setPhotoUrl(tempUrl);

    const form = new FormData();
    form.append("avatar", f);

    const { data } = await axios.post("/api/user/avatar", form, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const freshUrl = cacheBust(data.photoUrl); // bust browser cache

    // Update header avatar immediately
    setPhotoUrl(freshUrl);

    // Update local user + localStorage
    setMe((prev) => {
      const next = { ...prev, photoUrl: freshUrl };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });

    // Update every post’s user avatar on this page
    setPosts((prev) =>
      prev.map((p) => ({ ...p, user: { ...p.user, photoUrl: freshUrl } }))
    );

    // Allow reselecting the same file later
    if (fileRef.current) fileRef.current.value = "";

    // Clean up the temp object URL
    URL.revokeObjectURL(tempUrl);
  };

  const saveDescription = async () => {
    const cleaned = stripNewlines(editDesc);
    const res = await axios.put(
      "/api/user/description",
      { description: cleaned },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setDescription(res.data.description);
    const next = { ...me, description: res.data.description };
    setMe(next);
    localStorage.setItem("user", JSON.stringify(next));
    setEditingDesc(false);
  };

  // lists
  const openFollowers = async () => {
    const { data } = await axios.get<SimpleUser[]>(
      `/api/users/${me.id}/followers`
    );
    setFollowersList(data);
    setShowFollowers(true);
  };
  const openFollowing = async () => {
    const { data } = await axios.get<SimpleUser[]>(
      `/api/users/${me.id}/following`
    );
    setFollowingList(data);
    setShowFollowing(true);
  };

  // --- Pretty loading skeleton ---
  const FeedLoading: React.FC<{ cards?: number }> = ({ cards = 3 }) => (
    <div aria-busy="true" aria-live="polite">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="card mb-4 shadow-sm">
          <div className="card-body d-flex align-items-start">
            <div
              className="rounded-circle skel"
              style={{ width: 32, height: 32, marginRight: 8 }}
            />
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <div
                className="skel"
                style={{
                  height: 14,
                  width: "35%",
                  borderRadius: 6,
                  marginBottom: 6,
                }}
              />
              <div
                className="skel"
                style={{ height: 12, width: "22%", borderRadius: 6 }}
              />
            </div>
          </div>

          <div className="card-body">
            <div
              className="skel"
              style={{
                height: 12,
                width: "96%",
                borderRadius: 6,
                marginBottom: 8,
              }}
            />
            <div
              className="skel"
              style={{
                height: 12,
                width: "82%",
                borderRadius: 6,
                marginBottom: 8,
              }}
            />
            <div
              className="skel"
              style={{ height: 12, width: "66%", borderRadius: 6 }}
            />
          </div>

          <div className="skel" style={{ height: 180 }} />

          <div className="card-footer d-flex" style={{ gap: 12 }}>
            <div
              className="skel"
              style={{ height: 16, width: 52, borderRadius: 8 }}
            />
            <div
              className="skel"
              style={{ height: 16, width: 52, borderRadius: 8 }}
            />
            <div
              className="skel"
              style={{ height: 16, width: 64, borderRadius: 8 }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  // --- Empty state card ---
  const EmptyFeed: React.FC<{ loggedIn: boolean; onCreate: () => void }> = ({
    loggedIn,
    onCreate,
  }) => (
    <div className="text-center py-5">
      <div className="display-6 mb-2" aria-hidden>
        📭
      </div>
      <h5 className="mb-1">No posts yet</h5>
      <p className="text-muted mb-3">Create a post with the post button.</p>
    </div>
  );
  
  const ABS_API = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const imgSrc = (u?: string) =>
    !u ? "" : /^https?:\/\//i.test(u) ? u : `${ABS_API}${u.startsWith("/") ? u : `/${u}`}`;

  const ListOverlay: React.FC<{
    title: string;
    list: SimpleUser[];
    onClose: () => void;
  }> = ({ title, list, onClose }) => {
    const [q, setQ] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Clear & focus the search each time the overlay opens
    useEffect(() => {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }, [title, list]);

    // Filter + alphabetical sort (case-insensitive)
    const filtered = useMemo(() => {
      const term = q.trim().toLowerCase();
      const base = term
        ? list.filter((u) => (u.username || "").toLowerCase().includes(term))
        : list.slice();

      return base.sort((a, b) =>
        (a.username || "").localeCompare(b.username || "", undefined, {
          sensitivity: "base",
        })
      );
    }, [q, list]);

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.4)",
          zIndex: 2000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={onClose}
        aria-modal="true"
        role="dialog"
      >
        <div
          className="card list-overlay-card"
          style={{
            width: "min(420px, 90vw)",
            maxHeight: "70vh",
            overflowY: "auto",
            background: "var(--bs-card-bg)",
            border: "1px solid var(--bs-border-color)",
            boxShadow:
              "0 10px 24px rgba(0,0,0,.35), 0 0 0 1px var(--bs-card-bg) inset",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <style>{`
          .list-overlay-card .list-group-item,
          .list-overlay-card .list-group-item-action {
            background: var(--bs-list-group-bg) !important;
            color: var(--bs-list-group-color) !important;
            border-color: var(--bs-list-group-border-color) !important;
          }
          .list-overlay-card .list-group-item-action:hover {
            background: var(--bs-list-group-action-hover-bg) !important;
            color: var(--bs-list-group-action-hover-color) !important;
          }
          .list-overlay-card .list-group-item.active {
            background: var(--bs-list-group-active-bg) !important;
            color: var(--bs-list-group-active-color) !important;
          }
          .list-overlay-card { scrollbar-width: thin; }
          .list-overlay-card::-webkit-scrollbar { width: 10px; }
          .list-overlay-card::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 8px;
          }
          .list-overlay-card::-webkit-scrollbar-thumb {
            background-color: var(--scrollbar-thumb);
            border-radius: 8px;
            border: 2px solid transparent;
            background-clip: content-box;
          }
          .list-overlay-card::-webkit-scrollbar-thumb:hover {
            background-color: var(--scrollbar-thumb-hover);
          }
        `}</style>

          {/* Header */}
          <div
            className="card-header d-flex justify-content-between align-items-center"
            style={{
              background: "var(--bs-card-cap-bg)",
              borderBottom: "1px solid var(--bs-border-color)",
              color: "var(--bs-body-color)",
            }}
          >
            <strong>{title}</strong>
            <button
              className="btn-close"
              style={{ filter: "var(--btn-close-filter)" }}
              onClick={onClose}
              aria-label="Close"
              title="Close"
            />
          </div>

          {/* Search bar */}
          <div
            className="px-3 py-2 border-bottom"
            style={{ background: "var(--bs-card-bg)" }}
          >
            <input
              ref={inputRef}
              type="search"
              className="form-control form-control-sm"
              placeholder={`Search ${title.toLowerCase()}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={`Search ${title}`}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {/* List */}
          <div
            className="list-group list-group-flush"
            style={{
              ["--bs-list-group-bg" as any]: "var(--bs-card-bg)",
              ["--bs-list-group-color" as any]: "var(--bs-body-color)",
              ["--bs-list-group-border-color" as any]: "var(--bs-border-color)",
              ["--bs-list-group-action-color" as any]: "var(--bs-body-color)",
              ["--bs-list-group-action-hover-bg" as any]:
                window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches
                  ? "rgba(255,255,255,.06)"
                  : "rgba(0,0,0,.03)",
              ["--bs-list-group-action-hover-color" as any]:
                "var(--bs-body-color)",
              ["--bs-list-group-active-bg" as any]: "var(--bs-primary)",
              ["--bs-list-group-active-color" as any]: "#fff",
            }}
          >
            {filtered.length === 0 ? (
              <div
                className="list-group-item text-muted"
                style={{ background: "var(--bs-list-group-bg)" }}
              >
                {list.length === 0 ? "No users" : "No users found"}
              </div>
            ) : (
              filtered.map((u) => (
                <Link
                  key={u._id}
                  to={u._id === me.id ? "/profile" : `/users/${u._id}`}
                  className="list-group-item list-group-item-action d-flex align-items-center"
                  onClick={onClose}
                >
                  <img
                    src={imgSrc(u.photoUrl)}
                    alt=""
                    className="rounded-circle me-2"
                    style={{ width: 32, height: 32, objectFit: "cover" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).onerror = null;
                      (e.currentTarget as HTMLImageElement).src =
                        "/default-avatar.png";
                    }}
                  />
                  {u.username}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  /** --------------- Auth gate --------------- */
  if (!token) {
    return (
      <div className="container">
        <div className="mx-auto" style={{ maxWidth: 820 }}>
          <p>&nbsp;</p>
          <div className="card border-0 shadow-sm mt-3">
            <div className="card-body text-center py-5">
              <h5 className="mb-2">Sign in to view profile</h5>
              <p className="text-muted mb-0">
                You need to be logged in to view and edit your profile.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tooLong = editDesc.trim().length > MAX_DESC_LEN;
  const canSaveDesc = useMemo(() => !tooLong, [tooLong]);

  return (
    <div className="container" style={{ paddingTop: "56px" }}>
      <style>{styles}</style>

      {/* PROFILE HEADER */}
      <div className="profile-card">
        <div className="d-flex align-items-center" style={{ gap: 20 }}>
          {/* Avatar + camera button */}
          <div className="avatar-wrap">
            <img
              src={imgSrc(photoUrl)}
              alt="avatar"
              className="avatar-img"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).onerror = null;
                (e.currentTarget as HTMLImageElement).src =
                  "/default-avatar.png";
              }}
            />
            <button
              type="button"
              className="avatar-camera"
              title="Change profile photo"
              aria-label="Change profile photo"
              onClick={handleAvatarPick}
            >
              📷
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="visually-hidden"
              onChange={handleAvatar}
            />
          </div>

          {/* Name + counts + desc editor */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="d-flex align-items-center justify-content-between flex-wrap">
              <h2 className="mb-0 wrap-text">
                <div className="text-decoration-none"> {me.username}</div>
              </h2>
            </div>

            <div
              className="d-flex align-items-center flex-wrap mt-2"
              style={{ gap: 16 }}
            >
              <span className="stat">
                Posts <strong>{posts.length}</strong>
              </span>
              <button className="count-link" onClick={openFollowers}>
                Followers <strong>{me.followersCount ?? 0}</strong>
              </button>
              <button className="count-link" onClick={openFollowing}>
                Following <strong>{me.followingCount ?? 0}</strong>
              </button>
            </div>

            {/* Description */}
            <div className="mt-3">
              {!editingDesc ? (
                <>
                  {description ? (
                    <p className="mb-2 wrap-text">{description}</p>
                  ) : (
                    <p className="text-muted mb-2">No description yet.</p>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => {
                      setEditingDesc(true);
                      setEditDesc(description || "");
                    }}
                  >
                    Edit description
                  </button>
                </>
              ) : (
                <div>
                  <label htmlFor="desc" className="form-label">
                    Edit description
                  </label>
                  <textarea
                    id="desc"
                    className="form-control desc-editor"
                    value={editDesc}
                    onChange={onDescChange}
                    onKeyDown={onDescKeyDown}
                    maxLength={MAX_DESC_LEN}
                    rows={3}
                  />
                  <div className={`text-end small text-muted }`}>
                    {editDesc.length}/{MAX_DESC_LEN}
                  </div>

                  <div className="d-flex gap-2 mt-2">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!canSaveDesc}
                      onClick={saveDescription}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        setEditDesc(description || "");
                        setEditingDesc(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* POSTS */}
      <h3 className="mb-3">Your Posts</h3>
      {loading ? (
        <FeedLoading cards={3} />
      ) : posts.length === 0 ? (
        <EmptyFeed loggedIn={!!token} onCreate={() => navigate("/post")} />
      ) : (
        posts.map((post) => {
          const liked = post.likes.includes(me.id);
          const disliked = post.dislikes.includes(me.id);
          const profilePath = "/profile";
          return (
            <div key={post._id} className="card mb-4">
              {/* Header with edit/delete icons */}
              <div className="card-body d-flex justify-content-between align-items-start">
                <Link
                  to={profilePath}
                  onClick={refreshIfSame}
                  className="d-flex align-items-center text-decoration-none"
                >
                  <img
                    src={imgSrc(post.user.photoUrl)}
                    alt=""
                    className="rounded-circle me-2"
                    style={{ width: 32, height: 32, objectFit: "cover" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).onerror = null;
                      (e.currentTarget as HTMLImageElement).src =
                        "/default-avatar.png";
                    }}
                  />
                  <div>
                    <h5 className="mb-0 wrap-text">{post.user.username}</h5>
                    <small
                      className="text-muted"
                      title={new Date(post.createdAt).toLocaleString()}
                    >
                      {timeAgo(post.createdAt)}
                      {post.editedAt && <em className="ms-1">(edited)</em>}
                    </small>
                  </div>
                </Link>

                <div
                  className="d-flex align-items-center"
                  style={{ gap: "4px" }}
                >
                  <button
                    type="button"
                    className="icon-btn"
                    title="Edit post"
                    aria-label="Edit post"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/posts/${post._id}/edit`);
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Delete post"
                    aria-label="Delete post"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deletePost(post._id);
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="card-body text-start">
                <p className="mb-0 wrap-text">{post.description}</p>
              </div>

              {post.imageUrl && (
                <img src={imgSrc(post.imageUrl)} className="card-img-bottom" alt="" />
              )}

              {/* Reactions */}
              <div className="card-footer d-flex justify-content-between align-items-center">
                <div>
                  <button
                    type="button"
                    className={`reaction like ${liked ? "active" : ""}`}
                    onClick={() => reactPost(post._id, "like")}
                    aria-pressed={liked}
                    aria-label={liked ? "Unlike post" : "Like post"}
                    title={liked ? "Unlike" : "Like"}
                  >
                    <span aria-hidden>👍</span>
                    <span>{post.likes.length}</span>
                  </button>

                  <button
                    type="button"
                    className={`reaction dislike ${disliked ? "active" : ""}`}
                    onClick={() => reactPost(post._id, "dislike")}
                    aria-pressed={disliked}
                    aria-label={disliked ? "Remove dislike" : "Dislike post"}
                    title={disliked ? "Remove dislike" : "Dislike"}
                  >
                    <span aria-hidden>👎</span>
                    <span>{post.dislikes.length}</span>
                  </button>

                  <button
                    type="button"
                    className="reaction comment"
                    onClick={() => {
                      navigate(`/posts/${post._id}/comments?cv=${Date.now()}`, {
                        state: {
                          backgroundLocation: baseBg,
                          from:
                            location.pathname + location.search + location.hash,
                        },
                      });
                    }}
                    aria-label="View comments"
                    title="View comments"
                  >
                    <span aria-hidden>💬</span>
                    <span>
                      {(post.comments?.length ?? 0) +
                        (post.comments ?? []).reduce(
                          (sum, c) => sum + (c.replies?.length ?? 0),
                          0
                        )}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* overlays */}
      {showFollowers && (
        <ListOverlay
          title="Followers"
          list={followersList}
          onClose={() => setShowFollowers(false)}
        />
      )}
      {showFollowing && (
        <ListOverlay
          title="Following"
          list={followingList}
          onClose={() => setShowFollowing(false)}
        />
      )}
    </div>
  );
};

export default Profile;
