import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const AuthPages: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const hash: string | undefined = window.location.hash;
    if (hash) {
      const token: string = hash.split("&")[0].split("=")[1];
      document.cookie = `yandex_token=${token}; path=/; secure; max-age=3600`;
      navigate("/");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [navigate]);

  return <div>Загрузка...</div>;
};
