// src/App.tsx
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

// bring in the provider
import { PageStateCacheProvider } from "./hooks/pageStateCache";

function AppInner() {
  const location = useLocation();
  const state = location.state as { backgroundLocation?: Location } | undefined;

  // Treat ONLY the comments path as an overlay
  const isOverlayRoute = !!matchPath(
    "/posts/:postId/comments",
    location.pathname
  );
  const bg = state?.backgroundLocation;
  const routeLocation = isOverlayRoute && bg ? bg : location;

  return (
    <>
      {/* Base app rendered against the *background* location when present */}
      <Routes location={routeLocation}>
        <Route path="/" element={<Navigate replace to="/home" />} />
        <Route
          path="/home"
          element={<Home key={`home@${routeLocation.key}`} />}
        />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={<LogIn />} />
        <Route path="/signup" element={<SignUp />} />
        {/* Key these so they remount on same-path navigations */}
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
        {/* include comments here too so direct hits work full-page */}
        <Route path="/posts/:postId/comments" element={<CommentsPage />} />

        <Route path="*" element={<Navigate replace to="/home" />} />
      </Routes>

      {/* Overlay tree: render ONLY when on an overlay route and we have a background */}
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
      {/* wrap everything in the cache provider */}
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
