import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const AuthPages: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get("access_token");

    if (token) {
      document.cookie = `yandex_token=${token}; path=/; secure; max-age=3600`;
      navigate("/");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [navigate]);

  return <div>Загрузка...</div>;
};
