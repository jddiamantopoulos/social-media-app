// src/components/PostDetail.tsx
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { timeAgo } from "../utils/timeAgo";
import PostNotFound from "./PostNotFound";
import { fileUrl } from "../lib/files";

interface UserRef {
  _id: string;
  username: string;
  photoUrl: string;
}
interface Reply {
  _id: string;
  user: UserRef;
  replyTo: UserRef;
  text: string;
  createdAt: string;
  updatedAt?: string;
  editedAt?: string;
  likes?: string[];
  dislikes?: string[];
}
interface Comment {
  _id: string;
  user: UserRef;
  text: string;
  createdAt: string;
  updatedAt?: string;
  editedAt?: string;
  likes: string[];
  dislikes: string[];
  replies?: Reply[];
}
interface Post {
  _id: string;
  user: UserRef;
  description: string;
  imageUrl?: string;
  likes: string[];
  dislikes: string[];
  comments: Comment[];
  createdAt: string;
  editedAt?: string;
}

const SinglePostLoading: React.FC = () => {
  const styles = `
  .single-post-loading .sp-skel{
    position:relative; overflow:hidden;
    background: var(--bs-secondary-bg, #e9ecef); /* fallback */
    background: color-mix(in srgb, var(--bs-secondary-bg, #e9ecef) 85%, #fff 15%);
    border-radius: 8px;
  }
  .single-post-loading .sp-skel::after{
    content:""; position:absolute; inset:0; transform:translateX(-100%);
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);
    animation: sp-shimmer 1.2s infinite;
  }
  @keyframes sp-shimmer { 100% { transform: translateX(100%); } }

  .single-post-loading .sp-avatar{ width:40px; height:40px; border-radius:50%; }
  .single-post-loading .sp-line{ height:12px; border-radius:6px; }
  .single-post-loading .sp-line.tall{ height:14px; }
  .single-post-loading .sp-image{ height:220px; border-radius:0; }

  .single-post-loading .sp-pill{ height:16px; width:56px; border-radius:999px; }
  .single-post-loading .sp-pill.wide{ width:72px; }

  /* width helpers */
  .single-post-loading .w-35{ width:35%; }
  .single-post-loading .w-22{ width:22%; }
  .single-post-loading .w-96{ width:96%; }
  .single-post-loading .w-82{ width:82%; }
  .single-post-loading .w-66{ width:66%; }
  `;

  return (
    <div
      className="container single-post-loading"
      style={{ paddingTop: 56 }}
      aria-busy="true"
      aria-live="polite"
    >
      <style>{styles}</style>

      <div className="card mb-4 shadow-sm">
        {/* header skeleton */}
        <div className="card-body d-flex align-items-start">
          <div className="sp-skel sp-avatar me-2" />
          <div className="flex-grow-1">
            <div className="sp-skel sp-line tall w-35 mb-2" />
            <div className="sp-skel sp-line w-22" />
          </div>
        </div>

        {/* text skeleton */}
        <div className="card-body">
          <div className="sp-skel sp-line w-96 mb-2" />
          <div className="sp-skel sp-line w-82 mb-2" />
          <div className="sp-skel sp-line w-66" />
        </div>

        {/* image skeleton (if final post has no image, this still looks fine) */}
        <div className="sp-skel sp-image" />

        {/* footer actions skeleton */}
        <div className="card-footer d-flex" style={{ gap: 12 }}>
          <div className="sp-skel sp-pill" />
          <div className="sp-skel sp-pill" />
          <div className="sp-skel sp-pill wide" />
        </div>
      </div>
    </div>
  );
};

const PostDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const token = localStorage.getItem("token") || "";
  const me = JSON.parse(localStorage.getItem("user") || "{}") as {
    id?: string;
  };
  const navigate = useNavigate();

  const [post, setPost] = useState<Post | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [overlayPostId, setOverlayPostId] = useState<string | null>(null);

  const styles = `
  .icon-btn {
    background: none;
    border: 0;
    padding: 4px;
    margin: 0;
    line-height: 1;
    color: #6c757d;          /* muted */
    cursor: pointer;
    border-radius: .375rem;
  }
  .icon-btn:hover { color: #0d6efd; }           /* primary on hover */
  .icon-btn.danger:hover { color: #dc3545; }    /* red on hover */

  .icon-btn:focus {
    outline: 2px solid #0d6efd33;
    outline-offset: 2px;
  }

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
  .reaction.like.active { color: #0d6efd; }     /* liked = primary */
  .reaction.dislike.active { color: #dc3545; }  /* disliked = red  */

  .reaction.like:hover { color: #0d6efd; }
  .reaction.dislike:hover { color: #dc3545; }
  .reaction.comment:hover { color: #0d6efd; }

  .reaction:focus {
    outline: 2px solid #0d6efd33;
    outline-offset: 2px;
    border-radius: .375rem;
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

  const fetchPost = async () => {
    try {
      const { data } = await axios.get<Post>(`/api/posts/${id}`);
      setPost(data);
    } catch (e: any) {
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        setPost(null); // if it no longer exists
      }
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const reactPost = async (type: "like" | "dislike") => {
    if (!token) {
      navigate("/login");
      return;
    }
    await axios.post(`/api/posts/${id}/${type}`, null, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchPost();
  };

  const postComment = async (text: string) => {
    if (!token) return alert("Please log in to comment.");
    if (!text.trim()) return;
    await axios.post(
      `/api/posts/${id}/comments`,
      { text },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    fetchPost();
  };

  const deletePost = async (postId: string) => {
    if (!token) return alert("Please log in.");
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try {
      await axios.delete(`/api/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOverlayPostId(null); // close comments, if open
      setPost(null); // triggers "Post not found" render
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete post.");
    }
  };

  const totalCommentCount = (p: Post) =>
    (p.comments?.length ?? 0) +
    (p.comments ?? []).reduce((sum, c) => sum + (c.replies?.length ?? 0), 0);

  if (loading) return <SinglePostLoading />;
  if (!post) return <PostNotFound />;

  const isMe = post.user._id === me.id;
  const liked = me.id ? post.likes.includes(me.id) : false;
  const disliked = me.id ? post.dislikes.includes(me.id) : false;
  const profileLink = isMe ? "/profile" : `/users/${post.user._id}`;

  return (
    <div className="container" style={{ paddingTop: "56px" }}>
      <style>{styles}</style>

      <div className="card mb-4">
        {/* HEADER (one row) */}
        <div className="card-body d-flex justify-content-between align-items-start">
          <Link
            to={profileLink}
            className="d-flex align-items-center text-decoration-none"
          >
            <img
              src={fileUrl(post.user.photoUrl)}
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

          {isMe && (
            <div
              className="ms-auto d-flex align-items-center"
              style={{ gap: 6 }}
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
          )}
        </div>

        <div className="card-body text-start">
          <p className="card-text mb-0">{post.description}</p>
        </div>

        {post.imageUrl && (
          <img src={fileUrl(post.imageUrl)} className="card-img-bottom" alt="" />
        )}

        <div className="card-footer d-flex justify-content-between align-items-center">
          <div>
            <button
              type="button"
              className={`reaction like ${liked ? "active" : ""}`}
              onClick={() => reactPost("like")}
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
              onClick={() => reactPost("dislike")}
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
                    from: location.pathname + location.search + location.hash,
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
    </div>
  );
};

export default PostDetail;
