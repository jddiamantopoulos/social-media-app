/**
 * Messaging page component (Inbox + Conversation).
 *
 * Purpose:
 *   - Provides a direct-messaging UI with an inbox view and a single conversation thread view.
 *
 * Key behaviors:
 *   - /messages shows the inbox (conversations list) with unread counts and username search
 *   - /messages/:conversationId shows the thread with auto-scroll management and a composer
 *   - Polls inbox and thread for near real-time updates, using merge logic to minimize re-render jitter
 *   - Marks inbound messages as read and displays a lightweight "Seen" indicator for the latest read sent message
 *   - Resolves the other participant from inbox data, navigation state, or fallback user fetch
 *
 * Backend endpoints:
 *   - GET  /api/messages/conversations
 *   - GET  /api/messages/:conversationId
 *   - POST /api/messages/:conversationId           (send)
 *   - POST /api/messages/:conversationId/read      (mark read)
 *   - GET  /api/users/:id                          (fallback: resolve other user)
 *
 * State & storage:
 *   - Reads auth token + user snapshot from localStorage
 *
 * Notes:
 *   - Polling is paused when the tab is hidden (document.hidden) to reduce unnecessary requests.
 *   - Uses component-scoped CSS injected via a <style> tag to keep theming localized.
 *   - Normalizes avatar URLs using VITE_API_URL for relative backend paths.
 */
import React from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { timeAgo } from "../utils/timeAgo";

/** ------------ Types ------------ */
type Msg = {
  _id: string;
  conversation: string;
  sender: string;
  recipient: string;
  body: string;
  createdAt: string;
  readBy?: string[];
};

type InboxRow = {
  _id: string;
  otherUser: { _id: string; username: string; photoUrl: string } | null;
  lastMessageBody?: string;
  lastMessageSender?: string | null;
  lastMessageCreatedAt?: string;
  lastMessageAt?: string;
  unreadCount?: number;
};

type OtherUser = { _id: string; username: string; photoUrl: string } | null;

/** ------------ Consts / helpers ------------ */
const MAX_LEN = 2200;

const safeTimeAgo = (d?: string | Date) => {
  try {
    if (!d) return "";
    return timeAgo(d as any);
  } catch {
    return "";
  }
};

const normalizeMsgs = (arr: Msg[]): Msg[] =>
  (arr || []).map((m) => ({
    ...m,
    sender: String(m.sender),
    recipient: String(m.recipient),
    readBy: (m.readBy ?? []).map(String),
  }));

const shallowArrayEq = (a?: string[], b?: string[]) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};

function mergeMessages(prev: Msg[], incoming: Msg[]): Msg[] {
  const byId = new Map(prev.map((m) => [m._id, m]));
  let changed = prev.length !== incoming.length;
  const next = incoming.map((inc) => {
    const old = byId.get(inc._id);
    if (
      old &&
      old.body === inc.body &&
      old.sender === inc.sender &&
      old.recipient === inc.recipient &&
      old.createdAt === inc.createdAt &&
      shallowArrayEq(old.readBy, inc.readBy)
    ) {
      // Unchanged ref
      return old;
    }
    changed = true;
    return inc;
  });
  return changed ? next : prev;
}

function mergeInbox(prev: InboxRow[], incoming: InboxRow[]): InboxRow[] {
  const byId = new Map(prev.map((r) => [r._id, r]));
  let changed = prev.length !== incoming.length;
  const next = incoming.map((inc) => {
    const old = byId.get(inc._id);
    if (
      old &&
      old.lastMessageBody === inc.lastMessageBody &&
      old.lastMessageSender === inc.lastMessageSender &&
      old.lastMessageCreatedAt === inc.lastMessageCreatedAt &&
      old.lastMessageAt === inc.lastMessageAt &&
      (old.otherUser?.username || "") === (inc.otherUser?.username || "") &&
      (old.otherUser?.photoUrl || "") === (inc.otherUser?.photoUrl || "") &&
      (old.unreadCount || 0) === (inc.unreadCount || 0)
    ) {
      return old;
    }
    changed = true;
    return inc;
  });
  return changed ? next : prev;
}

