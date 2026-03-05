# CyberScape

CyberScape is a full-stack social media platform that allows users to create posts, interact through comments and reactions, follow other users, exchange private messages, and customize their experience with themes and account settings.

The application is built using **React + TypeScript on the frontend** and **Node.js + Express on the backend**, with **MongoDB** for persistent data storage and **JWT authentication** for secure sessions.

This project demonstrates full-stack development concepts including authentication, REST API design, state management, optimistic UI updates, and cloud-based media storage.

---

# Live Demo

Frontend (Vercel)  
https://cyberscape-hub.vercel.app

Backend (Render)  
Hosted separately as an Express API.

---

# Features

## Authentication
- User signup and login
- JWT-based authentication
- Secure password hashing with bcrypt
- Persistent sessions using localStorage

## Social Features
- Create, edit, and delete posts
- Comment on posts
- Nested replies in comment threads
- Like and dislike reactions
- Follow and unfollow other users
- View user profiles

## Messaging
- Private conversations between users
- Message history
- Conversation threads

## Discovery
- User and post search
- Notifications for social interactions
- Feed of recent activity

## Account Management
- Change username
- Change password
- Delete account
- Client-side validation aligned with backend rules

## UI / UX
- Light and dark themes
- Customizable primary color
- Loading skeleton components
- Optimistic UI updates
- Modal overlay navigation for comment threads

---

# Tech Stack

## Frontend
- React
- TypeScript
- React Router
- Axios
- Bootstrap

## Backend
- Node.js
- Express
- JWT authentication
- bcrypt password hashing
- Socket.io (real-time messaging)

## Database
- MongoDB (Mongoose)

## Media Storage
- Cloudinary

## Deployment
- Vercel (frontend)
- Render (backend)

---

# Project Structure

```
frontend/
  src/
    components/
    hooks/
    lib/
    utils/
    App.tsx
    main.tsx

backend/
  db/
  lib/
  middleware/
  models/
  routes/
  scripts/
  server.js
```

The frontend and backend are deployed independently and communicate through a REST API.

---

# Environment Variables

## Backend (.env)

```
NODE_ENV=development
PORT=5000

MONGODB_URI_BASE=your_mongodb_connection_string
MONGODB_URI_PARAMS=?retryWrites=true&w=majority&appName=Cluster0

JWT_SECRET=your_jwt_secret

MONGO_DB_RESUME=social_resume
MONGO_DB_FRIENDS=social_friends

CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_UPLOAD_PRESET=unsigned_default
CLOUDINARY_FOLDER=social-media-app

CLIENT_ORIGIN=http://localhost:5173
```

## Frontend (.env)

```
VITE_API_URL=http://localhost:5000
```

---

# Installation

Clone the repository:

```
git clone https://github.com/yourusername/cyberscape.git
cd cyberscape
```

---

# Backend Setup

```
cd backend
npm install
node server.js
```

The backend server will start on:

```
http://localhost:5000
```

---

# Frontend Setup

```
cd frontend
npm install
npm run dev
```

The frontend development server will run on:

```
http://localhost:5173
```

---

# API Overview

Authentication

```
POST /api/signup
POST /api/login
```

Messaging

```
POST /api/messages/start
GET /api/messages/unread-count
GET /api/messages/conversations
GET /api/messages/:conversationId
POST /api/messages/:conversationId/read
POST /api/messages/:conversationId
```

Notifications

```
GET /api/notifications
POST /api/notifications/read-all
POST /api/notifications/:id/read
```

Posts

```
POST /api/posts
GET /api/posts
GET /api/posts/:id
PUT /api/posts/:id
DELETE /api/posts/:id
GET /api/users/:id/posts
POST /api/posts/:id/like
POST /api/posts/:id/dislike
POST /api/posts/:id/comments
PUT /api/posts/:postId/comments/:commentId
DELETE /api/posts/:postId/comments/:commentId
POST /api/posts/:postId/comments/:commentId/like
POST /api/posts/:postId/comments/:commentId/dislike
POST /api/posts/:postId/comments/:commentId/replies
POST /api/posts/:postId/comments/:commentId/replies/:replyId/like
POST /api/posts/:postId/comments/:commentId/replies/:replyId/dislike
PUT /api/posts/:postId/comments/:commentId/replies/:replyId
DELETE /api/posts/:postId/comments/:commentId/replies/:replyId
```

Searching

```
GET /api/search
```

Account settings

```
GET /api/settings/me
PUT /api/settings/password
PUT /api/settings/username
DELETE /api/settings/account
```

Users

```
POST /api/user/avatar
GET /api/user/me
PUT /api/user/description
GET /api/users/:id
POST /api/users/:id/follow
GET /api/users/:id/followers
GET /api/users/:id/following
```

---

# Security Practices

- Passwords hashed using bcrypt
- JWT authentication for protected routes
- Server-side validation for usernames and passwords
- Client-side validation aligned with backend constraints
- Environment variables used for secrets and credentials

---

# Author

Jonathan Diamantopoulos  
Computer Science Student  
Arizona State University
