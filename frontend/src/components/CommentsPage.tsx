// src/components/CommentsPage.tsx
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import axios from "axios";
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

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const stripLeadingMention = (text: string, username?: string) => {
  if (!username) return text;
  const re = new RegExp(`^@${escapeRegExp(username)}\\s*`);
  return text.replace(re, "");
};

type ComposerMode =
  | { mode: "comment" }
  | {
      mode: "reply";
      commentId: string;
      target: { _id: string; username: string };
    }
  | { mode: "edit-comment"; commentId: string }
  | { mode: "edit-reply"; commentId: string; replyId: string };

// Detect how we arrived on this page
const getNavType = (): "reload" | "back_forward" | "navigate" => {
  const e = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (e?.type) return e.type as any;

  // Older fallback
  const pn = (performance as any).navigation;
  if (pn?.type === 1) return "reload";
  if (pn?.type === 2) return "back_forward";
  return "navigate";
};

const CommentsPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const visitId = location.key;

  // Namespaced keys for this post + visit
  const keyOf = (name: string) => `co:${postId}:${name}:v=${visitId}`;

  // --- cache-version (cv) that resets on refresh ---
  const search0 = new URLSearchParams(location.search);
  let cv = search0.get("cv") || "";

  // On a hard reload, force a fresh cv and update the visible URL in-place
  if (!cv || getNavType() === "reload") {
    cv = String(Date.now());
    const url = new URL(window.location.href);
    url.searchParams.set("cv", cv);
    // keep existing history.state so back/forward works the same
    window.history.replaceState(
      { ...(window.history.state || {}) },
      "",
      url.toString()
    );
  }

  const tag = cv ? `:${cv}` : "";

  // Use these keys everywhere you persist to session/page state:
  const EXP_KEY = keyOf("expanded");
  const Y_KEY = keyOf("y");

  const token = localStorage.getItem("token") || "";
  const isLoggedIn = !!token;

  const me = JSON.parse(localStorage.getItem("user") || "{}") as {
    id?: string;
    username?: string;
    photoUrl?: string;
  };
  const myId = me.id || "";

  const openProfileFresh = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    // Push a new history entry even if path is identical
    navigate(path, { state: { __fresh: Date.now() } });
  };

  const [items, setItems] = usePageState<Comment[]>(keyOf("items"), []);
  const [initialLoaded, setInitialLoaded] = usePageState<boolean>(
    keyOf("initialLoaded"),
    false
  );
  const [postOwnerId, setPostOwnerId] = usePageState<string | null>(
    keyOf("postOwnerId"),
    null
  );

  // Freeze the order for the lifetime of this overlay open
  const [frozenOrder, setFrozenOrder] = usePageState<string[] | null>(
    keyOf("frozenOrder"),
    null
  );

  // Single bottom composer (null = closed / floating Comment button visible)
  const [composer, setComposer] = usePageState<ComposerMode | null>(
    keyOf("composer"),
    null
  );
  const [textBody, setTextBody] = usePageState<string>(keyOf("textBody"), "");
  const inputRef = useRef<HTMLInputElement>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const skipPollingUntilRef = useRef<number>(0);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const restoredOnceRef = useRef(false);
  const userScrolledRef = useRef(false);

  useLayoutEffect(() => {
    // New post: read stored expanded IDs (if any)
    try {
      const raw = sessionStorage.getItem(EXP_KEY);
      if (raw) {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) setExpanded(new Set(ids));
      }
    } catch {}
    // Reset flags for scroll restore
    restoredOnceRef.current = false;
    userScrolledRef.current = false;
  }, [postId]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      userScrolledRef.current = true;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(Y_KEY, String(el.scrollTop));
        } catch {}
        raf = 0;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [postId]);

  useEffect(() => {
    if (!initialLoaded || restoredOnceRef.current) return;
    const el = listRef.current;
    if (!el) return;

    const raw = sessionStorage.getItem(Y_KEY);
    const saved = raw != null ? Number(raw) : NaN;
    if (!Number.isFinite(saved)) {
      restoredOnceRef.current = true;
      return;
    }

    const apply = () => {
      el.scrollTop = saved;
    };

    // Apply once after paint
    requestAnimationFrame(apply);

    // Re-apply while images/layout settle, but stop if user scrolls
    const ro = new ResizeObserver(() => {
      if (userScrolledRef.current) return;
      requestAnimationFrame(apply);
    });
    ro.observe(el);

    const imgs = Array.from(el.querySelectorAll("img")) as HTMLImageElement[];
    const kick = () => {
      if (!userScrolledRef.current) requestAnimationFrame(apply);
    };
    imgs.forEach((im) => {
      if (!im.complete) {
        im.addEventListener("load", kick, { once: true });
        im.addEventListener("error", kick, { once: true });
      }
    });

    restoredOnceRef.current = true;

    return () => {
      ro.disconnect();
      imgs.forEach((im) => {
        im.removeEventListener("load", kick);
        im.removeEventListener("error", kick);
      });
    };
  }, [initialLoaded, postId]);

  const isExpanded = (id: string) => expanded.has(id);
  const toggleReplies = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        sessionStorage.setItem(EXP_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  const ensureExpanded = (id: string) =>
    setExpanded((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      try {
        sessionStorage.setItem(EXP_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

  const state = location.state as
    | { backgroundLocation?: Location; from?: string }
    | undefined;
  const prevPathname = state?.backgroundLocation?.pathname ?? state?.from ?? "";
  const cameFromAllowed =
    prevPathname === "/home" ||
    prevPathname === "/profile" ||
    /^\/users\/[^/]+$/.test(prevPathname);

  const goToPost = () => {
    if (postId) navigate(`/posts/${postId}`);
    else navigate("/home");
  };

  // responsive layout helpers + icon styles
  const styles = `
  .co-headrow, .co-r-headrow {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: .75rem;
    flex-wrap: wrap;
  }
  .co-left, .co-r-left {
    min-width: 0;
    flex: 1 1 20rem;
  }
  .co-actions, .co-r-actions {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: .5rem;
    white-space: nowrap;
  }
  @media (max-width: 576px) {
    .co-actions, .co-r-actions {
      width: 100%;
      justify-content: flex-start;
      margin-left: 0;
      margin-top: .25rem;
      white-space: normal;
      row-gap: .25rem;
      column-gap: .5rem;
      flex-wrap: wrap;
    }
  }

  .co-overlay { top: 70px; }           /* default = mobile/tablet */
  @media (min-width: 992px) {           /* desktop (Bootstrap lg) */
    .co-overlay { top: 66px; }
  }

  /* CommentsPage scrollbars */
  .co-scroll::-webkit-scrollbar{
    width: 10px; height: 10px;
  }
  .co-scroll::-webkit-scrollbar-thumb{
    background: var(--scrollbar-thumb);
    border-radius: 8px;
    border: 2px solid transparent; /* nicer shape */
    background-clip: padding-box;
  }
  .co-scroll::-webkit-scrollbar-thumb:hover{
    background: var(--scrollbar-thumb-hover);
  }
  .co-scroll::-webkit-scrollbar-track{
    background: var(--scrollbar-track);
    border-radius: 8px;
  }
  /* in your styles string */
  .co-scroll { scroll-behavior: auto; }

  /* Icon-only action buttons (reply/edit/delete) */
  .icon-btn {
    background: none;
    border: 0;
    padding: .25rem;
    margin: 0;
    line-height: 1;
    color: #6c757d;
    cursor: pointer;
    border-radius: .375rem;
  }
  .icon-btn:hover { color: #0d6efd; }
  .icon-btn:focus { outline: 2px solid #0d6efd33; outline-offset: 2px; }
  .icon-sm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
  }

  /* Like/Dislike: icon + count, no boxes */
  .react-btn {
    background: none;
    border: 0;
    padding: .125rem .25rem;
    margin: 0;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    gap: .25rem;
    color: #6c757d;
    cursor: pointer;
    border-radius: .375rem;
  }
  .reply-toggle {
    background: none;
    border: 0;
    padding: 0;            /* no boxy chrome */
    margin: 0;
    color: #6c757d;        /* muted like other icons */
    cursor: pointer;
    border-radius: .375rem;
  }
  .reply-toggle:hover { color: #0d6efd; }  /* subtle hover */
  .reply-toggle:focus { outline: 2px solid #0d6efd33; outline-offset: 2px; }

  .react-btn:focus { outline: 2px solid #0d6efd33; outline-offset: 2px; }
  .react-btn.like:hover { color: #0d6efd; }
  .react-btn.dislike:hover { color: #dc3545; }
  .react-btn.like.active { color: #0d6efd; }
  .react-btn.dislike.active { color: #dc3545; }
  `;

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
  };
  const contentStyle: React.CSSProperties = { flex: 1, minWidth: 0 };
  const textWrapStyle: React.CSSProperties = {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  };

  // ----- server helpers -----
  const mapServerComments = (list: any[]): Comment[] =>
    (list || []).map((c: any) => ({
      _id: c._id,
      user: c.user,
      text: c.text,
      createdAt: c.createdAt,
      editedAt: c.editedAt,
      likes: (c.likes ?? []).map(String),
      dislikes: (c.dislikes ?? []).map(String),
      replies: (c.replies ?? []).map((r: any) => ({
        _id: r._id,
        user: r.user,
        replyTo: r.replyTo,
        text: r.text,
        createdAt: r.createdAt,
        editedAt: r.editedAt,
        likes: (r.likes ?? []).map(String),
        dislikes: (r.dislikes ?? []).map(String),
      })),
    }));

  const refreshFromServer = async () => {
    if (!postId) return [] as Comment[];
    const { data } = await axios.get(`/api/posts/${postId}`);
    const next = mapServerComments(data?.comments || []);
    setItems(next);
    setPostOwnerId(data?.user?._id || null);
    return next;
  };

  // Build an order once: my comments first, each group newest -> oldest
  const buildFrozenOrder = (arr: Comment[]) => {
    // simple engagement-first rule for non-my comments
    const net = (c: Comment) =>
      (c.likes?.length ?? 0) - (c.dislikes?.length ?? 0);

    return [...arr]
      .sort((a, b) => {
        const aMine = a.user._id === myId;
        const bMine = b.user._id === myId;

        // 1) My comments always above others (keep your existing behavior)
        if (aMine && !bMine) return -1;
        if (!aMine && bMine) return 1;

        // 2) Within the same group (mine vs others),
        //    rank by engagement instead of pure recency
        const aNet = net(a);
        const bNet = net(b);
        if (bNet !== aNet) return bNet - aNet; // higher net likes first

        const aLikes = a.likes?.length ?? 0;
        const bLikes = b.likes?.length ?? 0;
        if (bLikes !== aLikes) return bLikes - aLikes; // more raw likes next

        const aReplies = a.replies?.length ?? 0;
        const bReplies = b.replies?.length ?? 0;
        if (bReplies !== aReplies) return bReplies - aReplies; // more replies next

        // final tie-breaker: newer first
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      })
      .map((c) => c._id);
  };

  // initial fetch (fallback to props on error)
  useEffect(() => {
    setFrozenOrder(null);

    let mounted = true;

    if (items.length > 0) {
      setInitialLoaded(true);
      setFrozenOrder(buildFrozenOrder(items));
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const next = await refreshFromServer();
        setFrozenOrder(buildFrozenOrder(next));
      } catch (err) {
        const code = axios.isAxiosError(err) ? err.response?.status : 0;
        if (code === 404 || code === 410) {
          navigate(`/posts/${postId}`, { replace: true });
          return;
        }
      } finally {
        if (mounted) setInitialLoaded(true);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // polling (pause while editing)
  const editingSomething =
    composer?.mode === "edit-comment" || composer?.mode === "edit-reply";
  useEffect(() => {
    if (editingSomething) return;
    const id = window.setInterval(() => {
      if (Date.now() < skipPollingUntilRef.current) return;
      refreshFromServer().catch(() => {});
    }, 5000);
    return () => window.clearInterval(id);
  }, [postId, editingSomething]); // eslint-disable-line react-hooks/exhaustive-deps

  // focus composer when it opens / mode changes
  useEffect(() => {
    if (composer) inputRef.current?.focus();
  }, [composer?.mode]);

  // lock background scroll
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  // ----- reactions (comments) -----
  const reactComment = async (commentId: string, type: "like" | "dislike") => {
    if (!token || !myId) {
      navigate("/login");
      return;
    }
    // optimistic flip
    setItems((prev) =>
      prev.map((c) => {
        if (c._id !== commentId) return c;
        const liked = c.likes.includes(myId);
        const disliked = c.dislikes.includes(myId);
        let likes = [...c.likes];
        let dislikes = [...c.dislikes];
        if (type === "like") {
          if (liked) likes = likes.filter((id) => id !== myId);
          else {
            likes.push(myId);
            if (disliked) dislikes = dislikes.filter((id) => id !== myId);
          }
        } else {
          if (disliked) dislikes = dislikes.filter((id) => id !== myId);
          else {
            dislikes.push(myId);
            if (liked) likes = likes.filter((id) => id !== myId);
          }
        }
        return { ...c, likes, dislikes };
      })
    );
    try {
      const res = await axios.post(
        `/api/posts/${postId}/comments/${commentId}/${type}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { likesIds, dislikesIds } = res.data || {};
      if (likesIds || dislikesIds) {
        setItems((prev) =>
          prev.map((c) =>
            c._id === commentId
              ? {
                  ...c,
                  likes: (likesIds ?? c.likes).map(String),
                  dislikes: (dislikesIds ?? c.dislikes).map(String),
                }
              : c
          )
        );
      }
    } catch {
      await refreshFromServer().catch(() => {});
    }
  };

  // ----- reactions (replies) -----
  const reactReply = async (
    commentId: string,
    replyId: string,
    type: "like" | "dislike"
  ) => {
    if (!token || !myId) navigate("/login");
    // optimistic flip
    setItems((prev) =>
      prev.map((c) => {
        if (c._id !== commentId) return c;
        const replies = (c.replies ?? []).map((r) => {
          if (r._id !== replyId) return r;
          const likes = [...(r.likes ?? [])];
          const dislikes = [...(r.dislikes ?? [])];
          const liked = likes.includes(myId);
          const disliked = dislikes.includes(myId);
          if (type === "like") {
            if (liked) likes.splice(likes.indexOf(myId), 1);
            else {
              likes.push(myId);
              if (disliked) dislikes.splice(dislikes.indexOf(myId), 1);
            }
          } else {
            if (disliked) dislikes.splice(dislikes.indexOf(myId), 1);
            else {
              dislikes.push(myId);
              if (liked) likes.splice(likes.indexOf(myId), 1);
            }
          }
          return { ...r, likes, dislikes };
        });
        return { ...c, replies };
      })
    );
    try {
      await axios.post(
        `/api/posts/${postId}/comments/${commentId}/replies/${replyId}/${type}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshFromServer();
      ensureExpanded(commentId);
    } catch {
      await refreshFromServer().catch(() => {});
    }
  };

  // ----- open composer helpers -----
  const openCommentComposer = () => {
    if (!token) {
      navigate("/login");
      return;
    }
    setComposer({ mode: "comment" });
    setTextBody((prev) => prev); // keep draft if you want; no-op
  };

  const startReply = (
    commentId: string,
    target: { _id: string; username: string },
    hasReplies?: boolean
  ) => {
    if (!token) navigate("/login");
    setComposer({ mode: "reply", commentId, target });
    if (hasReplies) ensureExpanded(commentId);
  };

  const startEditComment = (c: Comment) => {
    setComposer({ mode: "edit-comment", commentId: c._id });
    setTextBody(c.text);
  };

  const startEditReply = (commentId: string, r: Reply) => {
    setComposer({ mode: "edit-reply", commentId, replyId: r._id });
    setTextBody(stripLeadingMention(r.text, r.replyTo?.username));
    ensureExpanded(commentId);
  };

  const deleteComment = async (commentId: string) => {
    if (!token) return alert("Please log in.");
    if (!window.confirm("Delete this comment? This cannot be undone.")) return;
    try {
      await axios.delete(`/api/posts/${postId}/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshFromServer();
      if (
        composer &&
        composer.mode === "edit-comment" &&
        composer.commentId === commentId
      ) {
        setComposer(null);
        setTextBody("");
      }
    } catch (err: any) {
      console.error("Delete failed", err);
      alert(err?.response?.data?.message || "Failed to delete comment.");
    }
  };

  const deleteReply = async (commentId: string, replyId: string) => {
    if (!token) return alert("Please log in.");
    if (!window.confirm("Delete this reply?")) return;
    try {
      await axios.delete(
        `/api/posts/${postId}/comments/${commentId}/replies/${replyId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshFromServer();
      ensureExpanded(commentId);
      if (
        composer &&
        composer.mode === "edit-reply" &&
        composer.commentId === commentId &&
        composer.replyId === replyId
      ) {
        setComposer(null);
        setTextBody("");
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to delete reply.");
    }
  };

  // ----- submit / cancel -----
  const handleSubmit = async () => {
    if (!isLoggedIn || !composer) return;

    const typed = (textBody ?? "").trim();
    if (typed.length === 0) return; // aligns with disabled button
    const safeTyped = typed.slice(0, MAX_CHARS); // hard cap

    try {
      if (composer.mode === "comment") {
        // 1) optimistic temp comment so it appears instantly at the top
        const tempId = `tmp-${Date.now()}`;
        const temp: Comment = {
          _id: tempId,
          user: {
            _id: myId,
            username: me.username || "You",
            photoUrl:
              (JSON.parse(localStorage.getItem("user") || "{}") as any)
                .photoUrl || "/default-avatar.png",
          },
          text: safeTyped,
          createdAt: new Date().toISOString(),
          editedAt: undefined,
          likes: [],
          dislikes: [],
          replies: [],
        };
        setItems((prev) => [temp, ...prev]);
        setFrozenOrder((prev) => [tempId, ...(prev ?? [])]);

        skipPollingUntilRef.current = Date.now() + 3000; // pause polling for 3s

        // 2) scroll to the very top so the user sees it
        setTimeout(() => {
          listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        }, 0);

        // 3) fire the real post (parent handles it). NO refetch here → no flicker
        await axios.post(
          `/api/posts/${postId}/comments`,
          { text: safeTyped },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        await refreshFromServer();

        setComposer(null);
        setTextBody("");
        return;
      }

      if (composer.mode === "reply") {
        // mention prefix is outside the 2200 limit
        const full = `${
          lockedMentionText ? lockedMentionText + " " : ""
        }${safeTyped}`;
        await axios.post(
          `/api/posts/${postId}/comments/${composer.commentId}/replies`,
          { text: full, replyTo: composer.target._id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        await refreshFromServer();
        ensureExpanded(composer.commentId);
        setComposer(null);
        setTextBody("");
        return;
      }

      if (composer.mode === "edit-comment") {
        await axios.put(
          `/api/posts/${postId}/comments/${composer.commentId}`,
          { text: safeTyped },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        await refreshFromServer();
        setComposer(null);
        setTextBody("");
        return;
      }

      if (composer.mode === "edit-reply") {
        const full = `${
          lockedMentionText ? lockedMentionText + " " : ""
        }${safeTyped}`;
        await axios.put(
          `/api/posts/${postId}/comments/${composer.commentId}/replies/${composer.replyId}`,
          { text: full },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        await refreshFromServer();
        ensureExpanded(composer.commentId);
        setComposer(null);
        setTextBody("");
        return;
      }
    } catch (err: any) {
      console.error("Submit failed", err);
      alert(err?.response?.data?.message || "Failed to submit.");
    }
  };

  const handleCancel = () => {
    setComposer(null);
    setTextBody("");
  };

  // derived UI bits
  const placeholder = useMemo(() => {
    if (!composer) return "";
    if (composer.mode === "reply" || composer.mode === "edit-reply") {
      return "Write a reply...";
    }
    if (composer.mode === "edit-comment") return "Write a comment...";
    return "Write a comment...";
  }, [composer]);

  const lockedMentionText =
    composer?.mode === "reply"
      ? `@${composer.target.username}`
      : composer?.mode === "edit-reply"
      ? (() => {
          const parent = items.find((c) => c._id === composer.commentId);
          const reply = parent?.replies?.find(
            (r) => r._id === composer.replyId
          );
          return reply?.replyTo?.username ? `@${reply.replyTo.username}` : "";
        })()
      : "";

  // Character limits
  const MAX_CHARS = 2200;

  // Only what the user actually types (mention prefix is not in textBody)
  const typedLen = (textBody ?? "").trim().length;
  const isTypedEmpty = typedLen === 0;

  // Clamp helper so users can never type past the limit
  const clampToMax = (s: string) => (s || "").slice(0, MAX_CHARS);
  const overLimit = typedLen > MAX_CHARS;

  // live length (counts @mention prefix for replies/edit-replies)
  const mentionPrefix =
    composer &&
    (composer.mode === "reply" || composer.mode === "edit-reply") &&
    lockedMentionText
      ? `${lockedMentionText} `
      : "";

  const currentLen = composer
    ? (mentionPrefix + (textBody ?? "").trim()).length
    : 0;

  const sessionOrdered = useMemo(() => {
    const ids = frozenOrder;
    if (!ids) return items; // first render while loading
    const idx = new Map(ids.map((id, i) => [id, i]));
    const rank = (c: Comment) =>
      idx.has(c._id)
        ? (idx.get(c._id) as number)
        : c.user._id === myId
        ? -1
        : Number.MAX_SAFE_INTEGER; // unknown *mine* go to top
    return [...items].sort((a, b) => rank(a) - rank(b));
  }, [items, frozenOrder]);

  return (
    <div
      className="co-overlay"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "var(--bs-card-bg)",
        zIndex: 1050,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{styles}</style>

      {/* header */}
      <div
        className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom"
        style={{ flex: "0 0 auto", background: "var(--bs-card-bg)" }}
      >
        <h5 className="mb-0">Comments</h5>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={goToPost}
          title="Open post page"
        >
          To post
        </button>
      </div>

      {/* list */}
      <div
        className="co-scroll"
        ref={listRef}
        style={{
          flex: "1 1 auto",
          overflowY: "auto",
          overflowX: "hidden",
          padding: "1rem",
        }}
      >
        {!initialLoaded ? (
          <div className="px-1 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="d-flex align-items-start mb-3 placeholder-glow"
              >
                {/* avatar */}
                <span
                  className="rounded-circle me-2 placeholder"
                  style={{ width: 32, height: 32 }}
                  aria-hidden
                />
                {/* name/time + body */}
                <div className="w-100">
                  <div className="mb-2">
                    <span className="placeholder col-3 me-2" />
                    <span className="placeholder col-1" />
                  </div>
                  <div className="placeholder col-10 mb-1" />
                  <div className="placeholder col-8" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-muted py-5">
            <div style={{ fontSize: "2.25rem", lineHeight: 1 }} aria-hidden>
              💬
            </div>
            <h5 className="mt-2 mb-1">No comments yet</h5>
            <p className="mb-3">Be the first to start the conversation.</p>
          </div>
        ) : (
          sessionOrdered.map((c) => {
            const isMe = c.user._id === myId;
            const profileLink = isMe ? "/profile" : `/users/${c.user._id}`;
            const liked = !!myId && c.likes.includes(myId);
            const disliked = !!myId && c.dislikes.includes(myId);
            const repliesCount = c.replies?.length ?? 0;
            const isOP = postOwnerId && c.user._id === postOwnerId;
            const canDeleteComment =
              isMe || (postOwnerId && postOwnerId === myId);

            return (
              <div key={c._id} className="mb-3">
                {/* Top-level comment */}
                <div style={rowStyle}>
                  <Link
                    to={profileLink}
                    onClick={openProfileFresh(profileLink)}
                    className="me-2"
                    style={{ flex: "0 0 auto" }}
                  >
                    <img
                      src={c.user.photoUrl}
                      alt=""
                      className="rounded-circle"
                      style={{ width: 32, height: 32, objectFit: "cover" }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).onerror = null;
                        (e.currentTarget as HTMLImageElement).src =
                          "/default-avatar.png";
                      }}
                    />
                  </Link>

                  <div style={contentStyle}>
                    <div className="co-headrow">
                      {/* Left: name/time + text */}
                      <div className="co-left">
                        <div
                          className="d-flex align-items-center mb-1 flex-wrap"
                          style={{ gap: ".5rem" }}
                        >
                          <Link
                            to={profileLink}
                            onClick={openProfileFresh(profileLink)}
                            className="text-decoration-none"
                          >
                            <strong>{c.user.username}</strong>
                          </Link>
                          {isOP && (
                            <span className="badge bg-warning text-dark">
                              OP
                            </span>
                          )}
                          <small
                            className="text-muted"
                            title={new Date(c.createdAt).toLocaleString()}
                          >
                            {timeAgo(c.createdAt)}
                            {c.editedAt && <em className="ms-1">(edited)</em>}
                          </small>
                        </div>

                        <div style={textWrapStyle}>{c.text}</div>
                      </div>

                      {/* Right: comment actions */}
                      <div className="co-actions">
                        {/* Like / Dislike as icon + count */}
                        <button
                          type="button"
                          className={`react-btn like ${liked ? "active" : ""}`}
                          aria-label="Like"
                          title="Like"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            reactComment(c._id, "like");
                          }}
                        >
                          <span className="icon-sm">👍</span>
                          <span className="count">{c.likes.length}</span>
                        </button>

                        <button
                          type="button"
                          className={`react-btn dislike ${
                            disliked ? "active" : ""
                          }`}
                          aria-label="Dislike"
                          title="Dislike"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            reactComment(c._id, "dislike");
                          }}
                        >
                          <span className="icon-sm">👎</span>
                          <span className="count">{c.dislikes.length}</span>
                        </button>

                        {/* icon-only actions */}
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Reply"
                          title="Reply"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            startReply(
                              c._id,
                              c.user,
                              (c.replies?.length ?? 0) > 0
                            );
                          }}
                        >
                          <span className="icon-sm">↩️</span>
                        </button>

                        {isMe && (
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Edit"
                            title="Edit"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              startEditComment(c);
                            }}
                          >
                            <span className="icon-sm">✏️</span>
                          </button>
                        )}

                        {canDeleteComment && (
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Delete"
                            title="Delete"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteComment(c._id);
                            }}
                          >
                            <span className="icon-sm">🗑️</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* replies toggle */}
                    {repliesCount > 0 && (
                      <div className="mt-2">
                        <button
                          type="button"
                          className="reply-toggle"
                          aria-expanded={isExpanded(c._id)}
                          onClick={() => toggleReplies(c._id)}
                        >
                          {isExpanded(c._id)
                            ? "Hide replies"
                            : `View ${repliesCount} ${
                                repliesCount === 1 ? "reply" : "replies"
                              }`}
                        </button>
                      </div>
                    )}

                    {/* Replies (expanded) */}
                    {isExpanded(c._id) && (
                      <div className="mt-2">
                        {(c.replies ?? []).map((r) => {
                          const rIsMe = r.user._id === myId;
                          const rProfile = rIsMe
                            ? "/profile"
                            : `/users/${r.user._id}`;
                          const mentionIsMe = r.replyTo?._id === myId;
                          const mentionPath = mentionIsMe
                            ? "/profile"
                            : `/users/${r.replyTo?._id}`;
                          const body = stripLeadingMention(
                            r.text,
                            r.replyTo?.username
                          );
                          const rLiked = (r.likes ?? []).includes(myId);
                          const rDisliked = (r.dislikes ?? []).includes(myId);
                          const rIsOP =
                            postOwnerId && r.user._id === postOwnerId;

                          return (
                            <div
                              key={r._id}
                              style={{ marginLeft: 48 }}
                              className="mb-2"
                            >
                              <div style={rowStyle}>
                                <Link
                                  to={rProfile}
                                  onClick={openProfileFresh(rProfile)}
                                  className="me-2"
                                  style={{ flex: "0 0 auto" }}
                                >
                                  <img
                                    src={r.user.photoUrl}
                                    alt=""
                                    className="rounded-circle"
                                    style={{
                                      width: 24,
                                      height: 24,
                                      objectFit: "cover",
                                    }}
                                    onError={(e) => {
                                      (
                                        e.currentTarget as HTMLImageElement
                                      ).onerror = null;
                                      (
                                        e.currentTarget as HTMLImageElement
                                      ).src = "/default-avatar.png";
                                    }}
                                  />
                                </Link>

                                <div style={contentStyle}>
                                  <div className="co-r-headrow">
                                    {/* left: name/time + text */}
                                    <div className="co-r-left">
                                      <div
                                        className="d-flex align-items-center flex-wrap"
                                        style={{
                                          gap: ".5rem",
                                          marginBottom: ".25rem",
                                        }}
                                      >
                                        <Link
                                          to={rProfile}
                                          onClick={openProfileFresh(rProfile)}
                                          className="text-decoration-none"
                                        >
                                          <strong>{r.user.username}</strong>
                                        </Link>
                                        {rIsOP && (
                                          <span className="badge bg-warning text-dark">
                                            OP
                                          </span>
                                        )}
                                        <small
                                          className="text-muted"
                                          title={new Date(
                                            r.createdAt
                                          ).toLocaleString()}
                                        >
                                          {timeAgo(r.createdAt)}
                                          {r.editedAt && (
                                            <em className="ms-1">(edited)</em>
                                          )}
                                        </small>
                                      </div>

                                      <div style={textWrapStyle}>
                                        {r.replyTo && (
                                          <Link
                                            to={mentionPath}
                                            onClick={openProfileFresh(
                                              mentionPath
                                            )}
                                            className="me-1 text-decoration-none"
                                          >
                                            @{r.replyTo.username}
                                          </Link>
                                        )}
                                        <span>{body}</span>
                                      </div>
                                    </div>

                                    {/* right: reply actions */}
                                    <div className="co-r-actions">
                                      <button
                                        type="button"
                                        className={`react-btn like ${
                                          rLiked ? "active" : ""
                                        }`}
                                        aria-label="Like reply"
                                        title="Like"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          reactReply(c._id, r._id, "like");
                                        }}
                                      >
                                        <span className="icon-sm">👍</span>
                                        <span className="count">
                                          {(r.likes ?? []).length}
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        className={`react-btn dislike ${
                                          rDisliked ? "active" : ""
                                        }`}
                                        aria-label="Dislike reply"
                                        title="Dislike"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          reactReply(c._id, r._id, "dislike");
                                        }}
                                      >
                                        <span className="icon-sm">👎</span>
                                        <span className="count">
                                          {(r.dislikes ?? []).length}
                                        </span>
                                      </button>

                                      {/* icon-only reply/edit/delete */}
                                      <button
                                        type="button"
                                        className="icon-btn"
                                        aria-label="Reply"
                                        title="Reply"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          startReply(c._id, r.user);
                                        }}
                                      >
                                        <span className="icon-sm">↩️</span>
                                      </button>

                                      {rIsMe && (
                                        <button
                                          type="button"
                                          className="icon-btn"
                                          aria-label="Edit"
                                          title="Edit"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            startEditReply(c._id, r);
                                          }}
                                        >
                                          <span className="icon-sm">✏️</span>
                                        </button>
                                      )}

                                      {(rIsMe ||
                                        (postOwnerId &&
                                          postOwnerId === myId)) && (
                                        <button
                                          type="button"
                                          className="icon-btn"
                                          aria-label="Delete"
                                          title="Delete"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            deleteReply(c._id, r._id);
                                          }}
                                        >
                                          <span className="icon-sm">🗑️</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating "Comment" button when composer is closed */}
      {!composer && (
        <button
          type="button"
          className="btn btn-primary shadow"
          onClick={openCommentComposer}
          style={{ position: "absolute", right: 16, bottom: 16 }}
          aria-label="Write a comment"
        >
          Comment
        </button>
      )}

      {/* Bottom composer – shown only when composer is open */}
      {isLoggedIn && composer && (
        <div
          className="px-3 py-2 border-top"
          style={{ flex: "0 0 auto", background: "var(--bs-card-bg)" }}
        >
          <div className="d-flex align-items-center" style={{ gap: ".5rem" }}>
            {/* ⬇️ Wrap the input(s) so we can place the helper text under it */}
            <div className="flex-grow-1">
              {(composer.mode === "reply" || composer.mode === "edit-reply") &&
              lockedMentionText ? (
                <div className="input-group">
                  <span className="input-group-text">{lockedMentionText}</span>
                  <input
                    ref={inputRef}
                    type="text"
                    className="form-control"
                    placeholder={placeholder}
                    value={textBody}
                    onChange={(e) => setTextBody(clampToMax(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!isTypedEmpty) handleSubmit(); // ignore Enter on empty
                      }
                    }}
                    style={{ minWidth: 0 }}
                  />
                </div>
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  className="form-control"
                  placeholder={placeholder}
                  value={textBody}
                  onChange={(e) => setTextBody(clampToMax(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!isTypedEmpty) handleSubmit();
                    }
                  }}
                  style={{ minWidth: 0 }}
                />
              )}

              {/* Small muted helper (turns red when over limit) */}
              <div className="d-flex justify-content-end mt-1">
                <small
                  className={`ms-auto ${
                    isTypedEmpty ? "text-danger fw-bold" : "text-muted"
                  }`}
                >
                  {typedLen}/{MAX_CHARS}
                </small>
              </div>
            </div>

            {/* Buttons based on mode */}
            {composer.mode === "comment" && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={isTypedEmpty} // disabled at zero typed chars
                >
                  Post{/* or Reply / Save */}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              </>
            )}

            {composer.mode === "reply" && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={isTypedEmpty} // disabled at zero typed chars
                >
                  Reply{/* or Reply / Save */}
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              </>
            )}

            {(composer.mode === "edit-comment" ||
              composer.mode === "edit-reply") && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={isTypedEmpty} // disabled at zero typed chars
                >
                  Save{/* or Reply / Save */}
                </button>

                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentsPage;