const MessagePage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const gotoInbox = React.useCallback(
    () => navigate("/messages", { replace: true }),
    [navigate]
  );

  // Filters obvious junk before hitting the API if IDs are Mongo ObjectIds
  React.useEffect(() => {
    if (conversationId && !/^[a-f0-9]{24}$/i.test(conversationId)) {
      gotoInbox();
    }
  }, [conversationId, gotoInbox]);

  const token = localStorage.getItem("token") || "";
  const me = JSON.parse(localStorage.getItem("user") || "{}") as {
    id?: string;
    username?: string;
    photoUrl?: string;
  };
  const myId = me.id || "";
  const authed = !!(token && myId);
  const authHeaders = React.useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  // Re-render once per minute so timeAgo stays fresh
  const [, setClock] = React.useState(0);
  React.useEffect(() => {
    const id = window.setInterval(() => setClock((x) => x + 1), 60000);
    return () => window.clearInterval(id);
  }, []);

  /** --------------- Styles --------------- */
  const styles = `
    /* Layout */
    .mp-wrap { height: calc(100vh - 72px); display:flex; flex-direction:column; min-height: 0; }
    .mp-card { 
      display:flex; flex-direction:column; overflow:hidden; height:100%;
      background: var(--bs-card-bg);
      color: var(--bs-card-color);
      border: 1px solid var(--bs-card-border-color);
      border-radius: 12px;
      min-height: 0; 
    }
    .mp-header { 
      flex:0 0 auto; 
      background: var(--bs-card-cap-bg);
      border-bottom: 1px solid var(--bs-border-color);
    }
    .mp-scroll { 
      flex:1 1 auto; 
      overflow:auto; 
      background: var(--bs-card-bg);
      min-height: 0;
    }
    .mp-input { 
      flex:0 0 auto; 
      background: var(--bs-card-cap-bg);
      border-top: 1px solid var(--bs-border-color);
    }

    /* Simple WebKit scrollbar for both the inbox and conversation scrollers */
    .mp-scroll::-webkit-scrollbar { width: 12px; }
    .mp-scroll::-webkit-scrollbar-thumb {
      background: var(--scrollbar-thumb);
      border-radius: 8px;
    }
    .mp-scroll::-webkit-scrollbar-thumb:hover {
      background: var(--scrollbar-thumb-hover);
    }

    /* Inbox rows (list-group) */
    .list-group-item{
      background: var(--bs-list-group-bg) !important;
      color: var(--bs-list-group-color) !important;
      border-color: var(--bs-list-group-border-color) !important;
    }
    .list-group-item-action:hover{
      background: var(--bs-list-group-action-hover-bg) !important;
      color: var(--bs-list-group-action-hover-color, var(--bs-body-color)) !important;
    }
    .inbox-row:hover {
      background: var(--bs-list-group-action-hover-bg) !important;
      color: var(--bs-list-group-action-hover-color, var(--bs-body-color)) !important;
    }

    /* Force clickable conversation rows to use themed surfaces */
    .mp-card .list-group-item,
    .mp-card .list-group-item-action{
      background-color: var(--bs-list-group-bg) !important;
      color: var(--bs-list-group-color) !important;
      border-color: var(--bs-list-group-border-color) !important;
    }

    /* Hover/Focus surface in dark mode */
    .mp-card .list-group-item-action:hover,
    .mp-card .list-group-item-action:focus{
      background-color: var(--bs-list-group-action-hover-bg) !important;
      color: var(--bs-list-group-action-hover-color, var(--bs-body-color)) !important;
    }

    /* Active/selected style */
    .mp-card .list-group-item.active{
      background-color: var(--bs-primary) !important;
      color: #fff !important;
      border-color: var(--bs-primary) !important;
    }

    /* Avatars & text utilities */
    .avatar { width:40px; height:40px; object-fit:cover; border-radius:50%; }
    .avatar-sm { width:28px; height:28px; object-fit:cover; border-radius:50%; }
    .truncate { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .mp-header .text-muted,
    .mp-input .text-muted { color: var(--bs-secondary-color) !important; }

    /* Bubbles */
    .bubble-row { display:flex; margin:6px 0; }
    .bubble { 
      max-width:min(75%,560px); 
      padding:.5rem .75rem; 
      border-radius:14px; 
      box-shadow: 0 4px 14px var(--shadow-outer);
      word-break:break-word; white-space:pre-wrap;
    }
    .bubble-me { 
      margin-left:auto; 
      background: var(--bs-primary); 
      color: #fff; 
    }
    .bubble-them { 
      margin-right:auto; 
      background: color-mix(in srgb, var(--bs-card-bg) 88%, var(--bs-body-color) 12%);
      color: var(--bs-body-color);
      border: 1px solid var(--bs-border-color);
    }
    .bubble-time { display:block; opacity:.8; font-size:.75rem; margin-top:2px; }

    /* Username link stays blue, regardless of theme */
    .username-link { color: var(--bs-link-color) !important; font-weight:700; text-decoration:none; }
    .username-link:hover { color: var(--bs-link-hover-color) !important; }
  `;

  /** --------------- Inbox state + fetch --------------- */
  const [inbox, setInbox] = React.useState<InboxRow[]>([]);
  const [loadingInbox, setLoadingInbox] = React.useState(false);
  const [inboxError, setInboxError] = React.useState<string | null>(null);
  const [inboxLoaded, setInboxLoaded] = React.useState(false);

  const fetchInbox = React.useCallback(
    async (silent = false) => {
      if (!authed) return;
      if (!silent) {
        setLoadingInbox(true);
        setInboxError(null);
      }
      try {
        const { data } = await axios.get<{ conversations: InboxRow[] }>(
          "/api/messages/conversations",
          { headers: authHeaders }
        );

        // Keep only conversations that still have a valid otherUser
        const filtered = (data?.conversations || []).filter(
          (c) => !!c.otherUser && !!c.otherUser._id && !!c.otherUser.username
        );

        setInbox((prev) => mergeInbox(prev, filtered));
        setInboxLoaded(true);
      } catch (err) {
        console.error("load inbox failed:", err);
        if (!silent) setInboxError("Failed to load conversations.");
      } finally {
        if (!silent) setLoadingInbox(false);
      }
    },
    [authed, authHeaders]
  );

  /** --------------- Convo state + fetch --------------- */
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [loadingConvo, setLoadingConvo] = React.useState(false);
  const [convoLoaded, setConvoLoaded] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);

  // Search state for inbox
  const [query, setQuery] = React.useState("");

  // When there's a query, filter and sort alphabetically by username.
  // When empty, keep the original inbox order (recent activity).
  const filteredInbox = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inbox;
    const rows = inbox.filter(
      (c) =>
        c.otherUser && (c.otherUser.username || "").toLowerCase().includes(q)
    );
    rows.sort((a, b) =>
      (a.otherUser?.username || "").localeCompare(
        b.otherUser?.username || "",
        undefined,
        { sensitivity: "base" }
      )
    );
    return rows;
  }, [query, inbox]);

  // Autoscroll manager (only stick to bottom if user is already near bottom)
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const lastMsgIdRef = React.useRef<string | null>(null);

  // Always start at bottom when a convo opens, and keep bottom if user is near it
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Id of the newest message
    const last = messages.length ? messages[messages.length - 1]._id : null;
    const changed = last !== lastMsgIdRef.current;

    const scrollToBottom = (behavior: ScrollBehavior) => {
      // Double-rAF to wait for layout/paint (prevents getting stuck)
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          el.scrollTo({ top: el.scrollHeight, behavior })
        )
      );
    };

    if (!lastMsgIdRef.current) {
      // First paint for this conversation -> jump to bottom
      scrollToBottom("auto");
    } else if (changed) {
      // Message appended: keep user pinned only if user already near bottom
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (gap <= 120) scrollToBottom("smooth");
    }

    lastMsgIdRef.current = last;
  }, [messages, conversationId]);

  React.useEffect(() => {
    // Force the first-paint branch above
    lastMsgIdRef.current = null;
  }, [conversationId]);

  function ConversationsLoadingSkeleton({ rows = 6 }: { rows?: number }) {
    return (
      <div className="list-group list-group-flush">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="list-group-item">
            <div
              className="d-flex align-items-start placeholder-wave"
              style={{ gap: 12 }}
            >
              {/* Avatar */}
              <div
                className="placeholder rounded-circle flex-shrink-0"
                style={{ width: 40, height: 40 }}
                aria-hidden
              />
              {/* Name + snippet */}
              <div className="flex-grow-1">
                <div className="d-flex justify-content-between align-items-center">
                  <div className="placeholder col-4 mb-2" aria-hidden />
                  <div className="placeholder col-2 ms-3" aria-hidden />
                </div>
                <div className="placeholder col-8" aria-hidden />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function ConversationThreadLoadingSkeleton({
    messages = 8,
  }: {
    messages?: number;
  }) {
    // Alternate left/right "bubbles"
    const items = Array.from({ length: messages }).map((_, i) => ({
      me: i % 2 === 1,
      // Varied widths
      w: [45, 60, 35, 70, 50, 40, 65, 55][i % 8],
    }));

    return (
      <div className="px-3 py-3">
        <div
          className="d-flex align-items-center placeholder-wave mb-2"
          style={{ gap: 10 }}
        >
          <div
            className="placeholder rounded-circle"
            style={{ width: 28, height: 28 }}
            aria-hidden
          />
          <div className="placeholder col-3" aria-hidden />
        </div>
        <hr className="mt-2 mb-3" />

        {items.map((it, i) => (
          <div
            key={i}
            className={`d-flex mb-3 ${
              it.me ? "justify-content-end" : "justify-content-start"
            }`}
          >
            <div
              className={`placeholder-wave rounded-4 px-3 py-2`}
              style={{
                maxWidth: "75%",
                boxShadow: "0 4px 14px var(--shadow-outer, rgba(0,0,0,.08))",
                background:
                  "color-mix(in srgb, var(--bs-card-bg, #fff) 88%, var(--bs-body-color, #000) 12%)",
                border: "1px solid var(--bs-border-color)",
              }}
            >
              <div
                className="placeholder mb-2"
                style={{ width: `${it.w}%`, height: "1rem" }}
                aria-hidden
              />
              <div
                className="placeholder"
                style={{
                  width: `${Math.max(25, it.w - 15)}%`,
                  height: "0.9rem",
                }}
                aria-hidden
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const fetchMessages = React.useCallback(
    async (silent = false) => {
      if (!authed || !conversationId) return;
      if (!silent) setLoadingConvo(true);
      try {
        const { data } = await axios.get<{ messages: Msg[] }>(
          `/api/messages/${conversationId}`,
          { headers: authHeaders }
        );
        const normalized = normalizeMsgs(data?.messages || []);
        setMessages((prev) => mergeMessages(prev, normalized));
        setConvoLoaded(true);
      } catch (err) {
        console.error("load messages failed:", err);
        if (axios.isAxiosError(err)) {
          const c = err.response?.status;
          if (
            c === 400 ||
            c === 401 ||
            c === 403 ||
            c === 404 ||
            c === 410 ||
            c === 422
          ) {
            gotoInbox();
            return;
          }
        }
      } finally {
        if (!silent) setLoadingConvo(false);
      }
    },
    [authed, conversationId, authHeaders, navigate]
  );

  /** --------------- Polling --------------- */
  // Inbox polling (no flicker)
  React.useEffect(() => {
    if (!authed || conversationId) return;
    // Initial with spinner
    fetchInbox(false);
    const id = window.setInterval(() => {
      // Silent merge
      if (!document.hidden) fetchInbox(true);
    }, 8000);
    return () => window.clearInterval(id);
  }, [authed, conversationId, fetchInbox]);

  // Convo polling (no flicker)
  React.useEffect(() => {
    if (!authed || !conversationId) return;
    // Initial with spinner
    fetchMessages(false);
    const id = window.setInterval(() => {
      // Silent merge
      if (!document.hidden) fetchMessages(true);
    }, 2000);
    return () => window.clearInterval(id);
  }, [authed, conversationId, fetchMessages]);

  /** --------------- Read receipts: mark incoming as read --------------- */
  const maybeMarkRead = React.useCallback(async () => {
    if (!authed || !conversationId || !messages.length) return;
    // Only do work if there's at least one inbound unread
    const hasInboundUnread = messages.some(
      (m) => m.recipient === myId && !(m.readBy || []).includes(myId)
    );
    if (!hasInboundUnread) return;

    try {
      await axios.post(
        `/api/messages/${conversationId}/read`,
        {},
        { headers: authHeaders }
      );
      // Update messages + inbox quietly
      fetchMessages(true);
      fetchInbox(true);
      // Let NavBar refresh the global unread pill immediately
      window.dispatchEvent(new Event("messages:read"));
    } catch {
      // Ignore
    }
  }, [
    authed,
    conversationId,
    messages,
    myId,
    authHeaders,
    fetchMessages,
    fetchInbox,
  ]);

  React.useEffect(() => {
    maybeMarkRead();
  }, [maybeMarkRead]);

  /** --------------- Derivations --------------- */
  // Guess the other participant id from the first message
  const otherId = React.useMemo(() => {
    if (!messages.length) return null as string | null;
    const m0 = messages[0];
    return m0.sender === myId ? m0.recipient : m0.sender;
  }, [messages, myId]);

  // Only the most recent of user's messages that the other user has read shows "Seen"
  const lastSeenMyMsgId = React.useMemo(() => {
    if (!messages.length || !otherId) return null as string | null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.sender === myId) {
        if ((m.readBy || []).includes(String(otherId))) return m._id;
      }
    }
    return null;
  }, [messages, myId, otherId]);

  /** --------------- Get who the user is chatting with --------------- */
  const [otherUser, setOtherUser] = React.useState<OtherUser>(null);

  React.useEffect(() => {
    const passed = (location.state as any)?.otherUser as OtherUser | undefined;
    if (passed && !otherUser) setOtherUser(passed);
  }, [location.state, otherUser]);

  // Prefer the inbox row if user has it
  React.useEffect(() => {
    if (!conversationId) return;
    const row = inbox.find((c) => String(c._id) === String(conversationId));
    if (row?.otherUser) setOtherUser(row.otherUser);
  }, [conversationId, inbox]);

  // If still unknown, fetch by otherId
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      if (!authed || !conversationId) return;
      // Already known
      if (otherUser) return;
      // Need messages first
      if (!otherId) return;

      try {
        const { data } = await axios.get<{
          _id: string;
          username: string;
          photoUrl: string;
          deleted?: boolean;
          isDeleted?: boolean;
        }>(`/api/users/${otherId}`);

        // If backend marks the user as deleted, bounce to /messages
        if (data?.deleted || data?.isDeleted) {
          if (!cancel) navigate("/messages", { replace: true });
          return;
        }

        if (!cancel) {
          setOtherUser({
            _id: String(data?._id || otherId),
            username: data?.username || "User",
            photoUrl: data?.photoUrl || "/default-avatar.png",
          });
        }
      } catch (err) {
        // If the user record is gone (deleted), redirect to /messages
        if (!cancel) {
          const code = axios.isAxiosError(err)
            ? err.response?.status
            : undefined;
          if (code === 404 || code === 410) {
            navigate("/messages", { replace: true });
          } else {
            navigate("/messages", { replace: true });
          }
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [authed, conversationId, otherId, otherUser, navigate]);

  /** --------------- Send --------------- */
  const handleSend = async () => {
    const body = draft.trim();
    if (!authed) return navigate("/login");
    if (!body || sending || !conversationId) return;
    setSending(true);
    try {
      await axios.post(
        `/api/messages/${conversationId}`,
        { body },
        { headers: authHeaders }
      );
      setDraft("");
      // Silent
      await fetchMessages(true);
      fetchInbox(true).catch(() => {});
    } catch (err) {
      console.error("send failed:", err);
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : "Failed to send message.";
      alert(msg);
    } finally {
      setSending(false);
    }
  };

  /** --------------- Auth gate --------------- */
  if (!authed) {
    return (
      <div className="container">
        <div className="mx-auto" style={{ maxWidth: 820 }}>
          <p>&nbsp;</p>
          <div className="card border-0 shadow-sm mt-3">
            <div className="card-body text-center py-5">
              <h5 className="mb-2">Sign in to view messages</h5>
              <p className="text-muted mb-0">
                You need to be logged in to view and send messages.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const ABS_API = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const imgSrc = (u?: string) =>
    !u ? "" : /^https?:\/\//i.test(u) ? u : `${ABS_API}${u.startsWith("/") ? u : `/${u}`}`;

  /** --------------- Inbox UI (/messages) --------------- */
  if (!conversationId) {
    return (
      <div className="container">
        <style>{styles}</style>
        <div className="mx-auto mp-wrap" style={{ maxWidth: 820 }}>
          <div className="card mp-card border-0 shadow-sm mt-3">
            <div className="mp-header border-bottom px-3 py-2 d-flex align-items-center justify-content-between">
              <strong>Messages</strong>
              <small className="text-muted">Inbox</small>
            </div>

            <div className="px-3 py-2 border-bottom">
              <div className="input-group">
                <input
                  type="search"
                  className="form-control"
                  placeholder="Search for existing conversations by username..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search conversations by username"
                />
              </div>
            </div>

            <div className="mp-scroll">
              {loadingInbox && !inboxLoaded ? (
                <ConversationsLoadingSkeleton />
              ) : inboxError ? (
                <div className="text-center text-danger py-4">{inboxError}</div>
              ) : (query ? filteredInbox.length === 0 : inbox.length === 0) ? (
                <div className="text-center text-muted py-5">
                  {query ? (
                    <>
                      <h5 className="mb-2">No conversations found</h5>
                      <p className="mb-0">Try a different username.</p>
                    </>
                  ) : (
                    <>
                      <h5 className="mb-2">
                        Message others for their chats to appear here
                      </h5>
                      <p className="mb-0">
                        Start a conversation from a user's profile.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="list-group list-group-flush">
                  {(query ? filteredInbox : inbox).map((c) => {
                    const other = c.otherUser;
                    const href = `/messages/${c._id}`;
                    const when =
                      safeTimeAgo(c.lastMessageCreatedAt || c.lastMessageAt) ||
                      "";
                    const snippet =
                      (c.lastMessageBody && c.lastMessageBody.trim()) ||
                      "No messages yet.";

                    return (
                      <Link
                        key={c._id}
                        to={href}
                        className="list-group-item list-group-item-action inbox-row"
                      >
                        <div
                          className="d-flex align-items-start"
                          style={{ gap: 12 }}
                        >
                          <img
                            src={imgSrc(other?.photoUrl) || "/default-avatar.png"}
                            alt=""
                            className="avatar"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).onerror =
                                null;
                              (e.currentTarget as HTMLImageElement).src =
                                "/default-avatar.png";
                            }}
                          />
                          <div
                            className="d-flex justify-content-between align-items-center"
                            style={{ gap: 5 }}
                          >
                            <strong className="truncate">
                              {other?.username || "Unknown user"}
                            </strong>
                            <div
                              className="d-flex align-items-center"
                              style={{ gap: 8 }}
                            >
                              {c.unreadCount ? (
                                <span className="badge bg-danger rounded-pill">
                                  {c.unreadCount}
                                </span>
                              ) : null}
                              <small className="text-muted ms-2">{when}</small>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /** --------------- Convo UI (/messages/:conversationId) --------------- */
  return (
    <div className="container">
      <style>{styles}</style>
      <div className="mx-auto mp-wrap" style={{ maxWidth: 820 }}>
        <div className="card mp-card border-0 shadow-sm mt-3">
          {/* Header */}
          <div className="mp-header border-bottom px-3 py-2 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center" style={{ gap: 10 }}>
              <strong>Conversation</strong>
              {/* Inside the header, replace the non-clickable block */}
              {otherUser && (
                <Link
                  to={
                    otherUser._id === myId
                      ? "/profile"
                      : `/users/${otherUser._id}`
                  }
                  className="d-flex align-items-center text-decoration-none"
                  style={{ gap: 8 }}
                  title={`Open ${otherUser.username}'s profile`}
                >
                  <img
                    src={imgSrc(otherUser.photoUrl) || "/default-avatar.png"}
                    alt={`${otherUser.username}'s avatar`}
                    className="avatar-sm"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).onerror = null;
                      (e.currentTarget as HTMLImageElement).src =
                        "/default-avatar.png";
                    }}
                  />
                  <span
                    className="truncate text-body username-link"
                    style={{ maxWidth: 240 }}
                  >
                    {otherUser.username}
                  </span>
                </Link>
              )}
            </div>
            <div className="d-flex align-items-center" style={{ gap: 8 }}>
              <Link to="/messages" className="btn btn-sm btn-outline-secondary">
                Inbox
              </Link>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="mp-scroll px-3 py-3">
            {loadingConvo && !convoLoaded ? (
              <ConversationThreadLoadingSkeleton />
            ) : messages.length === 0 ? (
              <div className="text-center text-muted py-4">
                No messages yet. Say hi!
              </div>
            ) : (
              messages.map((m) => {
                const mine = String(m.sender) === myId;
                const seen = mine && m._id === lastSeenMyMsgId;
                return (
                  <div key={m._id} className="bubble-row">
                    <div
                      className={`bubble ${mine ? "bubble-me" : "bubble-them"}`}
                    >
                      <div>{m.body}</div>
                      <small className="bubble-time">
                        {safeTimeAgo(m.createdAt)}
                        {seen ? " · Seen" : ""}
                      </small>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer */}
          <div className="mp-input border-top p-2">
            <div className="d-flex align-items-center">
              <input
                type="text"
                className="form-control"
                placeholder="Type a message…"
                value={draft}
                // Strip pasted newlines
                onChange={(e) => setDraft(e.target.value.replace(/\r?\n/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    // Block newlines
                    e.preventDefault();
                    handleSend();
                  }
                }}
                maxLength={MAX_LEN}
              />
              <button
                className="btn btn-primary ms-2"
                onClick={handleSend}
                disabled={!draft.trim() || sending}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
            <div className="text-end mt-1">
              <small
                className={
                  draft.trim().length === 0
                    ? "fw-bold text-danger"
                    : "text-muted"
                }
              >
                {draft.trim().length}/{MAX_LEN}
              </small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagePage;
