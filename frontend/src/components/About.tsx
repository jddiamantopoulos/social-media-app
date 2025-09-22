// src/components/About.tsx
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
            // responsive circle: between 160px and 320px, scales with viewport
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
              objectFit: "cover", // fills the circle nicely
              objectPosition: "50% 50%", // center subject
              transform: "scale(2)", // zoom in
              transformOrigin: "55% 40%", // keep zoom centered
              display: "block",
            }}
            onError={(e) => {
              // graceful fallback if the image is missing
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      </div>
      {/* Title + copy */}
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <h1 className="display-5 fw-bold text-center mb-3">
            About CyberScape and its creator
          </h1>
          <p className="lead">
            Hi, I am Jonathan Diamantopoulos! As a junior pursuing a degree in
            Computer Science at ASU Barrett, The Honors College, I wanted to
            test the limits of artificial intelligence in web development while
            incorporating some of my own programming knowledge.
          </p>
          <p className="lead">
            CyberScape is a lightweight social media platform built with React,
            MongoDB, and multiple web development modules and libraries using
            ChatGPT. It involves backend programming via JavaScript files and
            frontend programming via TypeScript + JavaScript XML (TSX) files.
            To deploy the project, I used Render for the backend and Vercel for the
            frontend. Additionally, the web app showcases multiple features of a standard
            social media app, including accounts, posting, followers, likes/dislikes,
            search, comments, replies, settings, messages, notifications, editing,
            deleting, and real-time-ish sync via polling.
          </p>
          <p className="lead">
            I hope you enjoy playing around with the software!
          </p>
        </div>
      </div>
    </div>
  );
};

export default About;
