/**
 * About page component.
 *
 * Purpose:
 *   - Presents a short introduction to the app and its creator, and sets the browser tab title.
 *
 * Key behaviors:
 *   - Updates document.title on mount
 *   - Renders a responsive circular profile image with a graceful fallback if missing
 *
 * Backend endpoints:
 *   - None
 *
 * State & storage:
 *   - None (static content)
 *
 * Notes:
 *   - Uses inline styles for responsive sizing (clamp + aspectRatio) and image framing/zoom.
 */
import React, { useEffect } from "react";

const About: React.FC = () => {
  useEffect(() => {
    document.title = "About — MySocialApp";
  }, []);

  return (
    <div className="container" style={{ paddingTop: 56 }}>
      {/* Creator image */}
      <div className="text-center mb-4">
        <div
          style={{
            // Responsive circle: between 160px and 320px, scales with viewport
            width: "clamp(160px, 28vw, 320px)",
            aspectRatio: "1 / 1",
            margin: "0 auto",
            borderRadius: "50%",
            overflow: "hidden",
            boxShadow: "0 6px 24px rgba(0,0,0,.12)",
          }}
        >
          <img
            src="/about-creator.jpg"
            alt="About the creator"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "50% 50%",
              transform: "scale(2)",
              transformOrigin: "55% 40%",
              display: "block",
            }}
            onError={(e) => {
              // Graceful fallback if the image is missing
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      </div>
      {/* Title + copy */}
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <h1 className="display-5 fw-bold text-center mb-3">
            About CyberScape and Its Creator
          </h1>
          <p className="lead">
            Hello! I'm Jonathan Diamantopoulos, a junior Computer Science student at
            ASU's Barrett, The Honors College. I designed and built CyberScape to gain
            hands-on experience developing a full-stack web application from concept
            to deployment.
          </p>
          <p className="lead">
            CyberScape is a lightweight social media platform built with React, Node.js,
            and MongoDB, using technologies such as Express, Mongoose, and Axios.
            The frontend is developed with TypeScript and React (TSX), while the backend
            is implemented in JavaScript. The application is deployed using Vercel
            (frontend) and Render (backend).
          </p>
          <p className="lead">
            The platform supports core social media functionality including user
            accounts, posts, followers, likes and dislikes, search, comments and
            replies, private messaging, notifications, profile settings, and content
            editing and deletion. It also provides near real-time updates using
            periodic data polling.
          </p>
          <p className="lead">
            Thank you for checking out CyberScape — I hope you enjoy exploring the
            platform!
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;
