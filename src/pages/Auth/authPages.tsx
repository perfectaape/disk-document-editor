import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const AuthPages: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");
    const state = params.get("state");
    if (token) {
      if (state === "yandex") {
        document.cookie = `yandex_token=${token}; path=/; secure; max-age=3600`;
      } else if (state === "google") {
        document.cookie = `google_token=${token}; path=/; secure; max-age=3600`;
      }
      navigate("/");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [navigate]);

  return <div>Загрузка...</div>;
};
