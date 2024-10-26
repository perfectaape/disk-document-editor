import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const token = params.get("access_token");
      const state = params.get("state");

      if (token) {
        const cookieOptions = "path=/; secure; max-age=3600";
        if (state === "yandex") {
          document.cookie = `yandex_token=${token}; ${cookieOptions}`;
        } else if (state === "google") {
          document.cookie = `google_token=${token}; ${cookieOptions}`;
        } else {
          console.error("Unknown state parameter:", state);
          return;
        }

        navigate(`/explorer/${state}`);
        window.history.replaceState(null, "", window.location.pathname);
      } else {
        console.error("Access token not found in URL");
      }
    };

    handleAuth();
  }, [navigate]);

  return <div>Загрузка...</div>;
};
