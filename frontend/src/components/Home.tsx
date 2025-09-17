// src/components/Home.tsx
import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import axios from "axios";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { timeAgo } from "../utils/timeAgo";
import { usePageState } from "../hooks/pageStateCache";

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

// Wilson lower bound for likes/dislikes
const wilsonLowerBound = (up: number, down: number, z = 1.281551565545) => {
  const n = up + down;
  if (n === 0) return 0;
  const phat = up / n;
  return (
    (phat +
      (z * z) / (2 * n) -
      z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n)) /
    (1 + (z * z) / n)
  );
};

// tiny 32-bit string hash
const hash32 = (s: string) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

// Mulberry32 PRNG
const mulberry32 = (a: number) => () => {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const Home: React.FC = () => {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();
  const location = useLocation();
  const me = JSON.parse(localStorage.getItem("user") || "{}") as {
    id?: string;
    username?: string;
  };

  const [posts, setPosts] = usePageState<Post[]>("posts", [] as Post[]);
  const [loading, setLoading] = useState(posts.length === 0);

  // Pagination state
  const [cursor, setCursor] = usePageState<string | null>("cursor", null);
  const [hasMore, setHasMore] = usePageState<boolean>("hasMore", true);
  const [isFetching, setIsFetching] = useState(false);
  const [seenIds, setSeenIds] = usePageState<string[]>("seenIds", []);
  const seen = useRef<Set<string>>(new Set(seenIds)); // hydrate from page-state

  // Optional overlay (kept from your file; currently not used by buttons below)
  const [overlayPostId, setOverlayPostId] = useState<string | null>(null);

  // Session-only seed; fixed for this mount (so ranking jitter is stable until refresh)
  const [seed] = usePageState<number>("seed", () =>
    Math.floor(Math.random() * 2 ** 32)
  );

  const [scrollY, setScrollY] = usePageState<number>("scrollY", 0);

  // Per-history-entry keys (so each visit to /home gets its own snapshot)
  const HOME_CACHE_KEY = React.useMemo(
    () => `home:cache:${location.key}`,
    [location.key]
  );
  const HOME_SCROLL_KEY = React.useMemo(
    () => `home:scrollY:${location.key}`,
    [location.key]
  );

  // Stable session seed for ranking (must be defined before using it)
  const seedRef = useRef<number | undefined>(undefined);
  if (seedRef.current === undefined) {
    seedRef.current = Math.floor(Math.random() * 2 ** 32);
  }

  // Helper to bump ?nv= without adding a history entry
  const bumpHomeNv = React.useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("nv", String(Date.now()));
    navigate(url.pathname + url.search, { replace: true });
  }, [navigate]);

  // On real reload (or direct open), bump ?nv=.
  // On back/forward restore (bfcache), DO NOTHING (keeps saved state).
  React.useEffect(() => {
    if (!location.pathname.startsWith("/home")) return;

    const hasNv = new URLSearchParams(location.search).has("nv");
    const entry = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const isReload =
      entry?.type === "reload" || (performance as any).navigation?.type === 1;

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) return; // back/forward: keep state, don't bump
      if (!hasNv) {
        // direct open of /home
        bumpHomeNv();
        return;
      }
      if (isReload) {
        // manual reload of /home
        bumpHomeNv();
      }
    };

    window.addEventListener("pageshow", onPageShow, { once: true });
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [location.pathname, location.search, bumpHomeNv]);

  useLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(HOME_CACHE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        posts?: Post[];
        cursor?: string | null;
        hasMore?: boolean;
        seed?: number;
        seen?: string[];
        windowY?: number;
      };

      const restoredPosts = d.posts ?? [];
      if (restoredPosts.length > 0) {
        setPosts(restoredPosts);
        setCursor(d.cursor ?? null);
        setHasMore(Boolean(d.hasMore));
        if (typeof d.seed === "number") seedRef.current = d.seed;
        seen.current = new Set(d.seen ?? []);
        setLoading(false); // IMPORTANT: skip the initial refetch

        const yRaw = sessionStorage.getItem(HOME_SCROLL_KEY);
        const y = Number.isFinite(Number(yRaw)) ? Number(yRaw) : d.windowY ?? 0;
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, left: 0, behavior: "auto" });
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        HOME_CACHE_KEY,
        JSON.stringify({
          posts,
          cursor,
          hasMore,
          seed: seedRef.current,
          seen: Array.from(seen.current),
          windowY: window.scrollY,
        })
      );
    } catch {
      // ignore
    }
  }, [posts, cursor, hasMore]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(HOME_SCROLL_KEY, String(window.scrollY));
        } catch {}
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    // restore
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
    });
    // keep updated (rAF-throttled)
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [setScrollY]); // intentionally not depending on scrollY

  useEffect(() => {
    if (!loading) return;
    fetchPosts(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ————— minimal, icon-only UI helpers —————
  const styles = `
  .icon-btn {
    background: none; border: 0; padding: 4px; margin: 0; line-height: 1;
    color: #6c757d; cursor: pointer; border-radius: .375rem;
  }
  .icon-btn:hover { color: #0d6efd; }
  .icon-btn.danger:hover { color: #dc3545; }
  .icon-btn:focus { outline: 2px solid #0d6efd33; outline-offset: 2px; }

  .reaction {
    background: none; border: 0; padding: 0; margin-right: 12px; color: #6c757d;
    cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
  }
  .reaction.like.active { color: #0d6efd; }
  .reaction.dislike.active { color: #dc3545; }
  .reaction.like:hover { color: #0d6efd; }
  .reaction.dislike:hover { color: #dc3545; }
  .reaction.comment:hover { color: #0d6efd; }
  .reaction:focus { outline: 2px solid #0d6efd33; outline-offset: 2px; border-radius: .375rem; }
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

  /** Rank a list once (per page) with your scoring; returns IDs in display order */
  function rankOnce(
    list: Post[],
    opts: { seed: number; myId: string; loggedIn: boolean }
  ) {
    const { seed, myId, loggedIn } = opts;
    const now = Date.now();
    const HALFLIFE_H = 36;
    const ENG_W = 0.9;
    const CMT_W = 0.3;
    const SELF_PENALTY = loggedIn ? 0.55 : 1.0;
    const INTERACTED_PENALTY = loggedIn ? 0.6 : 1.0;

    // Gumbel noise for a nice "lottery" effect per session, strength tuned small
    const gumbelFrom = (u: number) => -Math.log(-Math.log(Math.max(1e-9, u)));
    const JITTER_STRENGTH = 0.25; // try 0.15–0.35

    const rows = list.map((p) => {
      const up = p.likes?.length ?? 0;
      const down = p.dislikes?.length ?? 0;
      const wl = wilsonLowerBound(up, down);

      const topLevel = p.comments?.length ?? 0;
      const replyCount = (p.comments ?? []).reduce(
        (s, c) => s + (c.replies?.length ?? 0),
        0
      );
      const engagement = ENG_W * wl + CMT_W * Math.log1p(topLevel + replyCount);

      const ageH = (now - new Date(p.createdAt).getTime()) / 36e5;
      const decay = Math.pow(0.5, ageH / HALFLIFE_H);

      let score = (1 + engagement) * decay;

      if (loggedIn) {
        if (p.user._id === myId) score *= SELF_PENALTY;

        const interacted =
          p.likes?.includes(myId) ||
          p.dislikes?.includes(myId) ||
          (p.comments ?? []).some(
            (c) =>
              c.user._id === myId ||
              c.likes?.includes(myId) ||
              c.dislikes?.includes(myId) ||
              (c.replies ?? []).some(
                (r) =>
                  r.user._id === myId ||
                  r.likes?.includes(myId) ||
                  r.dislikes?.includes(myId)
              )
          );

        if (interacted) score *= INTERACTED_PENALTY;
      }

      const rng = mulberry32((seed ^ hash32(p._id)) >>> 0)();
      score += JITTER_STRENGTH * gumbelFrom(rng);

      return { p, score };
    });

    rows.sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.p.createdAt).getTime() - new Date(a.p.createdAt).getTime()
    );

    return rows.map((r) => r.p._id);
  }

  /** Fetch a page; append (don’t reshuffle existing), de-dup, and advance cursor */
  const fetchPosts = async (after: string | null = null) => {
    if (isFetching || (!after && !hasMore && posts.length)) return;
    setIsFetching(true);
    try {
      const res = await axios.get("/api/posts", {
        params: {
          limit: 20,
          after: after ?? undefined /* seed: seedRef.current */,
        },
      });

      // Accept either new shape {items, nextCursor} or old shape array
      const items: Post[] = Array.isArray(res.data)
        ? res.data
        : res.data.items ?? [];
      const nextCursor: string | null = Array.isArray(res.data)
        ? null
        : res.data.nextCursor ?? null;

      // De-dup safety
      const fresh = items.filter((p) => {
        if (seen.current.has(p._id)) return false;
        seen.current.add(p._id);
        return true;
      });

      if (fresh.length) setSeenIds(Array.from(seen.current));

      // Rank only the newly fetched page (keeps already-rendered items stable)
      let toAppend = fresh;
      if (fresh.length > 1) {
        const ids = rankOnce(fresh, {
          seed,
          myId: me.id || "",
          loggedIn: !!token,
        });
        const map = new Map(fresh.map((p) => [p._id, p]));
        toAppend = ids.map((id) => map.get(id)!).filter(Boolean);
      }

      setPosts((prev: Post[]) => [...prev, ...toAppend]);
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));
    } catch (err) {
      console.error("Fetch posts error:", err);
    } finally {
      setIsFetching(false);
      setLoading(false);
    }
  };

  // Infinite scroll sentinel
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        const [e] = entries;
        if (e.isIntersecting && hasMore && !isFetching) {
          fetchPosts(cursor);
        }
      },
      { root: null, rootMargin: "800px 0px", threshold: 0 }
    );
    io.observe(loadMoreRef.current);
    return () => io.disconnect();
  }, [cursor, hasMore, isFetching]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reactions
  const reactPost = async (postId: string, type: "like" | "dislike") => {
    if (!token) return navigate("/login");

    setPosts((prev: Post[]) =>
      prev.map((p) => {
        if (p._id !== postId) return p;
        const myId = me.id!;
        const likes = new Set(p.likes ?? []);
        const dislikes = new Set(p.dislikes ?? []);
        if (type === "like") {
          if (likes.has(myId)) likes.delete(myId);
          else {
            likes.add(myId);
            dislikes.delete(myId);
          }
        } else {
          if (dislikes.has(myId)) dislikes.delete(myId);
          else {
            dislikes.add(myId);
            likes.delete(myId);
          }
        }
        return {
          ...p,
          likes: Array.from(likes),
          dislikes: Array.from(dislikes),
        };
      })
    );

    try {
      await axios.post(
        `/api/posts/${postId}/${type}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error("React error:", err);
      // optional: refetch to revert server truth
      // await fetchPosts(null);
    }
  };

  const deletePost = async (postId: string) => {
    if (!token) return alert("Please log in.");
    if (!window.confirm("Delete this post? This cannot be undone.")) return;

    // optimistic remove + de-dup cleanup
    setPosts((prev: Post[]) => prev.filter((p) => p._id !== postId));
    seen.current.delete(postId);
    setSeenIds(Array.from(seen.current));

    try {
      await axios.delete(`/api/posts/${postId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete post.");
      // optional: refetch current pages
    }
  };

  const totalCommentCount = (post: Post) => {
    const base = post.comments?.length ?? 0;
    const replies = (post.comments ?? []).reduce(
      (sum, c) => sum + (c.replies?.length ?? 0),
      0
    );
    return base + replies;
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
  
  const ABS_API = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const imgSrc = (u?: string) =>
    !u ? "" : /^https?:\/\//i.test(u) ? u : `${ABS_API}${u.startsWith("/") ? u : `/${u}`}`;

  return (
    <div className="container" style={{ paddingTop: "56px" }}>
      <style>{styles}</style>

      {token ? (
        <div className="text-center mb-4">
          <h1>Welcome, {me.username}!</h1>
          <p>You are now logged in.</p>
        </div>
      ) : (
        <div className="text-center mb-4">
          <h1>Please log in or sign up for more features.</h1>
        </div>
      )}

      <hr />

      <h2>Posts</h2>

      {loading ? (
        <FeedLoading cards={3} />
      ) : posts.length === 0 ? (
        <EmptyFeed loggedIn={!!token} onCreate={() => navigate("/post")} />
      ) : (
        posts.map((post: Post) => {
          const isMe = post.user._id === me.id;
          const liked = Boolean(me.id && post.likes.includes(me.id!));
          const disliked = Boolean(me.id && post.dislikes.includes(me.id!));
          const profileLink = isMe ? "/profile" : `/users/${post.user._id}`;

          return (
            <div key={post._id} className="card mb-4">
              {/* Header: author + time + (edit/delete if owner) */}
              <div className="card-body d-flex justify-content-between align-items-start">
                <Link
                  to={profileLink}
                  state={{ backgroundLocation: location }}
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
                    <h5 className="mb-0">{post.user.username}</h5>
                    <small
                      className="text-muted"
                      title={new Date(post.createdAt).toLocaleString()}
                    >
                      {timeAgo(post.createdAt)}
                      {post.editedAt &&
                        new Date(post.editedAt).getTime() >
                          new Date(post.createdAt).getTime() && (
                          <em className="ms-1">(edited)</em>
                        )}
                    </small>
                  </div>
                </Link>

                {isMe && (
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
                )}
              </div>

              {/* Body: text + image */}
              <div className="card-body text-start">
                <p className="card-text mb-0">{post.description}</p>
              </div>

              {post.imageUrl && (
                <img
                  src={imgSrc(post.imageUrl)}
                  className="card-img-bottom"
                  alt=""
                  loading="lazy"
                />
              )}

              {/* Footer: reactions (icon + count, no filled buttons) */}
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
                        state: { backgroundLocation: location },
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

      {/* Infinite scroll sentinel */}
      {!loading && posts.length > 0 && (
        <div ref={loadMoreRef} style={{ height: 1 }} aria-hidden />
      )}
    </div>
  );
};

export default Home;
