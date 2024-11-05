import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = () => {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const token = params.get("access_token");
        const state = params.get("state");
        const error = params.get("error");

        if (error) {
          console.error("Authentication error:", error);
          navigate("/");
          return;
        }

        if (!token || !state) {
          console.error("Missing token or state parameter");
          navigate("/");
          return;
        }

        if (state !== "yandex" && state !== "google") {
          console.error("Unknown state parameter:", state);
          navigate("/");
          return;
        }

        const cookieOptions = "path=/; secure; max-age=3600";
        document.cookie = `${state}_token=${token}; ${cookieOptions}`;

        navigate(`/explorer/${state}`);
        window.history.replaceState(null, "", window.location.pathname);
      } catch (error) {
        console.error("Error during authentication:", error);
        navigate("/");
      }
    };

    handleAuth();
  }, [navigate]);

  return <div>Загрузка...</div>;
};
