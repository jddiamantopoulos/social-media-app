// src/components/UserProfile.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { timeAgo } from "../utils/timeAgo";
import UserNotFound from "./UserNotFound";

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
interface User {
  _id: string;
  username: string;
  photoUrl: string;
  description?: string;
  followersCount?: number;
  followingCount?: number;
}

const UserProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const isLoggedIn = Boolean(token);
  const me = JSON.parse(localStorage.getItem("user") || "{}") as {
    id?: string;
  };

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [overlayPostId, setOverlayPostId] = useState<string | null>(null);

  // follow state + lists
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [followersList, setFollowersList] = useState<SimpleUser[]>([]);
  const [followingList, setFollowingList] = useState<SimpleUser[]>([]);

  const location = useLocation();
  const baseBg = (location.state as any)?.backgroundLocation || location;
  const refreshIfSame =
    (path: string): React.MouseEventHandler<HTMLAnchorElement> =>
    (e) => {
      if (location.pathname === path) {
        e.preventDefault(); // don't push the same route again
        navigate(0); // React Router v6 hard refresh
      }
    };

  // visual styles to match Profile
  const styles = `
  .hero-card {
    max-width: 820px;
    margin: 24px auto 16px;
    border: 1px solid var(--bs-border-color);
    border-radius: 12px;
    background: var(--bs-card-bg);
    box-shadow: var(--elev-card);
  }
  .hero-inner {
    padding: 20px 24px;
    text-align: center;
  }
  .avatar-xl {
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: 50%;
    /* no solid border; ring + glow via shadows */
    box-shadow:
      0 0 0 3px var(--bs-card-bg),          /* ring same as card background */
      0 10px 22px -6px var(--ring-underlay),/* soft halo */
      0 12px 28px rgba(0,0,0,.35);          /* drop shadow */
  }
  .desc {
    max-width: 680px;
    margin: 8px auto 0;
    color: var(--bs-secondary-color);
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  /* stats row */
  .stats {
    display: flex;
    justify-content: center;
    gap: 16px;
    flex-wrap: wrap;
    margin: 12px 0 0;
  }
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

  .link-quiet {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    color: var(--bs-link-color);
    cursor: pointer;
    text-decoration: none !important;
  }
  .link-quiet:hover { text-decoration: underline; }

  /* reaction buttons (emoji only) */
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
  .reaction.dislike.active { color: #dc3545; }
  .reaction.like:hover { color: #0d6efd; }
  .reaction.dislike:hover { color: #dc3545; }
  .reaction.comment:hover { color: #0d6efd; }
  .reaction:focus { outline: 2px solid #0d6efd33; outline-offset: 2px; border-radius: .375rem; }

  /* post body text should wrap nicely */
  .post-text {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
    margin-bottom: 0;
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

  // fetch profile info
  useEffect(() => {
    setLoadingUser(true);
    axios
      .get<User>(`/api/users/${id}`)
      .then((res) => setProfileUser(res.data))
      .catch(console.error)
      .finally(() => setLoadingUser(false));
  }, [id]);

  // fetch posts
  useEffect(() => {
    setLoadingPosts(true);
    axios
      .get<Post[]>(`/api/users/${id}/posts`)
      .then((res) => setPosts(res.data))
      .catch(console.error)
      .finally(() => setLoadingPosts(false));
  }, [id]);

  // compute following
  useEffect(() => {
    (async () => {
      if (!isLoggedIn || !id || !me.id) {
        setIsFollowing(false);
        return;
      }
      try {
        const { data } = await axios.get<SimpleUser[]>(
          `/api/users/${id}/followers`
        );
        setIsFollowing(!!data.find((u) => u._id === me.id));
      } catch {
        setIsFollowing(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isLoggedIn]);

  const reactPost = async (postId: string, type: "like" | "dislike") => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    await axios.post(`/api/posts/${postId}/${type}`, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await axios.get<Post[]>(`/api/users/${id}/posts`);
    setPosts(res.data);
  };

  const postComment = async (postId: string, text: string) => {
    if (!isLoggedIn) return alert("Please log in to comment.");
    if (!text.trim()) return;
    await axios.post(
      `/api/posts/${postId}/comments`,
      { text },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const res = await axios.get<Post[]>(`/api/users/${id}/posts`);
    setPosts(res.data);
  };

  const toggleFollow = async () => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    try {
      const { data } = await axios.post(
        `/api/users/${id}/follow`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsFollowing(data.following);
      setProfileUser((prev) =>
        prev ? { ...prev, followersCount: data.followersCount } : prev
      );
    } catch (err) {
      console.error("Follow toggle failed", err);
    }
  };

  const openFollowers = async () => {
    const { data } = await axios.get<SimpleUser[]>(
      `/api/users/${id}/followers`
    );
    setFollowersList(data);
    setShowFollowers(true);
  };
  const openFollowing = async () => {
    const { data } = await axios.get<SimpleUser[]>(
      `/api/users/${id}/following`
    );
    setFollowingList(data);
    setShowFollowing(true);
  };

  const totalCommentCount = (post: Post) => {
    const base = post.comments?.length ?? 0;
    const replies = (post.comments ?? []).reduce(
      (sum, c) => sum + (c.replies?.length ?? 0),
      0
    );
    return base + replies;
  };

  const startConversation = async () => {
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    if (!profileUser?._id) {
      alert("User not loaded yet. Please try again.");
      return;
    }
    try {
      const { data } = await axios.post(
        "/api/messages/start",
        { userId: profileUser._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!data?.conversationId) throw new Error("No conversation id returned");
      // after you get { conversationId } back
      navigate(`/messages/${data.conversationId}`, {
        state: {
          otherUser: {
            _id: profileUser!._id,
            username: profileUser!.username,
            photoUrl: profileUser!.photoUrl,
          },
        },
      });
    } catch (err) {
      console.error("start conversation error:", err);
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : "Could not start conversation.";
      alert(msg);
    }
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
      <p className="text-muted mb-3">
        Your feed will fill up as people start posting.
      </p>
    </div>
  );

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
                    src={u.photoUrl}
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

  // Drop-in TSX skeleton (looks like a real profile while loading)
  function ProfileLoadingSkeleton() {
    return (
      <div className="container">
        <div className="mx-auto" style={{ maxWidth: 760 }}>
          <p>&nbsp;</p>
          <div className="card border-0 shadow-sm mt-4">
            <div className="card-body">
              {/* Header: avatar + name/handle */}
              <div className="d-flex align-items-center placeholder-wave mb-3">
                <div
                  className="rounded-circle placeholder me-3"
                  style={{ width: 72, height: 72 }}
                />
                <div className="flex-grow-1">
                  <div className="placeholder col-5 mb-2" />
                  <div className="placeholder col-8" />
                </div>
                <div className="ms-3 text-end" style={{ width: 120 }}>
                  <div className="placeholder col-8 mb-2" />
                  <div className="placeholder col-6" />
                </div>
              </div>

              <hr className="my-3" />

              {/* Stats row */}
              <div className="row text-center placeholder-wave g-3 mb-2">
                <div className="col">
                  <div className="placeholder col-6 mx-auto mb-2" />
                  <div className="placeholder col-8 mx-auto" />
                </div>
                <div className="col">
                  <div className="placeholder col-6 mx-auto mb-2" />
                  <div className="placeholder col-8 mx-auto" />
                </div>
                <div className="col">
                  <div className="placeholder col-6 mx-auto mb-2" />
                  <div className="placeholder col-8 mx-auto" />
                </div>
              </div>

              <hr className="my-3" />

              {/* Bio/description skeleton */}
              <div className="placeholder-wave">
                <div className="placeholder col-12 mb-2" />
                <div className="placeholder col-10 mb-2" />
                <div className="placeholder col-8" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadingUser) return <ProfileLoadingSkeleton />;

  if (!profileUser) return <UserNotFound />;

  const authorIsMe = profileUser._id === (me.id || "");

  return (
    <div className="container" style={{ paddingTop: "56px" }}>
      <style>{styles}</style>

      {/* HERO */}
      <div className="hero-card card">
        <div className="hero-inner">
          <img
            src={profileUser.photoUrl}
            alt="avatar"
            className="avatar-xl mb-2"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).onerror = null;
              (e.currentTarget as HTMLImageElement).src = "/default-avatar.png";
            }}
          />
          <h2 className="mb-1">
            <div>{profileUser.username}</div>
          </h2>
          {profileUser.description && (
            <p className="desc">{profileUser.description}</p>
          )}

          <div className="stats">
            <span className="stat">
              Posts <strong>{posts.length}</strong>
            </span>

            <button className="stat link-quiet" onClick={openFollowers}>
              Followers <strong>{profileUser.followersCount ?? 0}</strong>
            </button>

            <button className="stat link-quiet" onClick={openFollowing}>
              Following <strong>{profileUser.followingCount ?? 0}</strong>
            </button>

            {!authorIsMe && (
              <div className="d-flex" style={{ gap: 8 }}>
                <button
                  className={`btn btn-sm ${
                    isFollowing ? "btn-secondary" : "btn-primary"
                  }`}
                  onClick={toggleFollow}
                >
                  {isFollowing ? "Unfollow" : "Follow"}
                </button>

                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={startConversation}
                >
                  Message
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* POSTS */}
      <h3 className="mb-3">Posts by {profileUser.username}</h3>

      {loadingPosts ? (
        <FeedLoading cards={3} />
      ) : posts.length === 0 ? (
        <EmptyFeed loggedIn={!!token} onCreate={() => navigate("/post")} />
      ) : (
        posts.map((post) => {
          const liked = post.likes.includes(me.id || "");
          const disliked = post.dislikes.includes(me.id || "");
          const profileLink =
            post.user._id === (me.id || "")
              ? "/profile"
              : `/users/${post.user._id}`;

          return (
            <div key={post._id} className="card mb-4">
              {/* header */}
              <div className="card-body d-flex align-items-start">
                <Link
                  to={profileLink}
                  onClick={refreshIfSame(profileLink)}
                  className="d-flex align-items-center text-decoration-none"
                >
                  <img
                    src={post.user.photoUrl}
                    alt="avatar"
                    className="rounded-circle me-2"
                    style={{ width: 32, height: 32, objectFit: "cover" }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).onerror = null;
                      (e.currentTarget as HTMLImageElement).src =
                        "/default-avatar.png";
                    }}
                  />
                  <div>
                    <h5 className="mb-0">{post.user.username}</h5>
                    <small
                      className="text-muted"
                      title={new Date(post.createdAt).toLocaleString()}
                    >
                      {timeAgo(post.createdAt)}
                      {post.editedAt && <em className="ms-1">(edited)</em>}
                    </small>
                  </div>
                </Link>
              </div>

              {/* text */}
              <div className="card-body text-start">
                <p className="post-text">{post.description}</p>
              </div>

              {/* image */}
              {post.imageUrl && (
                <img
                  src={post.imageUrl}
                  className="card-img-bottom"
                  alt="Post"
                />
              )}

              {/* reactions */}
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
                    <span>{totalCommentCount(post)}</span>
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

export default UserProfile;
