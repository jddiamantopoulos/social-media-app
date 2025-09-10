// src/components/empties/UserNotFound.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

const UserNotFound: React.FC = () => {
  const navigate = useNavigate();

  const styles = `
    .unf-wrap{
      padding-top:72px;
      min-height:calc(100vh - 72px);
      display:flex; align-items:center;
    }
    .unf-card{
      position:relative;
      background:var(--bs-card-bg);
      color:var(--bs-card-color);
      border:1px solid var(--bs-card-border-color);
      border-radius:16px;
      box-shadow:var(--elev-card, 0 8px 20px rgba(0,0,0,.06));
    }
    .unf-card::before{
      content:"";
      position:absolute; left:-1px; right:-1px; top:-1px; height:4px;
      border-radius:16px 16px 0 0;
      background:linear-gradient(90deg, var(--bs-primary), transparent);
    }
    .unf-emoji{ font-size:3rem; line-height:1; display:block; }
    .unf-title{ font-weight:700; margin:8px 0 4px; }
    .unf-sub{ color:var(--bs-secondary-color); }
    .unf-actions .btn{ min-width:140px; }
    .unf-tip{ font-size:.875rem; color:var(--bs-secondary-color); }
  `;

  return (
    <div className="container unf-wrap">
      <style>{styles}</style>
      <div className="mx-auto unf-card p-4 p-md-5" style={{ maxWidth: 560 }}>
        <div className="d-flex align-items-start" style={{ gap: 16 }}>
          <div className="flex-shrink-0">
            <span className="unf-emoji" aria-hidden>
              🕵️‍♂️
            </span>
          </div>
          <div className="flex-grow-1">
            <h4 className="unf-title mb-1">User not found</h4>
            <p className="unf-sub mb-3">
              We couldn’t find that user. They likely deleted their account or
              the link leads to no existing user in the database.
            </p>

            <div className="unf-actions d-flex flex-wrap" style={{ gap: 8 }}>
              <button className="btn btn-primary" onClick={() => navigate(-1)}>
                Go back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotFound;
