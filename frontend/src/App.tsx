/**
 * Application root + route configuration.
 *
 * Responsibilities:
 *   - Defines all client-side routes for the SPA using React Router v6.
 *   - Implements a "background location" pattern so /posts/:postId/comments can render
 *     as a modal-style overlay on top of the previous page (feed/profile/post) while still
 *     supporting direct navigation as a normal full page route.
 *   - Wraps the app in PageStateCacheProvider to preserve per-visit UI state across navigation
 *     (e.g., overlay drafts/expanded threads) and renders the global NavBar.
 *
 * Routing notes:
 *   - When navigating to the comments route with `state.backgroundLocation`, the main <Routes>
 *     renders against that background location and a second overlay <Routes> renders CommentsPage
 *     in a fixed-position layer.
 *   - If the comments route is visited directly (no backgroundLocation), it renders normally
 *     via the base route tree.
 */
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  Location,
  matchPath,
} from "react-router-dom";
import NavBar from "./components/NavBar";
import Home from "./components/Home";
import LogIn from "./components/LogIn";
import SignUp from "./components/SignUp";
import Profile from "./components/Profile";
import UserProfile from "./components/UserProfile";
import PostPage from "./components/PostPage";
import EditPostPage from "./components/EditPostPage";
import PostDetail from "./components/PostDetail";
import About from "./components/About";
import Settings from "./components/Settings";
import MessagePage from "./components/MessagePage";
import CommentsPage from "./components/CommentsPage";

// Bring in the provider
import { PageStateCacheProvider } from "./hooks/pageStateCache";

function AppInner() {
  const location = useLocation();
  const state = location.state as { backgroundLocation?: Location } | undefined;

  // Treat only the comments path as an overlay
  const isOverlayRoute = !!matchPath(
    "/posts/:postId/comments",
    location.pathname
  );
  const bg = state?.backgroundLocation;
  const routeLocation = isOverlayRoute && bg ? bg : location;

  return (
    <>
      {/* Base app rendered against the background location when present */}
      <Routes location={routeLocation}>
        <Route path="/" element={<Navigate replace to="/home" />} />
        <Route
          path="/home"
          element={<Home key={`home@${routeLocation.key}`} />}
        />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<LogIn />} />
        <Route path="/signup" element={<SignUp />} />
        {/* Key allows for remounting on same-path navigations */}
        <Route
          path="/profile"
          element={<Profile key={`profile@${routeLocation.key}`} />}
        />
        <Route
          path="/users/:id"
          element={<UserProfile key={`user@${routeLocation.key}`} />}
        />
        <Route path="/posts/:id" element={<PostDetail />} />
        <Route path="/posts/:id/edit" element={<EditPostPage />} />
        <Route path="/post" element={<PostPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/messages" element={<MessagePage />} />
        <Route path="/messages/:conversationId" element={<MessagePage />} />
        <Route path="/posts/:postId/comments" element={<CommentsPage />} />

        <Route path="*" element={<Navigate replace to="/home" />} />
      </Routes>

      {/* Overlay tree: render only when on an overlay route and a background is present */}
      {isOverlayRoute && bg && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            background: "var(--bs-card-bg)",
            overflow: "auto",
          }}
        >
          <div style={{ paddingTop: "56px" }}>
            <Routes>
              <Route
                path="/posts/:postId/comments"
                element={<CommentsPage />}
              />
            </Routes>
          </div>
        </div>
      )}
    </>
  );
}

const App: React.FC = () => {
  return (
    <Router>
      {/* Wrap everything in the cache provider */}
      <PageStateCacheProvider>
        <NavBar />
        <div style={{ paddingTop: "56px" }}>
          <AppInner />
        </div>
      </PageStateCacheProvider>
    </Router>
  );
};

export default App;
