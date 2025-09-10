// src/components/NavBar.tsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { timeAgo } from "../utils/timeAgo";

type SearchUser = {
  type: "user";
  _id: string;
  username: string;
  photoUrl: string;
};
type SearchPost = {
  type: "post";
  _id: string;
  description: string;
  imageUrl?: string;
  likes?: number;
};
type SearchItem = SearchUser | SearchPost;

type NotifType =
  | "post_like"
  | "follow"
  | "new_post"
  | "comment_like"
  | "comment_reply"
  | "post_comment"
  | "post_reply";
type NotifActor = { _id: string; username: string; photoUrl: string };
type NotifPost = { _id: string; description?: string; imageUrl?: string };

type NavKey =
  | "home"
  | "post"
  | "messages"
  | "profile"
  | "settings"
  | "about"
  | "login"
  | "signup"
  | "search"
  | "notifications";

const pathToNavKey = (path: string): NavKey | null => {
  if (path === "/home") return "home";
  if (path === "/post") return "post";
  if (path.startsWith("/messages")) return "messages";
  if (path === "/profile") return "profile";
  if (path === "/settings") return "settings";
  if (path === "/about") return "about";
  if (path === "/login") return "login";
  if (path === "/signup") return "signup";
  return null; // non-navbar routes (posts, users, comments, etc.)
};

type Notif = {
  _id: string;
  type: NotifType;
  actor: NotifActor;
  post?: NotifPost;
  comment?: string;
  reply?: string;
  createdAt: string;
  read: boolean;
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const NavBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isLoggedIn = Boolean(localStorage.getItem("token"));
  const me = JSON.parse(localStorage.getItem("user") || "{}") as {
    id?: string;
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.setItem("activeNav", "home");
    window.location.assign("/home");
  };

  // Map notif type → label
  function labelFor(type: NotifType): string {
    switch (type) {
      case "comment_like":
        return "liked your comment";
      case "comment_reply":
        return "replied to your comment";
      case "post_comment":
      case "post_reply":
        return "commented on your post";
      case "post_like":
        return "liked your post";
      case "follow":
        return "followed you";
      case "new_post":
        return "posted";
      default:
        return "did something";
    }
  }

  // --- Search state ---
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false); // results dropdown
  const [searchOpen, setSearchOpen] = useState(false); // slide-out input
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [highlight, setHighlight] = useState<number>(-1);
  const wrapRefDesktop = useRef<HTMLDivElement>(null);
  const wrapRefDrawer = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const drawerInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  // --- Notifications state ---
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const notifWrapRef = useRef<HTMLLIElement>(null);
  const notifDrawerRef = useRef<HTMLDivElement>(null);

  // --- Mobile drawer (React-only offcanvas) ---
  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = () => setMenuOpen(true);
  const closeMenu = () => {
    setMenuOpen(false);
    setNotifOpen(false);
  };

  const [activeNav, setActiveNav] = useState<NavKey | null>(() => {
    const saved = sessionStorage.getItem("activeNav") as NavKey | null;
    return saved ?? pathToNavKey(location.pathname);
  });

  useEffect(() => {
    if (activeNav) sessionStorage.setItem("activeNav", activeNav);
  }, [activeNav]);

  // If user lands directly on a navbar page (e.g., typing /profile), adopt it
  useEffect(() => {
    const k = pathToNavKey(location.pathname);
    if (k && k !== activeNav) setActiveNav(k);
    // NOTE: when on non-navbar routes, we do nothing (highlight stays)
  }, [location.pathname]);

  const [msgUnread, setMsgUnread] = useState(0);

  const fetchMsgUnread = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setMsgUnread(0);
      return;
    }
    try {
      const { data } = await axios.get("/api/messages/unread-count", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsgUnread(Number(data?.count || 0));
    } catch (e) {
      // fail silently
    }
  };

  // after you define fetchMsgUnread()
  React.useEffect(
    () => {
      const onRead = () => fetchMsgUnread();
      window.addEventListener("messages:read", onRead);
      return () => window.removeEventListener("messages:read", onRead);
    },
    [
      /* no deps or [fetchMsgUnread] if defined inline */
    ]
  );

  useEffect(() => {
    fetchMsgUnread();
    const id = window.setInterval(fetchMsgUnread, 45000); // ~45s like notifications
    return () => window.clearInterval(id);
  }, [isLoggedIn]);

  // Emoji + search styles + drawer styles
  const styles = `
    /* Make the navbar bar use our primary var directly */
    .navbar.bg-primary,
    .bg-primary{
      background-color: var(--bs-primary) !important;
    }

    .brand-img { height: 40px; } /* adjust logo size */

    /* Dim-by-default brand logo; brighten on hover/active (like .nav-emoji) */
    .navbar-brand .brand-img{
      filter: saturate(0.7) brightness(0.9);
      transition: filter .15s ease, transform .12s ease;
    }
    .navbar-brand:hover .brand-img,
    .navbar-brand.active .brand-img{
      filter: saturate(1.25) brightness(1.25);
      transform: translateY(-1px);
    }

    .nav-emoji{
      font-size: 1.6rem; /* adjust emoji size */
      line-height: 1;
      display: inline-block;
      filter: saturate(0.7) brightness(0.9);
      transition: filter .15s ease, transform .12s ease;
    }
    .nav-link:hover .nav-emoji,
    .nav-link.active .nav-emoji {
      filter: saturate(1.25) brightness(1.25);
      transform: translateY(-1px);
    }

    /* Slide-out search */
    .search-toggle { display: flex; align-items: center; gap: 10px; }
    .search-box {
      position: relative;
      width: 0;
      opacity: 0;
      overflow: hidden;
      transition: width .25s ease, opacity .25s ease;
    }
    .search-box.open {
      width: 320px;
      opacity: 1;
      overflow: visible;
    }

    /* React-only mobile drawer */
    .mobile-drawer{
      position:fixed; top:0; right:0; height:100vh; width:320px;
      background: var(--bs-body-bg, #fff);
      box-shadow:-2px 0 16px rgba(0,0,0,.2);
      transform:translateX(100%);
      transition:transform .25s ease;
      z-index:2002; padding:16px;
    }
    .mobile-drawer.open{ transform:translateX(0); }

    .mobile-overlay{
      position:fixed; inset:0; background:rgba(0,0,0,.35);
      opacity:0; pointer-events:none; transition:opacity .2s; z-index:2001;
    }
    .mobile-overlay.show{ opacity:1; pointer-events:auto; }

    /* In the drawer, make items comfy */
    .drawer-item{
      display:flex; align-items:center; gap:10px;
      padding:10px 2px; text-decoration:none;
    }
    .drawer-sep{ margin:8px 0; border-top:1px solid rgba(0,0,0,.08); }
    .drawer-notif-list { max-height: 50vh; overflow: auto; }
    /* Single, positioned badge for the desktop bell */
    .nav-item .notif-badge{
      position: absolute;
      top: 6px;          /* tweak for your navbar height */
      right: -2px;       /* tweak horizontally */
      transform: translate(50%, -50%);
      font-size: .65rem;
      line-height: 1;
      padding: .2rem .35rem;
    }
    /* Bigger button, no border/ring */
    .navbar-toggler{
      border: 0 !important;
      box-shadow: none !important;
      padding: .75rem .95rem;        /* bigger tap target */
    }

    /* Bigger icon; animate only the glow */
    .navbar-toggler .navbar-toggler-icon{
      width: 1.9rem;                  /* was ~1.5rem */
      height: 1.9rem;
      background-size: 100% 100%;
      transition: filter .15s ease;
      filter: drop-shadow(0 0 0 transparent); /* base: no glow */
    }

    /* Glow on hover/focus (keeps it perfectly still) */
    .navbar-toggler:hover .navbar-toggler-icon,
    .navbar-toggler:focus-visible .navbar-toggler-icon{
      filter: drop-shadow(0 0 6px rgba(255,255,255,.9))
              drop-shadow(0 0 2px rgba(255,255,255,.9));
    }

    /* Optional: if you ever use navbar-light on a light bg */
    .navbar-light .navbar-toggler:hover .navbar-toggler-icon,
    .navbar-light .navbar-toggler:focus-visible .navbar-toggler-icon{
      filter: drop-shadow(0 0 6px rgba(0,0,0,.35))
              drop-shadow(0 0 2px rgba(0,0,0,.35));
    }

    /*.nav-badge {
      position: absolute;
      bottom: -5px;   /* tweak to taste */
      right: -6px;    /* tweak to taste */
      padding: 0.30rem 0.47rem;
    }*/

      /* ===== Desktop notifications dropdown ===== */
    .notif-menu {               /* add breathing room inside the dropdown */
      padding: 8px;
    }

    /* Each notification row looks like a soft card, but themed */
    .notif-menu .list-group-item{
      border: 0 !important;
      background: var(--notif-row-bg) !important;
      color: var(--bs-body-color) !important;
      padding: 12px 12px !important;
      margin: 6px 0;
      border-radius: 10px;
      transition: background .12s ease, transform .05s ease;
    }
    .notif-menu .list-group-item:hover{
      background: var(--notif-row-hover-bg) !important;
    }

    /* Dark scrollbars for notifications dropdown + drawer list */
    .notif-menu,
    .drawer-notif-list{
      /* Firefox */
      scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
    }

    /* WebKit (Chrome/Edge/Safari) */
    .notif-menu::-webkit-scrollbar,
    .drawer-notif-list::-webkit-scrollbar{
      width: 12px;
    }

    .notif-menu::-webkit-scrollbar-thumb,
    .drawer-notif-list::-webkit-scrollbar-thumb{
      background: var(--scrollbar-thumb);
      border-radius: 8px;
    }

    .notif-menu::-webkit-scrollbar-thumb:hover,
    .drawer-notif-list::-webkit-scrollbar-thumb:hover{
      background: var(--scrollbar-thumb-hover);
    }

    .notif-menu::-webkit-scrollbar-track,
    .drawer-notif-list::-webkit-scrollbar-track{
      background: var(--scrollbar-track);
    }

    /* Unread emphasis */
    .notif-menu .list-group-item.bg-light{
      background: var(--notif-unread-bg) !important;
      position: relative;
    }
    .notif-menu .list-group-item.bg-light::before{
      content:"";
      position:absolute; left:6px; top:8px; bottom:8px;
      width:3px; background: var(--bs-primary); border-radius:3px;
    }

    /* Muted text uses theme’s muted color */
    .notif-menu .text-muted{ color: var(--bs-secondary-color) !important; }

    /* Avatar sizing for consistency */
    .notif-menu img.rounded-circle {
      width: 36px !important;
      height: 36px !important;
      object-fit: cover;
    }

    /* Text truncation hygiene */
    .notif-menu .flex-grow-1 { min-width: 0 !important; }
    .notif-menu .text-wrap { overflow: hidden; }
    .notif-menu .text-wrap .text-break {
      display: inline;          /* revert */
      vertical-align: baseline; /* (explicit) */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ===== Drawer notifications card ===== */
    /* Drawer notifications list uses the same vars */
    .drawer-notif-list{
      padding: 8px;
      background: transparent; /* parent is a .card */
    }
    .drawer-notif-list .list-group-item{
      border: 0 !important;
      background: var(--notif-row-bg) !important;
      color: var(--bs-body-color) !important;
      padding: 12px 12px !important;
      margin: 6px 0;
      border-radius: 10px;
      transition: background .12s ease, transform .05s ease;
    }
    .drawer-notif-list .list-group-item:hover{
      background: var(--notif-row-hover-bg) !important;
    }
    .drawer-notif-list .list-group-item.bg-light{
      background: var(--notif-unread-bg) !important;
    }
    .drawer-notif-list .text-muted{ color: var(--bs-secondary-color) !important; }

    .drawer-notif-list .list-group-item.bg-light::before {
      content: "";
      position: absolute;
      left: 6px; top: 8px; bottom: 8px;
      width: 3px;
      background: var(--bs-primary);
      border-radius: 3px;
    }
    .drawer-notif-list img.rounded-circle {
      width: 36px !important;
      height: 36px !important;
      object-fit: cover;
    }
    .drawer-notif-list .flex-grow-1 { min-width: 0 !important; }
    .drawer-notif-list .ms-2,
    .drawer-notif-list .ms-3 { margin-left: 12px !important; }

    /* Themed search suggestions (desktop + drawer) */
    .search-box .dropdown-menu,
    #mobileDrawer .dropdown-menu{
      background: var(--bs-card-bg);
      border: 1px solid var(--bs-border-color);
      color: var(--dropdown-item-color);
    }

    .search-box .dropdown-item,
    #mobileDrawer .dropdown-item{
      color: var(--dropdown-item-color);
    }

    .search-box .dropdown-item:hover,
    #mobileDrawer .dropdown-item:hover{
      background: var(--dropdown-hover-bg);
    }

    .search-box .dropdown-item.active,
    .search-box .dropdown-item:active,
    #mobileDrawer .dropdown-item.active,
    #mobileDrawer .dropdown-item:active{
      background: var(--bs-primary);
      color: #fff;
    }

    /* “Searching… / No results” rows that use .text-muted */
    .search-box .dropdown-menu .text-muted,
    #mobileDrawer .dropdown-menu .text-muted{
      color: var(--dropdown-item-muted) !important;
    }

    /* Container uses themed surface/border */
    .notif-menu.dropdown-menu{
      background: var(--bs-card-bg);
      color: var(--bs-body-color);
      border: 1px solid var(--bs-border-color);
    }

    /* Uniform vertical spacing for drawer rows */
    .drawer-list{
      display: flex;
      flex-direction: column;
      gap: 12px;              /* <- this controls the equal spacing */
    }

    /* Tidy up each row look (optional) */
    .mobile-drawer .drawer-item{
      padding: 15px 6px;
      border-radius: 8px;
    }

    /* If the notifications details card opens, give it a tiny space from its trigger */
    .drawer-notif-card{
      margin-top: 6px;
    }

    #mobileDrawer .btn-link.nav-link.active{
      color: var(--bs-body-color) !important;
      text-decoration: none;
    }

    /* Drawer: labels dim by default, brighten on hover/active */
    #mobileDrawer .nav-label{
      opacity: .72;
      transition: opacity .15s ease;
    }
    #mobileDrawer .drawer-item:hover .nav-label,
    #mobileDrawer .drawer-item.active .nav-label{
      opacity: 1;
    }

    /* Optional: a tiny hover bg so the row feels interactive */
    #mobileDrawer .drawer-item:hover{
      background: var(--dropdown-hover-bg);
      border-radius: 8px;
    }
  `;

  // Refresh-if-same helper (kept, but we'll switch desktop/drawer links to goNav)
  const handleNavClick =
    (to: string) =>
    (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
      setOpen(false);
      setQ("");
      setItems([]);
      setHighlight(-1);
      setNotifOpen(false);
      setSearchOpen(false);
      closeMenu();

      if (location.pathname === to) {
        e.preventDefault();
        navigate(0);
      }
    };

  const goSameAware = (path: string) => {
    setNotifOpen(false);
    const current = location.pathname + location.search + location.hash;
    if (current === path) navigate(0);
    else navigate(path);
    closeMenu();
  };

  // shared helpers to clear search & always navigate
  const clearSearch = () => {
    setQ("");
    setOpen(false);
    setItems([]);
    setHighlight(-1);
    setSearchOpen(false);
  };

  const goNav = (path: string) => {
    setNotifOpen(false);
    clearSearch();
    closeMenu();

    // mark last selected navbar tab (but NOT for posts/users/comments pages)
    const k = pathToNavKey(path);
    if (k) setActiveNav(k); // persisted by the effect above

    const current = location.pathname + location.search + location.hash;

    if (current === path && path === "/home") {
      navigate(`/home?nv=${Date.now()}`);
      return;
    }
    if (current === path) {
      navigate(0);
    } else {
      navigate(path);
    }
  };

  const toggleSearch = () => {
    const next = !searchOpen;
    setSearchOpen(next);
    if (next) {
      setTimeout(() => desktopInputRef.current?.focus(), 160);
    } else {
      setOpen(false);
      setQ("");
      setItems([]);
      setHighlight(-1);
    }
  };

  // Fetch suggestions (debounced)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setItems([]);
      setOpen(false);
      setHighlight(-1);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const { data } = await axios.get("/api/search", {
          params: { q, limit: 8 },
        });
        let results: SearchItem[] = (data.results || []).map((r: any) =>
          r.type === "user"
            ? {
                type: "user",
                _id: r._id,
                username: r.username,
                photoUrl: r.photoUrl || "/default-avatar.png",
              }
            : {
                type: "post",
                _id: r._id,
                description: r.description,
                imageUrl: r.imageUrl,
                likes: r.likes,
              }
        );

        if (!data.results && (data.users || data.posts)) {
          const users: SearchUser[] = (data.users || []).map((u: any) => ({
            type: "user",
            _id: u._id,
            username: u.username,
            photoUrl: u.photoUrl,
          }));
          const posts: SearchPost[] = (data.posts || []).map((p: any) => ({
            type: "post",
            _id: p._id,
            description: p.description,
            imageUrl: p.imageUrl,
            likes: Array.isArray(p.likes) ? p.likes.length : p.likes || 0,
          }));
          results = [...users, ...posts];
        }

        setItems(results);
        setOpen(true);
        setHighlight(results.length ? 0 : -1);
      } catch {
        setItems([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Close suggestions on outside click (keeps slide-out open)
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      const insideDesktop = !!wrapRefDesktop.current?.contains(t);
      const insideDrawer = !!wrapRefDrawer.current?.contains(t);
      if (!insideDesktop && !insideDrawer) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Close notifications on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideDesktop = !!notifWrapRef.current?.contains(target);
      const insideDrawer = !!notifDrawerRef.current?.contains(target);
      if (!insideDesktop && !insideDrawer) setNotifOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // Auto-close drawer if screen grows to lg
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 992 && menuOpen) {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [menuOpen]);

  const go = (item: SearchItem) => {
    clearSearch(); // unified clearing

    // build target path
    const path =
      item.type === "user"
        ? item._id === me.id
          ? "/profile"
          : `/users/${item._id}`
        : `/posts/${item._id}`;

    setActiveNav("search");

    // navigate or hard-refresh if already there
    goNav(path);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && highlight < items.length) go(items[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const renderItem = (item: SearchItem, idx: number) => {
    const isActive = idx === highlight;
    const baseBtn = `dropdown-item d-flex align-items-center ${
      isActive ? "active" : ""
    }`;

    if (item.type === "user") {
      return (
        <button
          key={`u-${item._id}`}
          type="button"
          className={baseBtn}
          onMouseEnter={() => setHighlight(idx)}
          onClick={() => go(item)}
        >
          <img
            src={item.photoUrl}
            alt=""
            className="rounded-circle me-2"
            style={{ width: 28, height: 28, objectFit: "cover", flexShrink: 0 }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).onerror = null;
              (e.currentTarget as HTMLImageElement).src = "/default-avatar.png";
            }}
          />
          <span className="text-truncate flex-grow-1" style={{ minWidth: 0 }}>
            {item.username}
          </span>
          <span className="badge bg-secondary ms-auto">User</span>
        </button>
      );
    }

    return (
      <button
        key={`p-${item._id}`}
        type="button"
        className={baseBtn}
        onMouseEnter={() => setHighlight(idx)}
        onClick={() => go(item)}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            className="me-2 rounded"
            style={{ width: 36, height: 24, objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div
            className="me-2"
            style={{ width: 36, height: 24, flexShrink: 0 }}
          />
        )}
        <span className="text-truncate flex-grow-1" style={{ minWidth: 0 }}>
          {item.description}
        </span>
        <span className="badge bg-info text-dark ms-auto">Post</span>
      </button>
    );
  };

  /** ---- Notifications helpers ---- */
  const computeUnread = (arr: Notif[]) =>
    arr.reduce((n, it) => n + (it.read ? 0 : 1), 0);

  const fetchNotifications = async () => {
    if (!isLoggedIn) return;
    setNotifLoading(true);
    try {
      const { data } = await axios.get("/api/notifications", {
        // no 'limit' param -> let the server return everything (or its default)
        headers: getAuthHeaders(),
      });
      const all: Notif[] = Array.isArray(data) ? data : [];
      const unreadOnly = all.filter((n) => !n.read); // keep only unread in UI
      setNotifs(unreadOnly);
      setUnread(unreadOnly.length);
    } catch (e) {
      console.error("Fetch notifications failed:", e);
    } finally {
      setNotifLoading(false);
    }
  };

  const markAllRead = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Optimistically clear the list and unread count
    setNotifs([]);
    setUnread(0);

    try {
      await axios.post(
        "/api/notifications/read-all",
        {},
        { headers: getAuthHeaders() }
      );
    } catch (err) {
      console.error("Mark all read failed:", err);
    }
  };

  const opensComments = (t: NotifType) =>
    t === "post_comment" ||
    t === "post_reply" ||
    t === "comment_reply" ||
    t === "comment_like";

  const openFromNotif = async (n: Notif) => {
    setNotifOpen(false);
    clearSearch();

    // Optimistically remove from UI and decrement unread
    setNotifs((prev) => prev.filter((x) => x._id !== n._id));
    setUnread((u) => Math.max(0, u - (n.read ? 0 : 1)));

    // Mark read on the server (fire-and-forget)
    try {
      await axios.post(
        `/api/notifications/${n._id}/read`,
        {},
        { headers: getAuthHeaders() }
      );
    } catch {}

    setActiveNav("notifications");

    // Navigate
    if (n.type === "follow") {
      const path =
        n.actor?._id === me.id ? "/profile" : `/users/${n.actor._id}`;
      goNav(path);
      return;
    }

    if (n.post?._id) {
      if (opensComments(n.type)) {
        // Go to comments overlay; remember where we came from
        closeMenu(); // ensure drawer closes on mobile
        navigate(`/posts/${n.post._id}/comments`, {
          state: { backgroundLocation: location },
        });
      } else {
        goNav(`/posts/${n.post._id}`);
      }
    } else {
      goNav("/home");
    }
  };

  useEffect(() => {
    if (!isLoggedIn) {
      setNotifs([]);
      setUnread(0);
      return;
    }
    fetchNotifications();
    const id = window.setInterval(fetchNotifications, 45000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const MAX_SEARCH = 2200;

  return (
    <>
      <nav
        className="navbar navbar-expand-lg navbar-dark bg-primary fixed-top"
        style={{ zIndex: 2001 }}
      >
        <style>{styles}</style>
        <div className="container">
          {/* Brand image (replace src with your logo) */}
          <Link
            className={`navbar-brand d-flex align-items-center ${
              pathToNavKey(location.pathname) === "about" ? "active" : ""
            }`}
            to="/about"
            onClick={(e) => {
              e.preventDefault();
              goNav("/about");
            }}
            title="About"
          >
            <img
              src="/cs-logo.jpg"
              alt="MySocialApp"
              className="brand-img d-inline-block align-text-top"
            />
          </Link>

          {/* React-only hamburger toggles our drawer */}
          <button
            className="navbar-toggler"
            type="button"
            onClick={openMenu}
            aria-label="Open menu"
            aria-controls="mobileDrawer"
            aria-expanded={menuOpen}
          >
            <span className="navbar-toggler-icon" />
          </button>

          {/* Desktop / large screens */}
          <div className="collapse navbar-collapse" id="navbarNav">
            <div
              className="ms-auto d-flex align-items-center"
              style={{ gap: "6px" }}
            >
              {/* Slide-out Search (input sits LEFT of the 🔎) */}
              <div className="search-toggle">
                <div
                  ref={wrapRefDesktop}
                  className={`search-box ${searchOpen ? "open" : ""}`}
                >
                  <input
                    ref={desktopInputRef}
                    type="search"
                    className="form-control"
                    placeholder="Search..."
                    value={q}
                    onChange={(e) => setQ(e.target.value.slice(0, MAX_SEARCH))}
                    maxLength={MAX_SEARCH}
                    onFocus={() => q && setOpen(true)}
                    onKeyDown={onKeyDown}
                    aria-label="Search users and posts"
                  />

                  {open && (
                    <div
                      className="dropdown-menu show w-100 mt-1 shadow"
                      style={{
                        zIndex: 3000,
                        maxHeight: 320,
                        overflowY: "auto",
                        overflowX: "hidden",
                      }}
                    >
                      {loading && (
                        <span className="dropdown-item text-muted">
                          Searching…
                        </span>
                      )}
                      {!loading && !items.length && q && (
                        <span className="dropdown-item text-muted">
                          No results
                        </span>
                      )}
                      {!loading && items.map(renderItem)}
                    </div>
                  )}
                </div>

                {/* 🔎 brightens when searchOpen or hover */}
                <button
                  type="button"
                  className={`btn btn-link nav-link p-0 ${
                    searchOpen || activeNav === "search" ? "active" : ""
                  }`}
                  onClick={toggleSearch}
                  aria-label={searchOpen ? "Close search" : "Open search"}
                  title={searchOpen ? "Close search" : "Open search"}
                >
                  <span className="nav-emoji" aria-hidden>
                    🔎
                  </span>
                  <span className="visually-hidden">
                    {searchOpen ? "Close search" : "Open search"}
                  </span>
                </button>
              </div>

              {/* Emoji nav links */}
              <ul className="navbar-nav">
                {isLoggedIn && (
                  <li className="nav-item position-relative" ref={notifWrapRef}>
                    {/* brightens when notifOpen or hover */}
                    <button
                      className={`btn btn-link nav-link d-flex ${
                        notifOpen || activeNav === "notifications"
                          ? "active"
                          : ""
                      }`}
                      onClick={async () => {
                        const next = !notifOpen;
                        setNotifOpen(next);
                        if (next) await fetchNotifications();
                      }}
                      aria-label="Notifications"
                      title="Notifications"
                      type="button"
                    >
                      <span className="d-inline-block position-relative">
                        <span className="nav-emoji" aria-hidden>
                          🔔
                        </span>
                        {unread > 0 && (
                          <span className="badge bg-danger rounded-pill ms-1">
                            {unread}
                          </span>
                        )}
                      </span>
                    </button>

                    {notifOpen && (
                      <div
                        className="dropdown-menu show mt-1 shadow notif-menu"
                        style={{
                          right: 0,
                          left: "auto",
                          minWidth: 320,
                          maxWidth: 360,
                          maxHeight: 420,
                          overflowY: "auto",
                          zIndex: 3000,
                        }}
                      >
                        <div className="d-flex align-items-center px-3 py-2 border-bottom">
                          <strong className="me-auto">Notifications</strong>
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markAllRead();
                            }}
                            disabled={!unread}
                          >
                            Mark all read
                          </button>
                        </div>

                        {notifLoading && (
                          <span className="dropdown-item text-muted">
                            Loading…
                          </span>
                        )}
                        {!notifLoading && notifs.length === 0 && (
                          <span className="dropdown-item text-muted">
                            No notifications
                          </span>
                        )}

                        {!notifLoading &&
                          notifs.map((n) => (
                            <button
                              key={n._id}
                              type="button"
                              className={`list-group-item list-group-item-action d-flex align-items-start ${
                                n.read ? "" : "bg-light"
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openFromNotif(n);
                              }}
                              style={{ whiteSpace: "normal" }}
                            >
                              <img
                                src={n.actor?.photoUrl || "/default-avatar.png"}
                                alt=""
                                className="rounded-circle me-2"
                                style={{
                                  width: 32,
                                  height: 32,
                                  objectFit: "cover",
                                  flexShrink: 0,
                                }}
                                onError={(e) => {
                                  (
                                    e.currentTarget as HTMLImageElement
                                  ).onerror = null;
                                  (e.currentTarget as HTMLImageElement).src =
                                    "/default-avatar.png";
                                }}
                              />
                              <div
                                className="flex-grow-1"
                                style={{ minWidth: 0 }}
                              >
                                <div className="text-wrap text-break">
                                  <strong className="text-break">
                                    {n.actor?.username}
                                  </strong>{" "}
                                  {labelFor(n.type)}
                                </div>
                                <small className="text-muted">
                                  {timeAgo(n.createdAt)}
                                </small>
                              </div>
                              {n.post?.imageUrl ? (
                                <img
                                  src={n.post.imageUrl}
                                  alt=""
                                  className="ms-2 rounded"
                                  style={{
                                    width: 44,
                                    height: 30,
                                    objectFit: "cover",
                                    flexShrink: 0,
                                  }}
                                />
                              ) : n.type === "follow" ? (
                                <span
                                  className="ms-2 badge bg-secondary"
                                  style={{ flexShrink: 0 }}
                                >
                                  User
                                </span>
                              ) : (
                                <span
                                  className="ms-2 badge bg-info text-dark"
                                  style={{ flexShrink: 0 }}
                                >
                                  Post
                                </span>
                              )}
                            </button>
                          ))}
                      </div>
                    )}
                  </li>
                )}

                {/* Home */}
                <li className="nav-item">
                  <Link
                    className={`nav-link ${
                      activeNav === "home" ? "active" : ""
                    }`}
                    to="/home"
                    onClick={(e) => {
                      e.preventDefault();
                      goNav("/home");
                    }}
                    aria-label="Home"
                    title="Home"
                  >
                    <span className="nav-emoji" aria-hidden>
                      🏠
                    </span>
                    <span className="visually-hidden">Home</span>
                  </Link>
                </li>

                {!isLoggedIn ? (
                  <>
                    <li className="nav-item">
                      <Link
                        className={`nav-link ${
                          activeNav === "signup" ? "active" : ""
                        }`}
                        to="/signup"
                        onClick={(e) => {
                          e.preventDefault();
                          goNav("/signup");
                        }}
                        aria-label="Sign Up"
                        title="Sign Up"
                      >
                        <span className="nav-emoji" aria-hidden>
                          ✍️
                        </span>
                        <span className="visually-hidden">Sign Up</span>
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link
                        className={`nav-link ${
                          activeNav === "login" ? "active" : ""
                        }`}
                        to="/login"
                        onClick={(e) => {
                          e.preventDefault();
                          goNav("/login");
                        }}
                        aria-label="Log In"
                        title="Log In"
                      >
                        <span className="nav-emoji" aria-hidden>
                          🔐
                        </span>
                        <span className="visually-hidden">Log In</span>
                      </Link>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="nav-item">
                      <Link
                        className={`nav-link ${
                          activeNav === "post" ? "active" : ""
                        }`}
                        to="/post"
                        onClick={(e) => {
                          e.preventDefault();
                          goNav("/post");
                        }}
                        aria-label="Create Post"
                        title="Create Post"
                      >
                        <span className="nav-emoji" aria-hidden>
                          🖼️
                        </span>
                        <span className="visually-hidden">Post</span>
                      </Link>
                    </li>
                    <li className="nav-item position-relative">
                      <Link
                        className={`nav-link ${
                          activeNav === "messages" ? "active" : ""
                        }`}
                        to="/messages"
                        onClick={(e) => {
                          e.preventDefault();
                          goNav("/messages");
                        }}
                        aria-label="Messages"
                        title="Messages"
                      >
                        <span className="d-inline-block position-relative"></span>
                        <span className="nav-emoji" aria-hidden>
                          💬
                        </span>
                        {msgUnread > 0 && (
                          <span className="badge bg-danger rounded-pill ms-1">
                            {msgUnread}
                          </span>
                        )}
                      </Link>
                    </li>

                    <li className="nav-item">
                      <Link
                        className={`nav-link ${
                          activeNav === "profile" ? "active" : ""
                        }`}
                        to="/profile"
                        onClick={(e) => {
                          e.preventDefault();
                          goNav("/profile");
                        }}
                        aria-label="Profile"
                        title="Profile"
                      >
                        <span className="nav-emoji" aria-hidden>
                          👤
                        </span>
                        <span className="visually-hidden">Profile</span>
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link
                        className={`nav-link ${
                          activeNav === "settings" ? "active" : ""
                        }`}
                        to="/settings"
                        onClick={(e) => {
                          e.preventDefault();
                          goNav("/settings");
                        }}
                        aria-label="Settings"
                        title="Settings"
                      >
                        <span className="nav-emoji" aria-hidden>
                          ⚙️
                        </span>
                        <span className="visually-hidden">Settings</span>
                      </Link>
                    </li>
                    <li className="nav-item">
                      <button
                        className="btn btn-link nav-link"
                        onClick={handleLogout}
                        aria-label="Log out"
                        title="Log out"
                        type="button"
                      >
                        <span className="nav-emoji" aria-hidden>
                          🚪
                        </span>
                        <span className="visually-hidden">Log out</span>
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </nav>

      {/* React-only mobile drawer (used on small screens) */}
      <div
        id="mobileDrawer"
        className={`mobile-drawer ${menuOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="mb-0">Menu</h5>
          <button
            type="button"
            className="btn-close"
            style={{ filter: "var(--btn-close-filter)" }}
            aria-label="Close"
            onClick={closeMenu}
          />
        </div>

        {/* Search inside drawer (always visible for convenience) */}
        <div className="mb-2" ref={wrapRefDrawer}>
          <input
            ref={drawerInputRef}
            type="search"
            className="form-control"
            placeholder="Search..."
            value={q}
            onChange={(e) => setQ(e.target.value.slice(0, MAX_SEARCH))}
            maxLength={MAX_SEARCH}
            onFocus={() => q && setOpen(true)}
            onKeyDown={onKeyDown}
            aria-label="Search users and posts"
          />

          {open && (
            <div
              className="dropdown-menu show w-100 mt-1 shadow"
              style={{
                zIndex: 3000,
                maxHeight: 320,
                overflowY: "auto",
                overflowX: "hidden",
              }}
            >
              {loading && (
                <span className="dropdown-item text-muted">Searching…</span>
              )}
              {!loading && !items.length && q && (
                <span className="dropdown-item text-muted">No results</span>
              )}
              {!loading && items.map(renderItem)}
            </div>
          )}
        </div>

        <hr className="drawer-sep" />

        <div className="drawer-list">
          {isLoggedIn && (
            <div ref={notifDrawerRef}>
              <button
                className={`btn btn-link drawer-item nav-link ${
                  notifOpen || activeNav === "notifications" ? "active" : ""
                }`}
                onClick={async () => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  if (next) await fetchNotifications();
                }}
                aria-label="Notifications"
                title="Notifications"
                type="button"
              >
                <span className="nav-emoji" aria-hidden>
                  🔔
                </span>
                <span className="flex-grow-1 nav-label">Notifications</span>
                {unread > 0 && (
                  <span className="badge bg-danger rounded-pill">{unread}</span>
                )}
              </button>

              {notifOpen && (
                <div className="card border-0 shadow-sm drawer-notif-card">
                  <div className="d-flex align-items-center px-3 py-2 border-bottom">
                    <strong className="me-auto">Notifications</strong>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={(e) => markAllRead(e)}
                      disabled={!unread}
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="drawer-notif-list">
                    {notifLoading && (
                      <div className="px-3 py-2 text-muted">Loading…</div>
                    )}
                    {!notifLoading && notifs.length === 0 && (
                      <div className="px-3 py-2 text-muted">
                        No notifications
                      </div>
                    )}

                    {!notifLoading &&
                      notifs.map((n) => (
                        <button
                          key={n._id}
                          type="button"
                          className={`list-group-item list-group-item-action d-flex align-items-start ${
                            n.read ? "" : "bg-light"
                          }`}
                          onClick={() => openFromNotif(n)}
                          style={{ whiteSpace: "normal" }}
                        >
                          <img
                            src={n.actor?.photoUrl || "/default-avatar.png"}
                            alt=""
                            className="rounded-circle me-2"
                            style={{
                              width: 32,
                              height: 32,
                              objectFit: "cover",
                              flexShrink: 0,
                            }}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).onerror =
                                null;
                              (e.currentTarget as HTMLImageElement).src =
                                "/default-avatar.png";
                            }}
                          />
                          <div className="flex-grow-1" style={{ minWidth: 0 }}>
                            <div className="text-wrap text-break">
                              <strong className="text-break">
                                {n.actor?.username}
                              </strong>{" "}
                              {labelFor(n.type)}
                            </div>
                            <small className="text-muted">
                              {timeAgo(n.createdAt)}
                            </small>
                          </div>

                          {n.post?.imageUrl ? (
                            <img
                              src={n.post.imageUrl}
                              alt=""
                              className="ms-2 rounded"
                              style={{
                                width: 44,
                                height: 30,
                                objectFit: "cover",
                                flexShrink: 0,
                              }}
                            />
                          ) : n.type === "follow" ? (
                            <span
                              className="ms-2 badge bg-secondary"
                              style={{ flexShrink: 0 }}
                            >
                              User
                            </span>
                          ) : (
                            <span
                              className="ms-2 badge bg-info text-dark"
                              style={{ flexShrink: 0 }}
                            >
                              Post
                            </span>
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Link
          className={`drawer-item nav-link ${
            activeNav === "home" ? "active" : ""
          }`}
          to="/home"
          onClick={(e) => {
            e.preventDefault();
            goNav("/home");
          }}
          aria-label="Home"
          title="Home"
        >
          <span className="nav-emoji" aria-hidden>
            🏠
          </span>
          <span className="nav-label">Home</span>
        </Link>

        {!isLoggedIn ? (
          <>
            <Link
              className={`drawer-item nav-link ${
                activeNav === "signup" ? "active" : ""
              }`}
              to="/signup"
              onClick={(e) => {
                e.preventDefault();
                goNav("/signup");
              }}
              aria-label="Sign Up"
              title="Sign Up"
            >
              <span className="nav-emoji" aria-hidden>
                ✍️
              </span>
              <span>Sign Up</span>
            </Link>
            <Link
              className={`drawer-item nav-link ${
                activeNav === "login" ? "active" : ""
              }`}
              to="/login"
              onClick={(e) => {
                e.preventDefault();
                goNav("/login");
              }}
              aria-label="Log In"
              title="Log In"
            >
              <span className="nav-emoji" aria-hidden>
                🔐
              </span>
              <span>Log In</span>
            </Link>
          </>
        ) : (
          <>
            <Link
              className={`drawer-item nav-link ${
                activeNav === "post" ? "active" : ""
              }`}
              to="/post"
              onClick={(e) => {
                e.preventDefault();
                goNav("/post");
              }}
              aria-label="Create Post"
              title="Create Post"
            >
              <span className="nav-emoji" aria-hidden>
                🖼️
              </span>
              <span className="nav-label">Post</span>
            </Link>
            <Link
              className={`drawer-item nav-link ${
                activeNav === "messages" ? "active" : ""
              }`}
              to="/messages"
              onClick={(e) => {
                e.preventDefault();
                goNav("/messages");
              }}
              aria-label="Messages"
              title="Messages"
            >
              <span className="nav-emoji" aria-hidden>
                💬
              </span>

              {/* Wrap text + pill to kill the inner gap */}
              <span className="d-flex align-items-center" style={{ gap: 7 }}>
                <span className="nav-label">Messages</span>
                {msgUnread > 0 && (
                  <span className="badge bg-danger rounded-pill ms-1">
                    {msgUnread}
                  </span>
                )}
              </span>
            </Link>

            <Link
              className={`drawer-item nav-link ${
                activeNav === "profile" ? "active" : ""
              }`}
              to="/profile"
              onClick={(e) => {
                e.preventDefault();
                goNav("/profile");
              }}
              aria-label="Profile"
              title="Profile"
            >
              <span className="nav-emoji" aria-hidden>
                👤
              </span>
              <span className="nav-label">Profile</span>
            </Link>
            <Link
              className={`drawer-item nav-link ${
                activeNav === "settings" ? "active" : ""
              }`}
              to="/settings"
              onClick={(e) => {
                e.preventDefault();
                goNav("/settings");
              }}
              aria-label="Settings"
              title="Settings"
            >
              <span className="nav-emoji" aria-hidden>
                ⚙️
              </span>
              <span className="nav-label">Settings</span>
            </Link>
            <button
              className="btn btn-link drawer-item nav-link"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              type="button"
            >
              <span className="nav-emoji" aria-hidden>
                🚪
              </span>
              <span className="nav-label">Log out</span>
            </button>
          </>
        )}
      </div>

      <div
        className={`mobile-overlay ${menuOpen ? "show" : ""}`}
        onClick={closeMenu}
      />
    </>
  );
};

export default NavBar;
